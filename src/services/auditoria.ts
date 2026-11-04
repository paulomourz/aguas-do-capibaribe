import { requisicao } from "./http"
import type { AcaoAuditoria, PaginaAuditoriaDTO } from "./tipos"

export type FiltroAuditoria = {
  inicio?: string
  fim?: string
  acao?: AcaoAuditoria
  pagina: number
  tamanho: number
}

export async function listarAuditoria(
  f: FiltroAuditoria,
): Promise<PaginaAuditoriaDTO> {
  return requisicao("/auditoria", { query: f })
}
