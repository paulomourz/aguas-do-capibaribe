import { expect, test, type Page } from '@playwright/test'
import { instalarApiFalsa } from './apiFalsa'

/*
 * Issue #139: litros com ponto de milhar ("1.590") viravam 2 L. Achado na avaliação simulada da #50, numa tela de
 * celular, onde o campo estreito ainda escondia o número.
 */

test.use({ viewport: { width: 390, height: 844 } })

async function entrar(page: Page) {
  await page.goto('/')
  await page.locator('#usuario').fill('operador.teste')
  await page.locator('#senha').fill('qualquer-senha')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Registro de lote' })).toBeVisible()
}

async function preencher(page: Page, pecas: string, litros: string) {
  const valor = await page.locator('#processo option', { hasText: 'Amaciamento' }).getAttribute('value')
  await page.locator('#processo').selectOption(valor!)
  await page.locator('#pecas').fill(pecas)
  await page.locator('#litros').fill(litros)
  await page.getByRole('button', { name: 'Registrar lote' }).click()
}

test('"1.590" é mil quinhentos e noventa litros, na confirmação e no que vai para a API', async ({ page, context }) => {
  const api = await instalarApiFalsa(context)
  await entrar(page)
  await preencher(page, '1.200', '1.590')

  const modal = page.getByRole('dialog')
  await expect(modal).toContainText('1.590 L')
  await expect(modal).toContainText('1.200')
  await page.getByRole('button', { name: 'Confirmar registro' }).click()
  await expect(page.getByText('Lote 1 registrado')).toBeVisible()
  expect(api.lotes[0]).toMatchObject({ pecas: 1200, litros: 1590 })
})

test('ponto ambíguo ("1.59") é recusado com mensagem, sem abrir a confirmação', async ({ page, context }) => {
  const api = await instalarApiFalsa(context)
  await entrar(page)
  await preencher(page, '30', '1.59')

  await expect(page.getByText('Digite só o número de litros, por exemplo 920 ou 1.590.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#litros')).toBeFocused()
  expect(api.postsRecebidos).toHaveLength(0)
})

test('no celular, o campo de litros mostra o número inteiro', async ({ page, context }) => {
  await instalarApiFalsa(context)
  await entrar(page)
  await page.locator('#litros').fill('12.345')
  // O texto cabe na caixa: nada escondido atrás do sufixo "litros" nem de setas.
  const cabe = await page.locator('#litros').evaluate((el: HTMLInputElement) => el.scrollWidth <= el.clientWidth)
  expect(cabe).toBe(true)
})
