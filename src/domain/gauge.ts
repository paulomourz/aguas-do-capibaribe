/* Geometria do gauge de tolerância (#98): converte o desvio em ângulo do ponteiro e as faixas em arcos. */

import type { Status } from '../components/ui'
import { FAIXAS_DE_STATUS } from './regras'

/** Escala do gauge, em % de desvio. Fora dela o ponteiro para na ponta; a meta (0%) fica no topo. */
export const ESCALA_GAUGE = { min: -20, max: 20 } as const

/** Ângulo do ponteiro em graus: −90 na ponta esquerda, 0 no topo (meta), 90 na ponta direita. */
export function anguloDoDesvio(desvio: number): number {
  const { min, max } = ESCALA_GAUGE
  const d = Number.isFinite(desvio) ? Math.min(max, Math.max(min, desvio)) : 0
  return ((d - min) / (max - min)) * 180 - 90
}

export type ArcoDaFaixa = { status: Status; de: number; ate: number }

/** Arcos das faixas, da esquerda para a direita, com os mesmos limites de statusDe (e do backend). */
export function arcosDasFaixas(): ArcoDaFaixa[] {
  const arcos: ArcoDaFaixa[] = []
  let inicio: number = ESCALA_GAUGE.min
  for (const f of FAIXAS_DE_STATUS) {
    arcos.push({ status: f.status, de: anguloDoDesvio(inicio), ate: anguloDoDesvio(f.ate) })
    inicio = f.ate
  }
  arcos.push({ status: 'crit', de: anguloDoDesvio(inicio), ate: 90 })
  return arcos
}

/** Ponto do círculo de centro (cx, cy) e raio r no ângulo dado (0 = topo, sentido horário). */
export function pontoNoArco(cx: number, cy: number, r: number, angulo: number) {
  const rad = (angulo * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}
