import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { instalarApiFalsa } from './apiFalsa'

/*
 * Background Sync (issue #160), no site de produÃ§Ã£o: o operador registra um lote sem conexÃ£o e fecha a aba;
 * quando a rede volta, o service worker envia o lote sozinho.
 *
 * O Chrome dispara o evento `sync` quando a conexÃ£o volta; aqui ele Ã© disparado pelo DevTools Protocol
 * (ServiceWorker.dispatchSyncEvent), o mesmo caminho do botÃ£o "Sync" do painel Application do DevTools.
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

/** LÃª uma store do IndexedDB do site. */
const lerBanco = (page: Page, store: 'credencial' | 'lotesPendentes') =>
  page.evaluate(
    (nome) =>
      new Promise<unknown[]>((ok, erro) => {
        const req = indexedDB.open('aguas-offline')
        req.onerror = () => erro(req.error)
        req.onsuccess = () => {
          const db = req.result
          const todos = db.transaction(nome).objectStore(nome).getAll()
          todos.onsuccess = () => {
            db.close()
            ok(todos.result)
          }
        }
      }),
    store,
  )

/** Dispara o `sync-lotes` no service worker do site, como o navegador faz quando a rede volta. */
async function dispararSync(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page)
  const registro = new Promise<string>((ok) => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const r = registrations.find((x) => !x.isDeleted)
      if (r) ok(r.registrationId)
    })
  })
  await cdp.send('ServiceWorker.enable')
  const origin = new URL(page.url()).origin
  await cdp.send('ServiceWorker.dispatchSyncEvent', { origin, registrationId: await registro, tag: 'sync-lotes', lastChance: false })
}

test('aba fechada: quando a rede volta, o service worker envia o lote guardado e apaga o token', async ({ context }) => {
  const api = await instalarApiFalsa(context)
  const page = await context.newPage()
  await entrar(page)
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))

  // --- a Wi-Fi cai e o operador registra um lote ---
  api.rede = 'fora'
  await context.setOffline(true)
  await registrar(page, 'Amaciamento', 50, 780)
  await expect(page.getByTestId('resultado-pendente')).toContainText('Lote guardado neste aparelho')

  // O site pediu o Background Sync e deixou o token para o service worker.
  await expect.poll(() => lerBanco(page, 'credencial')).toEqual([expect.objectContaining({ token: 'token-de-teste', usuarioId: 3 })])

  // --- o operador fecha a aba; a Wi-Fi volta ---
  await page.close()
  api.rede = 'ok'
  await context.setOffline(false)

  // Outra aba do site, sem ninguÃ©m logado: quem envia Ã© o service worker, nÃ£o a pÃ¡gina.
  const outra = await context.newPage()
  await outra.goto('/')
  await expect(outra.locator('#usuario')).toBeVisible()
  await dispararSync(context, outra)

  await expect.poll(() => api.lotes.map((l) => [l.processoId, l.pecas, l.litros]), { timeout: 15_000 }).toEqual([[1, 50, 780]])
  await expect.poll(() => lerBanco(outra, 'lotesPendentes')).toEqual([])
  // Fila vazia: o token saiu do aparelho.
  await expect.poll(() => lerBanco(outra, 'credencial')).toEqual([])
  expect(new Set(api.postsRecebidos).size).toBe(api.postsRecebidos.length)
})
