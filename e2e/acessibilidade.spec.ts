import { writeFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { instalarApiFalsa } from './apiFalsa'

/*
 * Auditoria de acessibilidade com o axe-core (issue #172): as telas principais, nos temas claro e escuro, não podem
 * ter violação séria ou crítica das regras WCAG 2.1 A e AA. O relatório completo de cada tela (inclusive as
 * violações menores) vai para test-results/ e, no CI, para o artefato "acessibilidade".
 *
 * O contraste das cores dos temas já é medido em src/services/__testes__/contraste.test.ts (issue #106); aqui o
 * axe-core confere a tela montada: rótulos, nomes de botões e links, cabeçalhos, ARIA, idioma e contraste real.
 */

const REGRAS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const GRAVES = new Set(['serious', 'critical'])

async function auditar(page: Page, testInfo: TestInfo, tela: string) {
  // Espera as animações de entrada (.rise) terminarem: no meio do fade, o axe mediria o contraste de um texto
  // ainda transparente. As animações sem fim (pulso do gauge, ondas) não entram na espera.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  )
  const resultado = await new AxeBuilder({ page }).withTags(REGRAS_WCAG).analyze()
  const arquivo = testInfo.outputPath(`axe-${tela}.json`)
  writeFileSync(arquivo, JSON.stringify(resultado.violations, null, 2))
  await testInfo.attach(`axe-${tela}.json`, { path: arquivo, contentType: 'application/json' })
  const graves = resultado.violations
    .filter((v) => GRAVES.has(v.impact ?? ''))
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} elemento(s), ex.: ${v.nodes[0]?.target.join(' ')}`)
  expect(graves, `Violações sérias ou críticas na tela ${tela}`).toEqual([])
}

async function entrar(page: Page, usuario: string, telaInicial: string) {
  await page.goto('/#/login')
  await page.locator('#usuario').fill(usuario)
  await page.locator('#senha').fill('qualquer-senha')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: telaInicial })).toBeVisible()
}

for (const tema of ['claro', 'escuro'] as const) {
  test.describe(`tema ${tema}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((valor) => localStorage.setItem('aguas-do-capibaribe:tema', valor), tema)
    })

    test('telas abertas: acesso e aviso de privacidade', async ({ page, context }, testInfo) => {
      await instalarApiFalsa(context)
      await page.goto('/#/login')
      await expect(page.getByRole('heading', { name: 'Acesse sua lavanderia' })).toBeVisible()
      await auditar(page, testInfo, `acesso-${tema}`)

      await page.goto('/#/privacidade')
      await expect(page.getByRole('heading', { name: 'Aviso de privacidade' })).toBeVisible()
      await auditar(page, testInfo, `privacidade-${tema}`)
    })

    test('operador: registro de lote, resultado com o gauge e histórico', async ({ page, context }, testInfo) => {
      await instalarApiFalsa(context)
      await entrar(page, 'operador.teste', 'Registro de lote')
      await auditar(page, testInfo, `registro-${tema}`)

      const valor = await page.locator('#processo option', { hasText: 'Estonagem' }).getAttribute('value')
      await page.locator('#processo').selectOption(valor!)
      await page.locator('#pecas').fill('100')
      await page.locator('#litros').fill('1150')
      await page.getByRole('button', { name: 'Registrar lote' }).click()
      await page.getByRole('button', { name: 'Confirmar registro' }).click()
      await expect(page.getByRole('heading', { name: 'Lote 1 registrado' })).toBeVisible()
      await auditar(page, testInfo, `resultado-${tema}`)

      await page.goto('/#/historico')
      await expect(page.getByRole('heading', { name: /Histórico/ })).toBeVisible()
      await auditar(page, testInfo, `historico-${tema}`)
    })

    test('gestor: dashboard e relatórios', async ({ page, context }, testInfo) => {
      await instalarApiFalsa(context, { perfil: 'gestor' })
      await entrar(page, 'gestor.teste', 'Dashboard')
      await auditar(page, testInfo, `dashboard-${tema}`)

      await page.goto('/#/relatorios')
      await expect(page.getByRole('heading', { name: /Relatório/ })).toBeVisible()
      await auditar(page, testInfo, `relatorios-${tema}`)
    })
  })
}
