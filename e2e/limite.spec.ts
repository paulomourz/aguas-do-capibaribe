import { expect, test, type Page } from '@playwright/test'
import { instalarApiFalsa } from './apiFalsa'

/*
 * Erro 429 com contagem regressiva (issue #101, RNF19). A API falsa responde 429 com Retry-After: 30, como o
 * FiltroDeLimite real; o relógio da página é controlado para passar os 30 segundos sem esperar.
 */

const botaoEntrar = (page: Page) => page.locator('form button[type="submit"]')

test('login: com 429 e Retry-After 30, o botão fica desabilitado com contagem e não dispara de novo', async ({ page, context }) => {
  const api = await instalarApiFalsa(context)
  await page.clock.install()
  await page.goto('/')
  await page.locator('#usuario').fill('operador.teste')
  await page.locator('#senha').fill('qualquer-senha')

  api.limite.login = 30
  await botaoEntrar(page).click()

  const aviso = page.getByTestId('aviso-limite')
  await expect(aviso).toContainText('Muitas tentativas de entrar')
  await expect(aviso).toContainText(/Tente de novo em (30|29) segundos/)
  await expect(botaoEntrar(page)).toBeDisabled()
  await expect(botaoEntrar(page)).toHaveText(/^Aguarde (30|29) segundos$/)

  // O relógio da página continua andando sozinho; depois de +10 s, faltam no máximo 20.
  await page.clock.runFor(10_000)
  await expect(async () => {
    const n = Number((await botaoEntrar(page).textContent())?.match(/\d+/)?.[0])
    expect(n).toBeLessThanOrEqual(20)
    expect(n).toBeGreaterThan(0)
  }).toPass()
  // Enter no campo também não manda outro pedido enquanto conta.
  await page.locator('#senha').press('Enter')
  expect(api.loginsRecebidos).toBe(1)

  // Acabou a espera: o botão volta e o login passa.
  api.limite.login = undefined
  await page.clock.runFor(20_000)
  await expect(aviso).toBeHidden()
  await expect(botaoEntrar(page)).toBeEnabled()
  await botaoEntrar(page).click()
  await expect(page.getByRole('heading', { name: 'Registro de lote' })).toBeVisible()
  expect(api.loginsRecebidos).toBe(2)
})

test('lotes: com 429, o lote fica guardado, o registro espera a contagem e o envio volta sozinho', async ({ page, context }) => {
  const api = await instalarApiFalsa(context)
  await page.clock.install()
  await page.goto('/')
  await page.locator('#usuario').fill('operador.teste')
  await page.locator('#senha').fill('qualquer-senha')
  await botaoEntrar(page).click()
  await expect(page.getByRole('heading', { name: 'Registro de lote' })).toBeVisible()

  api.limite.lotes = 30
  const valor = await page.locator('#processo option', { hasText: 'Amaciamento' }).getAttribute('value')
  await page.locator('#processo').selectOption(valor!)
  await page.locator('#pecas').fill('50')
  await page.locator('#litros').fill('780')
  await page.getByRole('button', { name: 'Registrar lote' }).click()
  await page.getByRole('button', { name: 'Confirmar registro' }).click()

  // Não é falta de conexão: o lote fica na fila e o aviso fala da pausa pedida pelo servidor.
  await expect(page.getByTestId('resultado-pendente')).toContainText('O servidor pediu uma pausa')
  await expect(page.getByTestId('indicador-conexao')).not.toContainText('Sem conexão')
  const enviarAgora = page.getByTestId('painel-pendentes').getByRole('button', { name: /Aguarde \d+ segundos/ })
  await expect(enviarAgora).toBeDisabled()
  expect(api.postsRecebidos).toHaveLength(1)

  await page.getByRole('button', { name: 'Registrar novo lote' }).click()
  const registrar = page.locator('form button[type="submit"]')
  await expect(registrar).toBeDisabled()
  await expect(registrar).toHaveText(/Aguarde \d+ segundos/)
  await expect(page.getByTestId('aviso-limite')).toContainText('Muitos lotes em pouco tempo')

  // Fim da espera: a fila envia sozinha, sem duplicar (mesma Idempotency-Key).
  api.limite.lotes = undefined
  await page.clock.runFor(31_000)
  await expect(page.getByTestId('pendente')).toHaveCount(0)
  await expect(registrar).toBeEnabled()
  expect(api.lotes).toHaveLength(1)
  expect(new Set(api.postsRecebidos).size).toBe(1)
})
