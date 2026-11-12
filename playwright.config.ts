import { defineConfig, devices } from '@playwright/test'

/*
 * Testes ponta a ponta do modo offline e do fluxo completo do operador: o site de produção (com service worker)
 * contra uma API falsa criada dentro do teste (e2e/apiFalsa.ts), onde dá para derrubar e devolver a "Wi-Fi" à vontade.
 *   pnpm test:e2e
 */
const PORTA = 4173

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORTA}`,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm exec vite preview --port ${PORTA} --strictPort --host 127.0.0.1`,
    url: `http://localhost:${PORTA}`,
    env: { VITE_API_URL: '/api' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
