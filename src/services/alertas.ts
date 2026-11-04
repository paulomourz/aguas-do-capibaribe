import { requisicao } from './http'
import type { AlertaDTO, Id, StatusAlerta } from './tipos'

export async function listarAlertas(status?: StatusAlerta): Promise<AlertaDTO[]> {
  return requisicao('/alertas', { query: { status } })
}

export async function mudarStatusAlerta(id: Id, status: StatusAlerta): Promise<AlertaDTO> {
  return requisicao(`/alertas/${id}/status`, { method: 'PATCH', corpo: { status } })
}
