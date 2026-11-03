/* Regras de exibição usadas pelas telas (prévia do esperado, desvio, classificação). */

import type { Status } from '../components/ui'
import type { StatusConformidade } from '../services/tipos'
import type { Alerta, Processo } from './tipos'

export function esperadoDe(p: Processo, pecas: number) {
  return p.unidade === 'peca' ? p.meta * pecas : p.meta
}

export function desvioDe(real: number, esperado: number) {
  return ((real - esperado) / esperado) * 100
}

/** Status de cada lote vem da API (StatusConformidade no backend); aqui só traduzimos para as cores. */
export const statusDaApi: Record<StatusConformidade, Status> = { DENTRO_DA_META: 'ok', ATENCAO: 'warn', CRITICO: 'crit' }

/*
 * Mesmos limites de StatusConformidade no backend: mudar nos dois. Usadas só para totais e médias
 * (relatório, dashboard, média do alerta) e para o modo simulado; lotes usam o status da API.
 * Configuração única de faixas (desvio em %, limite superior inclusivo). Nunca exibir na interface.
 */
const FAIXAS_DE_STATUS: { ate: number; status: Status }[] = [
  { ate: 0, status: 'ok' },
  { ate: 8, status: 'warn' },
]

/** Classificação de um desvio agregado (soma ou média de lotes). */
export function statusDe(desvio: number): Status {
  return FAIXAS_DE_STATUS.find((f) => desvio <= f.ate)?.status ?? 'crit'
}

export const desvioMedio = (a: Alerta) => a.lotes.reduce((s, l) => s + l.desvio, 0) / a.lotes.length
