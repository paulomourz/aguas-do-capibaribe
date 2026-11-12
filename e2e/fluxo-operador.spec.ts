import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { instalarApiFalsa } from './apiFalsa'

/*
 * Fluxo completo do operador no chão de fábrica, do login ao lote registrado, com screenshot de cada passo.
 * As imagens ficam em test-results/ (no CI, no artefato "screenshots-e2e").
 *
 * Correspondência com a tarefa: a "seleção de máquina" é a escolha do processo executado na máquina
 * (o sistema não tem cadastro de máquinas); a "abertura do lote" é o preenchimento do novo lote; o
 * "encerramento" é a confirmação do registro, quando a API devolve o desvio.
 */

async function capturar(page: Page, testInfo: TestInfo, nome: string) {
  await page.screenshot({ path: testInfo.outputPath(`${nome}.png`), animations: 'disabled' })
}

test('operador entra, escolhe o processo da máquina, abre o lote e encerra o registro', async ({ page, context }, testInfo) => {
  const api = await instalarApiFalsa(context)

  await test.step('1. Login do operador', async () => {
    await page.goto('/')
    await page.locator('#usuario').fill('operador.teste')
    await page.locator('#senha').fill('qualquer-senha')
    await capturar(page, testInfo, '01-login')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Registro de lote' })).toBeVisible()
    await capturar(page, testInfo, '02-registro-de-lote')
  })

  await test.step('2. Seleção do processo executado na máquina', async () => {
    const valor = await page.locator('#processo option', { hasText: 'Estonagem' }).getAttribute('value')
    await page.locator('#processo').selectOption(valor!)
    await expect(page.getByText('12 litros por peça')).toBeVisible()
    await capturar(page, testInfo, '03-processo-selecionado')
  })

  await test.step('3. Abertura do lote', async () => {
    await page.locator('#pecas').fill('100')
    await page.locator('#litros').fill('1150')
    await expect(page.getByText('1.200 L')).toBeVisible() // consumo esperado: 12 L × 100 peças
    await capturar(page, testInfo, '04-lote-preenchido')
    await page.getByRole('button', { name: 'Registrar lote' }).click()
    await expect(page.getByRole('dialog', { name: 'Confirmar registro do lote' })).toBeVisible()
    await capturar(page, testInfo, '05-confirmacao')
  })

  await test.step('4. Encerramento do lote', async () => {
    await page.getByRole('button', { name: 'Confirmar registro' }).click()
    await expect(page.getByRole('heading', { name: 'Lote 1 registrado' })).toBeVisible()
    await expect(page.getByText('−4,2%')).toBeVisible()
    await expect(page.getByText('Consumo dentro da meta do processo.')).toBeVisible()
    await capturar(page, testInfo, '06-lote-registrado')
  })

  expect(api.lotes.map((l) => [l.processoId, l.pecas, l.litros])).toEqual([[2, 100, 1150]])
})
