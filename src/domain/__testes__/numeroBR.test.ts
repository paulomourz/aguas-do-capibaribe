import { describe, expect, it } from 'vitest'
import { lerNumeroBR } from '../formatacao'

// Issue #139: "1.590" digitado no registro de lote virava 2 L.
describe('lerNumeroBR', () => {
  it.each([
    ['1590', 1590],
    ['1.590', 1590],
    ['12.345.678', 12345678],
    ['1.590,5', 1590.5],
    ['1590,5', 1590.5],
    ['12,5', 12.5],
    [' 920 ', 920],
    ['1 590', 1590],
    ['0', 0],
  ])('%j → %j', (texto, esperado) => {
    expect(lerNumeroBR(texto)).toBe(esperado)
  })

  it.each(['', 'abc', '1.59', '1.5', '1590.5', '1,5,0', '1.5,0', '-3', '1e3', ',5', '1.590.', '15.90,5'])('%j não é número', (texto) => {
    expect(lerNumeroBR(texto)).toBeNaN()
  })
})
