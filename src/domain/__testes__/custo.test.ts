import { describe, expect, it } from 'vitest'
import { fmtReais, precoVigente } from '..'
import type { PrecoM3 } from '../tipos'

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

describe('reais no formato brasileiro', () => {
  it('usa R$, ponto de milhar e vírgula com 2 casas', () => {
    expect(fmtReais(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
    expect(fmtReais(0).replace(/\s/g, ' ')).toBe('R$ 0,00')
  })
})
