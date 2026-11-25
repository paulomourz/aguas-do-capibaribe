import { describe, expect, it } from 'vitest'
import { custoDoMes, fmtReais, precoVigente } from '..'
import type { Lote, PrecoM3 } from '../tipos'

/* Preço do m³: vale o de maior vigência até o dia; na mesma vigência, o cadastrado por último. */
const preco = (id: string, valor: number, vigencia: string, cadastradoEm: string): PrecoM3 => ({
  id,
  valor,
  vigencia,
  cadastradoPor: 'Gestora',
  cadastradoEm: new Date(cadastradoEm),
})

describe('preço do m³ vigente', () => {
  const historico = [
    preco('1', 7, '2026-01-01', '2026-01-02T10:00:00Z'),
    preco('3', 9.5, '2026-11-01', '2026-11-20T10:00:00Z'),
    preco('2', 9, '2026-11-01', '2026-11-05T10:00:00Z'),
    preco('4', 11, '2026-12-01', '2026-11-21T10:00:00Z'),
  ]

  it('sem preço cadastrado não há vigente', () => {
    expect(precoVigente([], '2026-11-24')).toBeUndefined()
  })

  it('antes da primeira vigência não há vigente', () => {
    expect(precoVigente(historico, '2025-12-31')).toBeUndefined()
  })

  it('vale o de maior vigência até o dia, inclusive o próprio dia', () => {
    expect(precoVigente(historico, '2026-10-31')?.id).toBe('1')
    expect(precoVigente(historico, '2026-11-01')?.valor).toBe(9.5)
  })

  it('na mesma vigência vence o cadastrado por último', () => {
    expect(precoVigente(historico, '2026-11-24')?.id).toBe('3')
  })

  it('vigência futura ainda não vale', () => {
    expect(precoVigente(historico, '2026-11-30')?.id).toBe('3')
    expect(precoVigente(historico, '2026-12-01')?.id).toBe('4')
  })
})

/* Custo do mês: cada lote no preço vigente na sua data em Recife; excesso sem compensação. */
const lote = (id: string, processoId: string, litros: number, esperado: number, data: string): Lote => ({
  id,
  processoId,
  pecas: 10,
  litros,
  esperado,
  desvio: 0,
  status: 'ok',
  data: new Date(data),
  usuarioId: 'u1',
})

describe('custo do mês', () => {
  it('sem preço nenhum o custo fica ausente e todos os lotes contam como sem preço', () => {
    const r = custoDoMes([lote('a', 'p1', 1000, 800, '2026-11-10T12:00:00Z'), lote('b', 'p1', 500, 600, '2026-11-11T12:00:00Z')], [])
    expect(r.consumo).toBe(1500)
    expect(r.excesso).toBe(200)
    expect(r.custo).toBeNull()
    expect(r.custoExcesso).toBeNull()
    expect(r.semPreco).toBe(2)
  })

  it('um preço só cobre o mês todo: litros ÷ 1000 × preço do m³', () => {
    const r = custoDoMes(
      [lote('a', 'p1', 2000, 2000, '2026-11-01T12:00:00Z'), lote('b', 'p1', 500, 500, '2026-11-30T12:00:00Z')],
      [preco('1', 10, '2026-01-01', '2026-01-01T10:00:00Z')],
    )
    expect(r.custo).toBeCloseTo(25)
    expect(r.semPreco).toBe(0)
  })

  it('preço que muda no meio do mês: cada lote no seu preço', () => {
    const r = custoDoMes(
      [lote('a', 'p1', 1000, 1000, '2026-11-14T12:00:00Z'), lote('b', 'p1', 1000, 1000, '2026-11-15T12:00:00Z')],
      [preco('1', 10, '2026-01-01', '2026-01-01T10:00:00Z'), preco('2', 12, '2026-11-15', '2026-11-10T10:00:00Z')],
    )
    expect(r.custo).toBeCloseTo(22)
  })

  it('duas vigências na mesma data: vence o cadastrado por último', () => {
    const r = custoDoMes(
      [lote('a', 'p1', 1000, 1000, '2026-11-20T12:00:00Z')],
      [preco('2', 99, '2026-11-01', '2026-11-02T10:00:00Z'), preco('1', 9, '2026-11-01', '2026-11-03T10:00:00Z')],
    )
    expect(r.custo).toBeCloseTo(9)
  })

  it('vigência futura não vale no mês atual', () => {
    const r = custoDoMes(
      [lote('a', 'p1', 1000, 1000, '2026-11-20T12:00:00Z')],
      [preco('1', 8, '2026-01-01', '2026-01-01T10:00:00Z'), preco('2', 20, '2026-12-01', '2026-11-21T10:00:00Z')],
    )
    expect(r.custo).toBeCloseTo(8)
  })

  it('primeiro preço no meio do mês: lotes anteriores ficam sem preço e o total soma só os demais', () => {
    const r = custoDoMes(
      [lote('a', 'p1', 1000, 500, '2026-11-05T12:00:00Z'), lote('b', 'p1', 3000, 1000, '2026-11-20T12:00:00Z')],
      [preco('1', 10, '2026-11-15', '2026-11-15T10:00:00Z')],
    )
    expect(r.consumo).toBe(4000)
    expect(r.custo).toBeCloseTo(30)
    expect(r.custoExcesso).toBeCloseTo(20)
    expect(r.semPreco).toBe(1)
  })

  it('lote abaixo da meta não compensa o lote acima', () => {
    const r = custoDoMes(
      [lote('a', 'p1', 1500, 1000, '2026-11-05T12:00:00Z'), lote('b', 'p1', 400, 1000, '2026-11-06T12:00:00Z')],
      [preco('1', 10, '2026-01-01', '2026-01-01T10:00:00Z')],
    )
    expect(r.excesso).toBe(500)
    expect(r.custoExcesso).toBeCloseTo(5)
  })

  it('mês sem lote acima da meta tem custo do excesso zero', () => {
    const r = custoDoMes([lote('a', 'p1', 400, 1000, '2026-11-06T12:00:00Z')], [preco('1', 10, '2026-01-01', '2026-01-01T10:00:00Z')])
    expect(r.custoExcesso).toBe(0)
  })

  it('lote às 23h30 do último dia do mês em Recife usa o preço da data local', () => {
    // 30/11 23h30 em Recife (UTC−3) já é 01/12 em UTC.
    const r = custoDoMes(
      [lote('a', 'p1', 1000, 1000, '2026-12-01T02:30:00Z')],
      [preco('1', 10, '2026-01-01', '2026-01-01T10:00:00Z'), preco('2', 50, '2026-12-01', '2026-11-20T10:00:00Z')],
    )
    expect(r.custo).toBeCloseTo(10)
  })

  it('agrega por processo', () => {
    const r = custoDoMes(
      [
        lote('a', 'p1', 1000, 800, '2026-11-05T12:00:00Z'),
        lote('b', 'p2', 2000, 2500, '2026-11-06T12:00:00Z'),
        lote('c', 'p1', 3000, 2000, '2026-11-07T12:00:00Z'),
      ],
      [preco('1', 10, '2026-01-01', '2026-01-01T10:00:00Z')],
    )
    const p1 = r.porProcesso.find((p) => p.processoId === 'p1')!
    const p2 = r.porProcesso.find((p) => p.processoId === 'p2')!
    expect(r.porProcesso).toHaveLength(2)
    expect([p1.consumo, p1.custo, p1.excesso, p1.custoExcesso]).toEqual([4000, 40, 1200, 12])
    expect([p2.consumo, p2.custo, p2.excesso, p2.custoExcesso]).toEqual([2000, 20, 0, 0])
  })
})

describe('reais no formato brasileiro', () => {
  it('usa R$, ponto de milhar e vírgula com 2 casas', () => {
    expect(fmtReais(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
    expect(fmtReais(0).replace(/\s/g, ' ')).toBe('R$ 0,00')
  })
})
