import { defineConfig } from 'vitest/config'

// Testes de unidade do site (fila offline e sincronização). Sem os plugins do Figma/PWA do vite.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
  },
})
