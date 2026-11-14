/* Dados dos gráficos de consumo, calculados a partir dos lotes do mês. */

import type { Lote } from './tipos'

export type ConsumoDia = { dia: number; real: number; esperado: number; lotes: number }

const FUSO = 'America/Recife'

/** Dia do mês em America/Recife, o mesmo fuso que a API usa para definir o mês do relatório. */
const diaEmRecife = (d: Date) => Number(new Intl.DateTimeFormat('en-US', { timeZone: FUSO, day: 'numeric' }).format(d))

/** Início e fim do mês em America/Recife (UTC-3, sem horário de verão), no formato da API. */
export function limitesDoMes(mes: number, ano: number) {
  const mm = String(mes).padStart(2, '0')
  const proximo = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`
  return {
    inicio: new Date(`${ano}-${mm}-01T00:00:00-03:00`).toISOString(),
    fim: new Date(new Date(`${proximo}-01T00:00:00-03:00`).getTime() - 1).toISOString(),
  }
}

/** Litros reais e esperados de cada dia do mês. Dias sem lote entram com zero, para a linha não esconder a pausa. */
export function consumoPorDia(lotes: Lote[], mes: number, ano: number, hoje = new Date()): ConsumoDia[] {
  const noMes = new Date(ano, mes, 0).getDate()
  const agora = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(hoje)
  const parte = (t: string) => Number(agora.find((p) => p.type === t)?.value)
  // No mês corrente, para no dia de hoje: os próximos dias ainda não têm consumo.
  const ultimo = parte('year') === ano && parte('month') === mes ? parte('day') : noMes
  const dias: ConsumoDia[] = Array.from({ length: ultimo }, (_, i) => ({ dia: i + 1, real: 0, esperado: 0, lotes: 0 }))
  for (const l of lotes) {
    const d = dias[diaEmRecife(l.data) - 1]
    if (!d) continue
    d.real += l.litros
    d.esperado += l.esperado
    d.lotes += 1
  }
  return dias
}
