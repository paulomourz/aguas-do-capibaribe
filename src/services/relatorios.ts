import { requisicao } from './http'
import type { ResumoDTO } from './tipos'

export async function resumoDoMes(mes: number, ano: number): Promise<ResumoDTO[]> {
  return requisicao('/relatorios/resumo', { query: { mes, ano } })
}
