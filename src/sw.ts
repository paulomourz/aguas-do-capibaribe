import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { tratarSync, type EventoSync } from './services/envioSegundoPlano'

/*
 * Service worker do site (compilado para sw.js pelo vite-plugin-pwa, estratégia injectManifest).
 *
 * 1. Casca do site para abrir sem conexão: o mesmo que o generateSW fazia antes (precache, index.html para
 *    as rotas do site, /api sempre pela rede, limpeza dos caches de versões antigas).
 * 2. Background Sync (issue #160): no evento `sync-lotes`, envia os lotes guardados no IndexedDB.
 *
 * Sem skipWaiting/clientsClaim: uma versão nova só assume quando todas as abas forem fechadas.
 */

// O tsconfig não inclui a lib WebWorker (ela conflita com a DOM); só o que este arquivo usa.
declare const self: {
  __WB_MANIFEST: Array<PrecacheEntry | string>
  addEventListener: (tipo: 'sync', f: (e: EventoSync) => void) => void
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

self.addEventListener('sync', (e) => tratarSync(e))
