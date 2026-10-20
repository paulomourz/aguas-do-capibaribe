import { alertasIniciais } from '../mock'
import { ApiError, USAR_MOCK, requisicao } from './http'
import { atraso, idNum } from './mockUtil'
import type { AlertaDTO, Id, StatusAlerta } from './tipos'

let base: AlertaDTO[] = alertasIniciais.map((a) => ({
  id: idNum(a.id), processoId: idNum(a.processoId), loteIds: a.lotes.map((l) => idNum(l.id)),
  detectado: a.detectado.toISOString(), status: a.status,
}))

export async function listarAlertas(status?: StatusAlerta): Promise<AlertaDTO[]> {
  if (!USAR_MOCK) return requisicao('/alertas', { query: { status } })
  return atraso(status ? base.filter((a) => a.status === status) : base)
}

export async function mudarStatusAlerta(id: Id, status: StatusAlerta): Promise<AlertaDTO> {
  if (!USAR_MOCK) return requisicao(`/alertas/${id}/status`, { method: 'PATCH', corpo: { status } })
  const a = base.find((x) => x.id === id)
  if (!a) throw new ApiError(404, { codigo: 'NAO_ENCONTRADO', mensagem: 'Alerta não encontrado.' })
  const novo = { ...a, status }
  base = base.map((x) => (x.id === id ? novo : x))
  return atraso(novo)
}
