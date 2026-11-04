import { requisicao } from './http'
import type { Id, LoteDTO, NovoLoteDTO } from './tipos'

export type FiltroLotes = { processoId?: Id; inicio?: string; fim?: string }

export async function listarLotes(f: FiltroLotes = {}): Promise<LoteDTO[]> {
  return requisicao('/lotes', { query: f })
}

/** Tempo máximo de espera do POST de lote antes de considerar "sem conexão" e deixar na fila. */
export const TEMPO_LIMITE_ENVIO_MS = 15_000

/**
 * Registra um lote em nome do usuário do token. Com `chave` (UUID do aparelho), reenviar a mesma chave devolve o lote
 * já gravado, em vez de criar outro: é o que permite reenviar sem duplicar quando a resposta se perde na Wi-Fi.
 */
export async function registrarLote(dados: NovoLoteDTO, chave?: string): Promise<LoteDTO> {
  return requisicao('/lotes', {
    method: 'POST',
    corpo: dados,
    headers: chave ? { 'Idempotency-Key': chave } : undefined,
    timeoutMs: TEMPO_LIMITE_ENVIO_MS,
  })
}
