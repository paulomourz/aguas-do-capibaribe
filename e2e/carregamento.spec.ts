import { expect, test, type Page } from '@playwright/test'
import { instalarApiFalsa } from './apiFalsa'

/*
 * Skeleton screens (issue #161): com a conexão lenta, as telas do gestor mostram esqueletos no formato dos cards e
 * dos gráficos enquanto os dados chegam, e a troca do esqueleto pelo conteúdo não pode empurrar a tela: o CLS
 * (Cumulative Layout Shift, Core Web Vitals) tem que ficar abaixo de 0,1, no computador e no celular.
 *
 * A rede é limitada como um 3G (perfil "Slow 3G" do Chrome DevTools) e a API falsa ainda segura cada resposta por
 * ATRASO_API, para dar tempo de ver e medir os esqueletos. O CLS aqui é a soma de todos os deslocamentos sem
 * interação recente, o que é mais rígido que a métrica oficial (que considera só a pior janela de 5 s).
 */

const ATRASO_API = 1_500
const LIMITE_CLS = 0.1

const TELAS = [
  { nome: 'computador', uso: {} },
  { nome: 'celular', uso: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
]

async function entrarComoGestor(page: Page) {
  await page.goto('/#/login')
  await page.locator('#usuario').fill('gestor.teste')
  await page.locator('#senha').fill('qualquer-senha')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

/** Liga a rede lenta: atraso em cada resposta da API e o perfil de 3G do Chrome. */
async function conexaoLenta(page: Page) {
  await page.context().route('**/api/**', async (route) => {
    await new Promise((r) => setTimeout(r, ATRASO_API))
    await route.fallback()
  })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
  })
}

type Medicao = { __cls: number; __deslocamentos: string[] }
type Deslocamento = PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] }

/** Soma os deslocamentos de layout desde o carregamento da página (registrado antes de qualquer script dela). */
async function medirCls(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Medicao
    w.__cls = 0
    w.__deslocamentos = []
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries() as Deslocamento[]) {
        if (e.hadRecentInput) continue
        w.__cls += e.value
        const nos = (e.sources ?? []).map((s) => (s.node instanceof Element ? `${s.node.tagName.toLowerCase()}.${[...s.node.classList].slice(0, 3).join('.')}` : String(s.node?.nodeName)))
        w.__deslocamentos.push(`${e.value.toFixed(4)} ${nos.join(', ')}`)
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
  return async () => {
    // Espera as animações finitas (entrada das barras, fade) terminarem antes de ler o resultado.
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
    )
    return page.evaluate(() => {
      const w = window as unknown as Medicao
      return { cls: w.__cls, deslocamentos: w.__deslocamentos }
    })
  }
}

for (const tela of TELAS) {
  test.describe(`carregamento com conexão lenta (${tela.nome})`, () => {
    test.use(tela.uso)

    test.beforeEach(async ({ page, context }) => {
      // Sem animação de entrada: o teste mede o layout, não a coreografia.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await instalarApiFalsa(context, { perfil: 'gestor' })
      await entrarComoGestor(page)
    })

    test('dashboard mostra esqueletos dos cards e gráficos e não salta (CLS < 0,1)', async ({ page }) => {
      const resultado = await medirCls(page)
      await conexaoLenta(page)
      await page.reload()

      const indicadores = page.getByRole('region', { name: 'Indicadores do mês' })
      await expect(indicadores.getByTestId('skeleton-card')).toHaveCount(4)
      await expect(page.getByTestId('skeleton-chart')).toHaveCount(2)
      await expect(page.getByRole('status').filter({ hasText: 'Carregando indicadores' })).toBeAttached()

      await expect(page.getByText('Consumo total do mês')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('img', { name: /Gráfico de barras meta versus real/ })).toBeVisible()
      await expect(page.locator('figure', { hasText: 'Esperado pela meta' }).locator('.recharts-surface')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId('skeleton-chart')).toHaveCount(0)

      const { cls, deslocamentos } = await resultado()
      expect(cls, `Deslocamentos:\n${deslocamentos.join('\n')}`).toBeLessThan(LIMITE_CLS)
    })

    test('relatórios mostram esqueleto dos gráficos e não saltam (CLS < 0,1)', async ({ page }) => {
      await page.goto('/#/relatorios')
      await expect(page.getByRole('heading', { name: /Relatório/ })).toBeVisible()
      const resultado = await medirCls(page)
      await conexaoLenta(page)
      await page.reload()

      await expect(page.getByTestId('skeleton-chart').first()).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('.recharts-surface')).toHaveCount(2, { timeout: 30_000 })
      await expect(page.getByTestId('skeleton-chart')).toHaveCount(0)

      const { cls, deslocamentos } = await resultado()
      expect(cls, `Deslocamentos:\n${deslocamentos.join('\n')}`).toBeLessThan(LIMITE_CLS)
    })
  })
}
