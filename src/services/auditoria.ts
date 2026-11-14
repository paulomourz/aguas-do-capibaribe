import { requisicao } from "./http"
import type { AcaoAuditoria, PaginaAuditoriaDTO, SegurancaDTO } from "./tipos"

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

/** Eventos de segurança (só administrador): logins, bloqueios por limite e trocas de senha. */
export async function buscarEventosSeguranca(): Promise<SegurancaDTO> {
  return requisicao("/auditoria/seguranca")
}
