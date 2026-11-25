import { defineConfig } from 'vitest/config'

// Testes de unidade do site (fila offline e sincronização). Sem os plugins do Figma/PWA do vite.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
    // Cobertura (issue #168): pnpm test:cobertura grava coverage/lcov.info, lido pelo SonarQube.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__testes__/**', 'src/**/*.test.ts'],
      reporter: ['text-summary', 'lcov'],
    },
  },
})
