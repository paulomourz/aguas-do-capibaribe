import { describe, expect, it } from 'vitest'
import { ESCALA_GAUGE, anguloDoDesvio, arcosDasFaixas, pontoNoArco } from '../gauge'
import { statusDe } from '../regras'

describe('anguloDoDesvio', () => {
  it('põe a meta (0%) no topo e as pontas da escala nas laterais', () => {
    expect(anguloDoDesvio(0)).toBe(0)
    expect(anguloDoDesvio(ESCALA_GAUGE.min)).toBe(-90)
    expect(anguloDoDesvio(ESCALA_GAUGE.max)).toBe(90)
  })

  it('para o ponteiro na ponta quando o desvio sai da escala', () => {
    expect(anguloDoDesvio(250)).toBe(90)
    expect(anguloDoDesvio(-80)).toBe(-90)
  })

  it('trata desvio inválido como meta, sem girar o ponteiro para fora do arco', () => {
    expect(anguloDoDesvio(Number.NaN)).toBe(0)
    expect(anguloDoDesvio(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('cresce junto com o desvio (ponteiro anda para a direita)', () => {
    expect(anguloDoDesvio(9)).toBeGreaterThan(anguloDoDesvio(8))
    expect(anguloDoDesvio(8)).toBeGreaterThan(anguloDoDesvio(0.1))
  })
})

describe('arcosDasFaixas', () => {
  const arcos = arcosDasFaixas()

  it('cobre o semicírculo inteiro, da esquerda para a direita, sem buraco', () => {
    expect(arcos.map((a) => a.status)).toEqual(['ok', 'warn', 'crit'])
    expect(arcos[0].de).toBe(-90)
    expect(arcos.at(-1)!.ate).toBe(90)
    for (let i = 1; i < arcos.length; i++) expect(arcos[i].de).toBe(arcos[i - 1].ate)
  })

  it('usa as mesmas faixas de statusDe: o ponteiro cai no arco da cor do status', () => {
    // 108% da meta (desvio 8%) ainda é atenção; acima disso é crítico (critério de aceitação da #98).
    for (const desvio of [-15, -0.1, 0, 0.1, 4, 8, 8.1, 12, 19]) {
      const ang = anguloDoDesvio(desvio)
      const arco = arcos.find((a) => ang > a.de && ang <= a.ate) ?? arcos[0]
      expect(arco.status, `desvio ${desvio}`).toBe(statusDe(desvio))
    }
  })
})

describe('pontoNoArco', () => {
  it('mede o ângulo a partir do topo, no sentido horário', () => {
    const topo = pontoNoArco(100, 100, 80, 0)
    expect(topo.x).toBeCloseTo(100)
    expect(topo.y).toBeCloseTo(20)
    const direita = pontoNoArco(100, 100, 80, 90)
    expect(direita.x).toBeCloseTo(180)
    expect(direita.y).toBeCloseTo(100)
  })
})
