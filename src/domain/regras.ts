/* Regras de exibição usadas pelas telas (prévia do esperado, desvio, classificação ilustrativa). */

import type { Status } from '../components/ui'
import type { Alerta, Processo } from './tipos'

export function esperadoDe(p: Processo, pecas: number) {
  return p.unidade === 'peca' ? p.meta * pecas : p.meta
}

export function desvioDe(real: number, esperado: number) {
  return ((real - esperado) / esperado) * 100
}

/*
 * Faixas ilustrativas. Os limites oficiais serão definidos pela equipe e calculados pelo backend.
 * Configuração única de faixas (desvio em %, limite superior inclusivo). Nunca exibir na interface.
 */
const FAIXAS_DE_STATUS: { ate: number; status: Status }[] = [
  { ate: 0, status: 'ok' },
  { ate: 8, status: 'warn' },
]

/** Função única de classificação de status do lote. */
export function statusDe(desvio: number): Status {
  return FAIXAS_DE_STATUS.find((f) => desvio <= f.ate)?.status ?? 'crit'
}

export const desvioMedio = (a: Alerta) => a.lotes.reduce((s, l) => s + l.desvio, 0) / a.lotes.length
