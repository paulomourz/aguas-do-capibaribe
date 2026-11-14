import { atualizarPendente, listarPendentes, removerPendente, type LotePendente } from './filaOffline'
import { ApiError } from './http'
import { estaBloqueado } from './limite'
import { registrarLote } from './lotes'
import type { Id, LoteDTO } from './tipos'

/*
 * Envio dos lotes guardados no IndexedDB.
 *
 * Por que não duplica:
 *  1. Cada lote tem uma chave (UUID) gerada uma vez, no aparelho, e reenviada igual em toda tentativa.
 *     Se a API gravou mas a resposta se perdeu, o reenvio recebe o mesmo lote (200), não um novo.
 *  2. O lote só sai da fila depois da confirmação da API.
 *  3. Um envio por vez: dentro da aba (fila de promessas) e entre abas (Web Locks API).
 *
 * Ordem: do mais antigo ao mais novo, e para no primeiro erro de conexão. Assim a API recebe os lotes na
 * ordem em que foram feitos, o que importa para a regra de alerta (3 lotes seguidos acima da meta).
 */

export type TipoFalha = 'tentarDepois' | 'recusado' | 'sessaoExpirada' | 'limite'

/** O que fazer com um erro do envio. */
export function classificarErro(e: unknown): { tipo: TipoFalha; mensagem: string } {
  if (!(e instanceof ApiError)) return { tipo: 'tentarDepois', mensagem: 'A conexão caiu durante o envio.' }
  const s = e.status
  if (s === 401) return { tipo: 'sessaoExpirada', mensagem: 'Sessão expirada. Entre de novo para enviar.' }
  // 429 (RNF19): a conexão está boa, só passou de 60 lotes por minuto. Espera o Retry-After e continua.
  if (s === 429) return { tipo: 'limite', mensagem: 'Limite de envios por minuto atingido; o envio continua depois da espera.' }
  // 0 = sem resposta (Wi-Fi fora, tempo esgotado); 408/425 e 5xx = servidor ocupado ou acordando.
  if (s === 0 || s === 408 || s === 425 || s >= 500) {
    const mensagem = s === 0 ? 'Sem conexão com o servidor.' : 'O servidor não respondeu direito.'
    return { tipo: 'tentarDepois', mensagem }
  }
  // 400, 403, 404, 409, 422: a API leu o pedido e recusou. Reenviar igual daria o mesmo erro.
  const campo = Object.values(e.campos)[0]
  return { tipo: 'recusado', mensagem: campo ?? e.message }
}

export type ResultadoSincronizacao = {
  enviados: { chave: string; lote: LoteDTO }[]
  recusados: { pendente: LotePendente; erro: unknown }[]
  /** Pendentes que continuam esperando (sem contar os recusados). */
  restantes: number
  /** Motivo de ter parado antes do fim, se parou. */
  parouPor?: 'semConexao' | 'sessaoExpirada' | 'limite'
}

type Enviar = (p: LotePendente) => Promise<LoteDTO>

const enviarPelaApi: Enviar = (p) => registrarLote({ processoId: p.processoId, pecas: p.pecas, litros: p.litros }, p.chave)

async function executar(usuarioId: Id, enviar: Enviar): Promise<ResultadoSincronizacao> {
  const r: ResultadoSincronizacao = { enviados: [], recusados: [], restantes: 0 }
  // Lê a fila agora (dentro da trava), não antes: pega o que outra aba já enviou ou o que acabou de entrar.
  const fila = (await listarPendentes(usuarioId)).filter((p) => p.estado === 'pendente')
  // Ainda na espera de um 429: nem tenta (não conta tentativa nem vai à rede).
  if (fila.length && estaBloqueado('lotes')) return { ...r, restantes: fila.length, parouPor: 'limite' }
  for (let i = 0; i < fila.length; i++) {
    const p = fila[i]
    const tentativa = { tentativas: p.tentativas + 1, ultimaTentativa: new Date().toISOString() }
    try {
      const lote = await enviar({ ...p, ...tentativa })
      await removerPendente(p.chave)
      r.enviados.push({ chave: p.chave, lote })
    } catch (erro) {
      const { tipo, mensagem } = classificarErro(erro)
      if (tipo === 'recusado') {
        const atualizado = await atualizarPendente(p.chave, { ...tentativa, estado: 'recusado', ultimoErro: mensagem })
        r.recusados.push({ pendente: atualizado ?? p, erro })
        continue
      }
      await atualizarPendente(p.chave, { ...tentativa, ultimoErro: mensagem })
      r.parouPor = tipo === 'sessaoExpirada' ? 'sessaoExpirada' : tipo === 'limite' ? 'limite' : 'semConexao'
      r.restantes = fila.length - i
      return r
    }
  }
  return r
}

const NOME_TRAVA = 'aguas-envio-lotes'
let cadeia: Promise<unknown> = Promise.resolve()

/**
 * Envia os lotes pendentes do usuário. Chamadas simultâneas (evento online, intervalo, botão, novo
 * registro) entram numa fila e rodam uma depois da outra; entre abas, a Web Locks API faz o mesmo.
 */
export function sincronizarPendentes(usuarioId: Id, enviar: Enviar = enviarPelaApi): Promise<ResultadoSincronizacao> {
  const rodar = (): Promise<ResultadoSincronizacao> => {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    if (!locks) return executar(usuarioId, enviar)
    // A tipagem do DOM embrulha o retorno em duas Promises; em tempo de execução é uma só.
    return locks.request(NOME_TRAVA, () => executar(usuarioId, enviar)) as unknown as Promise<ResultadoSincronizacao>
  }
  const proxima = cadeia.then(rodar, rodar)
  cadeia = proxima.catch(() => undefined)
  return proxima
}
