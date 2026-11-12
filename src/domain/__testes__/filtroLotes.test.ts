import { describe, expect, it } from 'vitest'
import type { Lote } from '../tipos'
import { diaNoFusoDaLavanderia, filtrando, filtrarLotes, periodoInvalido } from '../filtroLotes'

/* Filtros do histórico de lotes (issue #107): período no fuso de Recife, processo e quem registrou. */

const lote = (id: string, data: string, p: Partial<Lote> = {}): Lote => ({
  id,
  processoId: '1',
  pecas: 10,
  litros: 100,
  esperado: 100,
  desvio: 0,
  status: 'ok',
  data: new Date(data),
  usuarioId: '7',
  ...p,
})

const lotes = [
  lote('a', '2026-10-01T11:00:00Z'), // 01/10 08:00 em Recife
  lote('b', '2026-10-11T01:30:00Z', { processoId: '2' }), // 10/10 22:30 em Recife (já é dia 11 em UTC)
  lote('c', '2026-10-31T23:00:00Z', { usuarioId: '8' }), // 31/10 20:00 em Recife
  lote('d', '2026-11-01T03:30:00Z'), // 01/11 00:30 em Recife
]

const ids = (l: Lote[]) => l.map((x) => x.id)

describe('filtrarLotes', () => {
  it('sem filtro devolve tudo, na mesma ordem', () => {
    expect(ids(filtrarLotes(lotes, {}))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('o mês de outubro inteiro, com os dias de Recife', () => {
    expect(ids(filtrarLotes(lotes, { de: '2026-10-01', ate: '2026-10-31' }))).toEqual(['a', 'b', 'c'])
  })

  it('um lote das 22h30 de Recife conta no dia 10, não no 11', () => {
    expect(ids(filtrarLotes(lotes, { de: '2026-10-10', ate: '2026-10-10' }))).toEqual(['b'])
    expect(ids(filtrarLotes(lotes, { de: '2026-10-11', ate: '2026-10-11' }))).toEqual([])
  })

  it('só a data inicial ou só a final', () => {
    expect(ids(filtrarLotes(lotes, { de: '2026-10-31' }))).toEqual(['c', 'd'])
    expect(ids(filtrarLotes(lotes, { ate: '2026-10-10' }))).toEqual(['a', 'b'])
  })

  it('processo e quem registrou, combinados com o período', () => {
    expect(ids(filtrarLotes(lotes, { processoId: '2' }))).toEqual(['b'])
    expect(ids(filtrarLotes(lotes, { usuarioId: '8' }))).toEqual(['c'])
    expect(ids(filtrarLotes(lotes, { usuarioId: '7', de: '2026-10-05', ate: '2026-11-30' }))).toEqual(['b', 'd'])
  })
})

describe('apoio da tela', () => {
  it('diaNoFusoDaLavanderia usa UTC-3', () => {
    expect(diaNoFusoDaLavanderia(new Date('2026-11-01T02:59:00Z'))).toBe('2026-10-31')
    expect(diaNoFusoDaLavanderia(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01')
  })

  it('período invertido e filtro ligado', () => {
    expect(periodoInvalido({ de: '2026-10-31', ate: '2026-10-01' })).toBe(true)
    expect(periodoInvalido({ de: '2026-10-01', ate: '2026-10-01' })).toBe(false)
    expect(filtrando({})).toBe(false)
    expect(filtrando({ usuarioId: '7' })).toBe(true)
  })
})
