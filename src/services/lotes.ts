import { desvioDe, esperadoDe, type Lote } from '../domain'
import { alertasIniciais, lotesIniciais, processosIniciais } from '../mock'
import { ApiError, USAR_MOCK, requisicao } from './http'
import { atraso, idNum, idTexto } from './mockUtil'
import type { Id, LoteDTO, NovoLoteDTO } from './tipos'

export const loteParaDTO = (l: Lote): LoteDTO => ({
  ...l, id: idNum(l.id), processoId: idNum(l.processoId), usuarioId: idNum(l.usuarioId), data: l.data.toISOString(),
})

// Inclui os lotes antigos que só aparecem nos alertas de exemplo, para o detalhe do alerta encontrá-los.
const lotesDeAlertas = alertasIniciais.flatMap((a) => a.lotes).filter((l) => !lotesIniciais.some((x) => x.id === l.id))
let base: LoteDTO[] = [...lotesIniciais, ...lotesDeAlertas].map(loteParaDTO)

export type FiltroLotes = { processoId?: Id; inicio?: string; fim?: string }

export async function listarLotes(f: FiltroLotes = {}): Promise<LoteDTO[]> {
  if (!USAR_MOCK) return requisicao('/lotes', { query: f })
  return atraso(
    base.filter(
      (l) => (!f.processoId || l.processoId === f.processoId) && (!f.inicio || l.data >= f.inicio) && (!f.fim || l.data <= f.fim),
    ),
  )
}

export async function registrarLote(dados: NovoLoteDTO, usuarioId: Id): Promise<LoteDTO> {
  if (!USAR_MOCK) return requisicao('/lotes', { method: 'POST', corpo: dados })
  const p = processosIniciais.find((x) => x.id === idTexto(dados.processoId))
  if (!p) throw new ApiError(422, { codigo: 'VALIDACAO', mensagem: 'Processo inválido.', campos: { processoId: 'Selecione um processo.' } })
  const esperado = esperadoDe(p, dados.pecas)
  const novo: LoteDTO = {
    id: Math.max(0, ...base.map((l) => l.id)) + 1,
    ...dados, esperado, desvio: desvioDe(dados.litros, esperado), data: new Date().toISOString(), usuarioId,
  }
  base = [novo, ...base]
  return atraso(novo)
}
