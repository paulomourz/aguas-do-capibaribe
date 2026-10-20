/* SIMULAÇÃO: será substituído pela API REST. Não levar para produção. */

/* ---------- Resumo mensal ---------- */

import type { Resumo } from '../domain/tipos'

export const MES_ATUAL = 9
export const ANO_ATUAL = 2026

const setembro2026: Resumo[] = [
  { processoId: 'amaciamento', real: 38400, esperado: 40000, lotes: 50 },
  { processoId: 'estonagem', real: 61950, esperado: 57600, lotes: 48 },
  { processoId: 'tingimento', real: 74250, esperado: 67500, lotes: 45 },
]

/** Há dados de jan/2025 até set/2026 (mês atual). */
export function resumoDoMes(mes: number, ano: number): Resumo[] {
  if (ano === 2026 && mes === 9) return setembro2026
  if (ano > 2026 || ano < 2025 || (ano === 2026 && mes > 9)) return []
  const seed = (mes * 7 + (ano - 2024) * 13) % 10
  const vol = 0.86 + seed * 0.025
  const desvios = [-0.03 + seed * 0.004, 0.02 + seed * 0.006, 0.04 + seed * 0.009]
  return setembro2026.map((r, i) => {
    const lotes = Math.round(r.lotes * vol)
    const esperado = i === 1 ? lotes * 100 * 12 : lotes * (i === 0 ? 800 : 1500)
    return { processoId: r.processoId, lotes, esperado, real: Math.round(esperado * (1 + desvios[i])) }
  })
}
