import { expect, test, type Page } from '@playwright/test'
import { instalarApiFalsa } from './apiFalsa'

/*
 * Queda e volta da Wi-Fi da lavanderia, no site de produção (service worker + IndexedDB).
 * A "Wi-Fi" cai de verdade para o navegador (context.setOffline: navigator.onLine e eventos online/offline)
 * e a API falsa deixa de responder.
 */

async function entrar(page: Page) {
  await page.goto('/')
  await page.locator('#usuario').fill('operador.teste')
  await page.locator('#senha').fill('qualquer-senha')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Registro de lote' })).toBeVisible()
}

async function registrar(page: Page, processo: string, pecas: number, litros: number) {
  const valor = await page.locator('#processo option', { hasText: processo }).getAttribute('value')
  await page.locator('#processo').selectOption(valor!)
  await page.locator('#pecas').fill(String(pecas))
  await page.locator('#litros').fill(String(litros))
  await page.getByRole('button', { name: 'Registrar lote' }).click()
  await page.getByRole('button', { name: 'Confirmar registro' }).click()
}

const indicador = (page: Page) => page.getByTestId('indicador-conexao')
const pendentes = (page: Page) => page.getByTestId('pendente')

test('a Wi-Fi cai: lotes ficam guardados, sobrevivem a recarregar a página e vão sozinhos quando ela volta', async ({ page, context }) => {
  const api = await instalarApiFalsa(context)
  await entrar(page)
  // O service worker precisa estar ativo para o site abrir sem conexão.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))

  // --- a Wi-Fi cai ---
  api.rede = 'fora'
  await context.setOffline(true)
  await expect(indicador(page)).toContainText('Sem conexão')

  await registrar(page, 'Amaciamento', 50, 780)
  await expect(page.getByTestId('resultado-pendente')).toContainText('Lote guardado neste aparelho')
  await page.getByRole('button', { name: 'Registrar novo lote' }).click()
  await registrar(page, 'Estonagem', 10, 130)
  await expect(pendentes(page)).toHaveCount(2)
  await expect(indicador(page)).toContainText('Sem conexão · 2 lotes guardados')
  expect(api.postsRecebidos).toHaveLength(0)

  // --- recarrega a página ainda sem conexão: abre pelo service worker, com a fila do IndexedDB ---
  await page.reload()
  await expect(page.getByText('Sem conexão com o servidor')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Registro de lote' })).toBeVisible()
  await expect(pendentes(page)).toHaveCount(2)
  // E ainda dá para registrar mais um, com os processos guardados.
  await registrar(page, 'Amaciamento', 40, 760)
  await expect(pendentes(page)).toHaveCount(3)

  // --- a Wi-Fi volta ---
  api.rede = 'ok'
  await context.setOffline(false)
  await expect(pendentes(page)).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByText('3 lotes guardados foram enviados')).toBeVisible()
  await expect(indicador(page)).toHaveCount(0)
  await expect(page.getByText('Sem conexão com o servidor')).toHaveCount(0)

  // Chegaram uma vez cada, na ordem em que foram feitos.
  expect(api.lotes.map((l) => [l.processoId, l.pecas, l.litros])).toEqual([
    [1, 50, 780],
    [2, 10, 130],
    [1, 40, 760],
  ])
  expect(new Set(api.postsRecebidos).size).toBe(api.postsRecebidos.length)
})

test('a resposta se perde no caminho: o servidor grava, o site reenvia com a mesma chave e não duplica', async ({ page, context }) => {
  const api = await instalarApiFalsa(context)
  await entrar(page)

  api.rede = 'perdeResposta'
  await registrar(page, 'Estonagem', 100, 1290)
  await expect(page.getByTestId('resultado-pendente')).toBeVisible()
  await expect(pendentes(page)).toHaveCount(1)
  expect(api.lotes).toHaveLength(1) // o servidor já tem o lote, o site ainda não sabe

  api.rede = 'ok'
  await page.getByRole('button', { name: 'Enviar agora' }).click()
  await expect(pendentes(page)).toHaveCount(0)

  // O cartão "guardado" vira o resultado oficial, com o desvio calculado pelo servidor.
  await expect(page.getByRole('heading', { name: 'Lote 1 registrado' })).toBeVisible()
  await expect(page.getByText('+7,5%').or(page.getByText('7,5%'))).toBeVisible()

  expect(api.lotes).toHaveLength(1)
  expect(api.postsRecebidos).toHaveLength(2)
  expect(api.postsRecebidos[0]).toBe(api.postsRecebidos[1])
  expect(api.postsRecebidos[0]).toMatch(/^[0-9a-f-]{36}$/)
})

test('com conexão boa nada muda: registra direto, sem fila', async ({ page, context }) => {
  const api = await instalarApiFalsa(context)
  await entrar(page)
  await registrar(page, 'Amaciamento', 50, 760)
  await expect(page.getByRole('heading', { name: 'Lote 1 registrado' })).toBeVisible()
  await expect(page.getByTestId('painel-pendentes')).toHaveCount(0)
  await expect(indicador(page)).toHaveCount(0)
  expect(api.postsRecebidos).toHaveLength(1)
})
