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
export const perfilLabel: Record<Perfil, string> = { admin: 'Administrador', gestor: 'Gestor', operador: 'Operador', sensor: 'Sensor' }

export const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** aguas-do-capibaribe-relatorio-AAAA-MM.pdf */
export const nomeArquivoRelatorio = (mes: number, ano: number) =>
  `aguas-do-capibaribe-relatorio-${ano}-${String(mes).padStart(2, '0')}.pdf`

/**
 * Lê um número digitado no padrão brasileiro: ponto separa milhar e vírgula separa decimal ("1.590" = 1590,
 * "1.590,5" = 1590,5, "12,5" = 12,5). Um ponto fora de grupos de 3 dígitos ("1.5", "1.59") é ambíguo e dá NaN:
 * melhor pedir para corrigir do que adivinhar e gravar um valor errado (issue #139). Texto que não é número dá NaN.
 */
export function lerNumeroBR(texto: string): number {
  const t = texto.trim().replace(/\s/g, '')
  if (!/^\d[\d.,]*$/.test(t)) return NaN
  let normal: string
  if (t.includes(',')) {
    // Vírgula decimal: os pontos antes dela só podem ser de milhar.
    const [inteira, decimal, ...resto] = t.split(',')
    if (resto.length || decimal.includes('.') || (inteira.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(inteira))) return NaN
    normal = `${inteira.replace(/\./g, '')}.${decimal}`
  } else if (t.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(t)) return NaN
    normal = t.replace(/\./g, '')
  } else {
    normal = t
  }
  return /^\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN
}
