import { resumoDoMes as resumoSimulado } from '../mock'
import { USAR_MOCK, requisicao } from './http'
import { atraso, idNum } from './mockUtil'
import type { ResumoDTO } from './tipos'

export async function resumoDoMes(mes: number, ano: number): Promise<ResumoDTO[]> {
  if (!USAR_MOCK) return requisicao('/relatorios/resumo', { query: { mes, ano } })
  return atraso(resumoSimulado(mes, ano).map((r) => ({ ...r, processoId: idNum(r.processoId) })))
}
