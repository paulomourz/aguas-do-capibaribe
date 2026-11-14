import { describe, expect, it } from 'vitest'
import { comparacaoComReferencia, fmtLitrosPorPeca, litrosPorPeca } from '../pegada'

// Issue #116: pegada hídrica por peça.
describe('pegada hídrica', () => {
  it('divide os litros pelas peças', () => {
    expect(litrosPorPeca(1200, 20)).toBe(60)
    expect(litrosPorPeca(100, 3)).toBeCloseTo(33.333, 3)
  })

  it('sem peças não há pegada', () => {
    expect(litrosPorPeca(100, 0)).toBeNull()
    expect(fmtLitrosPorPeca(null)).toBe('—')
  })

  it('mostra até 1 casa decimal, no padrão brasileiro', () => {
    expect(fmtLitrosPorPeca(60)).toBe('60')
    expect(fmtLitrosPorPeca(100 / 3)).toBe('33,3')
    expect(fmtLitrosPorPeca(1234.56)).toBe('1.234,6')
  })

  it('compara com a referência de 49 a 70 L por peça', () => {
    expect(comparacaoComReferencia(30)).toBe('abaixo')
    expect(comparacaoComReferencia(49)).toBe('dentro')
    expect(comparacaoComReferencia(70)).toBe('dentro')
    expect(comparacaoComReferencia(70.1)).toBe('acima')
    expect(comparacaoComReferencia(null)).toBeNull()
  })
})
