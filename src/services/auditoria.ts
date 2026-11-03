import { USAR_MOCK, requisicao } from "./http"
import { atraso } from "./mockUtil"
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
  if (!USAR_MOCK) return requisicao("/auditoria", { query: f })
  // Modo simulado: sem registros de exemplo.
  return atraso({ itens: [], total: 0, pagina: f.pagina, tamanho: f.tamanho })
}
