import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

/*
 * Janela do descarte de efluentes no Histórico (issue #202), renderizada para HTML (react-dom/server), sem navegador.
 * O salvar e a validação são testados em services/__testes__/descartes.test.ts e domain/__testes__/descarte.test.ts.
 */

vi.mock('../../store', () => ({ useApp: () => ({ notificar: () => {} }) }))
vi.mock('../../services/descartes', () => ({ listarDescartes: () => new Promise(() => {}), salvarDescarte: vi.fn() }))

const { default: DescartesDoLote, LinhaDescarte } = await import('../DescartesDoLote')

const linha = (ph: number) =>
  renderToStaticMarkup(
    h(LinhaDescarte, {
      d: { id: 1, loteId: 10, data: '2026-11-23T15:00:00Z', volumeLitros: 1250.5, ph, turbidezNtu: 40, reutilizadoPercentual: 30 },
    }),
  )

describe('LinhaDescarte', () => {
  it('mostra volume, pH, turbidez e reaproveitamento no padrão brasileiro', () => {
    const html = linha(7.2)
    expect(html).toContain('1.250,5')
    expect(html).toContain('7,2')
    expect(html).toContain('40')
    expect(html).toContain('NTU')
    expect(html).toContain('30%')
    expect(html).not.toContain('fora de 5 a 9')
  })

  it('pH fora da faixa de lançamento da CONAMA 430 ganha o aviso em texto, não só em cor', () => {
    expect(linha(10.5)).toContain('(fora de 5 a 9)')
  })
})

describe('DescartesDoLote', () => {
  it('abre como diálogo com o lote no subtítulo e começa carregando', () => {
    const html = renderToStaticMarkup(h(DescartesDoLote, { loteId: 10, titulo: 'Lote 10 · Estonagem', onClose: () => {} }))
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Descarte de efluentes')
    expect(html).toContain('Lote 10 · Estonagem')
    expect(html).toContain('Carregando descartes')
    expect(html).toContain('Fechar')
  })
})
