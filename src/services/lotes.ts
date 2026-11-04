import { desvioDe, esperadoDe, statusDe, type Lote } from '../domain'
import type { Status } from '../components/ui'
import { alertasIniciais, lotesIniciais, processosIniciais } from '../mock'
import { ApiError, USAR_MOCK, requisicao } from './http'
import { atraso, idNum, idTexto } from './mockUtil'
import type { Id, LoteDTO, NovoLoteDTO, StatusConformidade } from './tipos'

// Modo simulado: imita o statusConformidade que a API devolve.
const conformidade: Record<Status, StatusConformidade> = { ok: 'DENTRO_DA_META', warn: 'ATENCAO', crit: 'CRITICO' }

export const loteParaDTO = ({ status, ...l }: Lote): LoteDTO => ({
  ...l, id: idNum(l.id), processoId: idNum(l.processoId), usuarioId: idNum(l.usuarioId), data: l.data.toISOString(),
  statusConformidade: conformidade[status],
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

/** Tempo máximo de espera do POST de lote antes de considerar "sem conexão" e deixar na fila. */
export const TEMPO_LIMITE_ENVIO_MS = 15_000

// Modo simulado: lembra as chaves já recebidas, como o índice ux_lote_chave_envio da API.
const porChave = new Map<string, LoteDTO>()

/**
 * Registra um lote. Com `chave` (UUID do aparelho), reenviar a mesma chave devolve o lote já gravado,
 * em vez de criar outro: é o que permite reenviar sem duplicar quando a resposta se perde na Wi-Fi.
 */
export async function registrarLote(dados: NovoLoteDTO, usuarioId: Id, chave?: string): Promise<LoteDTO> {
  if (!USAR_MOCK) {
    return requisicao('/lotes', {
      method: 'POST',
      corpo: dados,
      headers: chave ? { 'Idempotency-Key': chave } : undefined,
      timeoutMs: TEMPO_LIMITE_ENVIO_MS,
    })
  }
  const repetido = chave ? porChave.get(chave) : undefined
  if (repetido) return atraso(repetido)
  const p = processosIniciais.find((x) => x.id === idTexto(dados.processoId))
  if (!p) throw new ApiError(422, { codigo: 'VALIDACAO', mensagem: 'Processo inválido.', campos: { processoId: 'Selecione um processo.' } })
  const esperado = esperadoDe(p, dados.pecas)
  const desvio = desvioDe(dados.litros, esperado)
  const novo: LoteDTO = {
    id: Math.max(0, ...base.map((l) => l.id)) + 1,
    ...dados, esperado, desvio, statusConformidade: conformidade[statusDe(desvio)], data: new Date().toISOString(), usuarioId,
  }
  base = [novo, ...base]
  if (chave) porChave.set(chave, novo)
  return atraso(novo)
}
