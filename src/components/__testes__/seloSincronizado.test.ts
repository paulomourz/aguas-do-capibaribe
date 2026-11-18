import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Selo "Sincronizado" no cabeçalho (issue #160): aparece por alguns segundos quando a fila chega ao servidor,
 * pela página ou pelo service worker, e nunca esconde um estado que pede atenção (sem conexão, recusado).
 */

const estado = vi.hoisted(() => ({
  pendentes: [] as { chave: string; estado: 'pendente' | 'recusado' }[],
  conectado: true,
  modoOffline: false,
  sincronizando: false,
  sincronizado: false,
}))

vi.mock('../../store', () => ({ useApp: () => estado }))

const { IndicadorConexao } = await import('../FilaOffline')
const render = () => renderToStaticMarkup(h(IndicadorConexao))

beforeEach(() => {
  Object.assign(estado, { pendentes: [], conectado: true, modoOffline: false, sincronizando: false, sincronizado: false })
})

describe('IndicadorConexao', () => {
  it('tudo em dia e nada recém-enviado: não mostra nada', () => {
    expect(render()).toBe('')
  })

  it('fila acabou de ser enviada: mostra o selo de sincronizado, anunciado ao leitor de tela', () => {
    estado.sincronizado = true
    const html = render()
    expect(html).toContain('data-testid="selo-sincronizado"')
    expect(html).toContain('Sincronizado')
    expect(html).toMatch(/<output[^>]*aria-live="polite"/)
  })

  it('sem conexão ou com lote recusado, o aviso tem prioridade sobre o selo', () => {
    estado.sincronizado = true
    estado.conectado = false
    expect(render()).not.toContain('selo-sincronizado')
    expect(render()).toContain('Sem conexão')

    estado.conectado = true
    estado.pendentes = [{ chave: 'a', estado: 'recusado' }]
    expect(render()).not.toContain('selo-sincronizado')
    expect(render()).toContain('1 lote recusado')
  })
})
