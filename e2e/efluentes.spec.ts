import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { instalarApiFalsa } from './apiFalsa'

/*
 * Descarte de efluentes no Histórico (issue #202):
 *   Given o gestor no Histórico com um lote registrado,
 *   When abre "Descartes" do lote e registra um descarte válido,
 *   Then o descarte aparece na lista na hora; com o pH fora da faixa, o campo mostra o erro e nada é enviado.
 */

/** Violações sérias ou críticas do WCAG 2.1 AA dentro da janela, depois da animação de entrada. */
async function violacoesDaJanela(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
  const r = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)
}

test('gestor registra o descarte de efluentes de um lote pelo Histórico', async ({ page, context }) => {
  const api = await instalarApiFalsa(context, { perfil: 'gestor' })
  api.lotes.push({
    id: 1, processoId: 1, pecas: 100, litros: 780, esperado: 800, desvio: -2.5,
    statusConformidade: 'DENTRO_DA_META', data: new Date().toISOString(), usuarioId: 3,
  })

  await page.goto('/#/login')
  await page.locator('#usuario').fill('gestor.teste')
  await page.locator('#senha').fill('qualquer-senha')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.goto('/#/historico')

  await page.getByRole('button', { name: 'Descartes do lote 1' }).first().click()
  const janela = page.getByRole('dialog', { name: 'Descarte de efluentes' })
  await expect(janela.getByText('Nenhum descarte registrado')).toBeVisible()
  expect(await violacoesDaJanela(page)).toEqual([])

  await janela.getByRole('button', { name: 'Registrar descarte' }).click()
  await janela.getByLabel('Volume descartado').fill('350,5')
  await janela.getByLabel('pH').fill('15')
  await janela.getByLabel('Turbidez').fill('40')
  await janela.getByRole('button', { name: 'Salvar descarte' }).click()
  await expect(janela.getByText('O pH vai de 0 a 14.')).toBeVisible()
  expect(api.descartes).toHaveLength(0)
  expect(await violacoesDaJanela(page)).toEqual([])

  await janela.getByLabel('pH').fill('7,2')
  await janela.getByLabel('Água reaproveitada').fill('30')
  await janela.getByRole('button', { name: 'Salvar descarte' }).click()
  await expect(page.getByText('Descarte registrado.')).toBeVisible()
  await expect(janela.getByRole('list', { name: 'Descartes do lote' })).toContainText('350,5 L')
  await expect(janela.getByRole('list', { name: 'Descartes do lote' })).toContainText('30%')
  expect(api.descartes).toEqual([expect.objectContaining({ loteId: 1, volumeLitros: 350.5, ph: 7.2, turbidezNtu: 40, reutilizadoPercentual: 30 })])
})

/*
 * pH fora da faixa de lançamento (issue #213):
 *   Given o gestor na janela de descartes de um lote,
 *   When registra um descarte com pH 9,5 (aceito pelo sistema, de 0 a 14, mas fora de 5 a 9 da CONAMA 430),
 *   Then a lista mostra o aviso "fora de 5 a 9" só nesse descarte, e não no descarte com pH 7.
 */
test('descarte com pH fora de 5 a 9 aparece com o aviso da CONAMA 430', async ({ page, context }) => {
  const api = await instalarApiFalsa(context, { perfil: 'gestor' })
  api.lotes.push({
    id: 1, processoId: 1, pecas: 100, litros: 780, esperado: 800, desvio: -2.5,
    statusConformidade: 'DENTRO_DA_META', data: new Date().toISOString(), usuarioId: 3,
  })

  await page.goto('/#/login')
  await page.locator('#usuario').fill('gestor.teste')
  await page.locator('#senha').fill('qualquer-senha')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.goto('/#/historico')

  await page.getByRole('button', { name: 'Descartes do lote 1' }).first().click()
  const janela = page.getByRole('dialog', { name: 'Descarte de efluentes' })
  const lista = janela.getByRole('list', { name: 'Descartes do lote' })

  for (const [volume, ph] of [['200', '7'], ['150', '9,5']]) {
    await janela.getByRole('button', { name: 'Registrar descarte' }).click()
    await janela.getByLabel('Volume descartado').fill(volume)
    await janela.getByLabel('pH').fill(ph)
    await janela.getByLabel('Turbidez').fill('40')
    await janela.getByRole('button', { name: 'Salvar descarte' }).click()
    await expect(lista).toContainText(`${volume} L`)
  }

  const itens = lista.getByRole('listitem')
  await expect(itens).toHaveCount(2)
  await expect(itens.filter({ hasText: '150 L' })).toContainText('fora de 5 a 9')
  await expect(itens.filter({ hasText: '200 L' })).not.toContainText('fora de 5 a 9')
  expect(api.descartes.map((d) => d.ph)).toEqual([7, 9.5])
  expect(await violacoesDaJanela(page)).toEqual([])
})
