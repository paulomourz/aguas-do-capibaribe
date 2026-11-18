import { describe, expect, it, vi } from 'vitest'
import { TAG_SYNC, type EventoSync } from '../envioSegundoPlano'

/*
 * O service worker (src/sw.ts, issue #160): guarda a casca do site como o generateSW fazia e escuta o evento
 * `sync` da Background Sync API. O Workbox é trocado por espiões; `self` é um service worker falso.
 */

const workbox = vi.hoisted(() => ({
  chamadas: [] as unknown[][],
  rotas: [] as unknown[],
  navegacao: [] as { handler: unknown; opcoes: { denylist?: RegExp[] } }[],
}))

vi.mock('workbox-precaching', () => ({
  cleanupOutdatedCaches: () => workbox.chamadas.push(['limpar']),
  precacheAndRoute: (m: unknown) => workbox.chamadas.push(['precache', m]),
  createHandlerBoundToURL: (url: string) => `handler:${url}`,
}))
vi.mock('workbox-routing', () => ({
  NavigationRoute: class {
    constructor(handler: unknown, opcoes: { denylist?: RegExp[] }) {
      workbox.navegacao.push({ handler, opcoes })
    }
  },
  registerRoute: (r: unknown) => workbox.rotas.push(r),
}))

const ouvintes: Record<string, (e: EventoSync) => void> = {}
const manifesto = [{ url: 'index.html', revision: 'abc' }]
vi.stubGlobal('self', {
  __WB_MANIFEST: manifesto,
  addEventListener: (tipo: string, f: (e: EventoSync) => void) => (ouvintes[tipo] = f),
})

await import('../../sw')

describe('service worker', () => {
  it('guarda os arquivos do build e limpa os caches de versões antigas', () => {
    expect(workbox.chamadas).toEqual([['limpar'], ['precache', manifesto]])
  })

  it('abre as rotas do site pelo index.html, mas a API vai sempre para a rede', () => {
    expect(workbox.rotas).toHaveLength(1)
    const [{ handler, opcoes }] = workbox.navegacao
    expect(handler).toBe('handler:index.html')
    const negada = (url: string) => opcoes.denylist?.some((r) => r.test(url))
    expect(negada('/api/lotes')).toBe(true)
    expect(negada('/registro')).toBe(false)
  })

  it('responde ao sync-lotes e ignora outras tags', () => {
    const outra = { tag: 'outra', waitUntil: vi.fn() }
    ouvintes.sync(outra)
    expect(outra.waitUntil).not.toHaveBeenCalled()

    const nossa = { tag: TAG_SYNC, waitUntil: vi.fn((p: Promise<unknown>) => p.catch(() => {})) }
    ouvintes.sync(nossa)
    expect(nossa.waitUntil).toHaveBeenCalledOnce()
  })
})
