/* ---------- Formatação pt-BR ---------- */

import type { Perfil, Unidade } from './tipos'

export const fmtNum = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
export const fmtL = (n: number) => `${fmtNum(n)} L`
export const fmtPct = (n: number) => {
  const r = Math.round(n * 10) / 10
  const s = Math.abs(r).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${s}%`
}
export const fmtData = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
export const fmtHora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
export const fmtDataHora = (d: Date) => `${fmtData(d)} às ${fmtHora(d)}`

export const unidadeLabel: Record<Unidade, string> = { lote: 'litros por lote', peca: 'litros por peça' }
export const unidadeCurta: Record<Unidade, string> = { lote: 'L/lote', peca: 'L/peça' }
export const perfilLabel: Record<Perfil, string> = { gestor: 'Gestor', operador: 'Operador' }

export const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** aguas-do-capibaribe-relatorio-AAAA-MM.pdf */
export const nomeArquivoRelatorio = (mes: number, ano: number) =>
  `aguas-do-capibaribe-relatorio-${ano}-${String(mes).padStart(2, '0')}.pdf`
