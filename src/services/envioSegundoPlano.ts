import { apagarCredencial, guardarCredencial, lerCredencial, listarPendentes, type LotePendente } from './filaOffline'
import { API_URL, ApiError, lerErroDaResposta, semBarraNoFim } from './http'
import { ESPERA_PADRAO_S, lerRetryAfter } from './limite'
import { TEMPO_LIMITE_ENVIO_MS } from './lotes'
import { sincronizarPendentes, type Enviar, type ResultadoSincronizacao } from './sincronizacao'
import type { Id, LoteDTO } from './tipos'

/*
 * Envio da fila em segundo plano (issue #160, RNF12), pela Background Sync API do service worker.
 *
 * A página continua enviando a fila sozinha enquanto está aberta (sincronizacao.ts). Quando sobra lote sem
 * conexão, ela também pede ao service worker um "sync" com a tag `sync-lotes`: o navegador dispara esse
 * evento quando a rede volta, mesmo com a aba fechada ou em segundo plano, e o service worker envia a fila
 * pelo mesmo caminho da página (mesma ordem, mesma Idempotency-Key, mesma trava entre abas). No fim, avisa as
 * abas abertas por BroadcastChannel para elas mostrarem os lotes e o selo de sincronizado.
 *
 * O service worker não enxerga o sessionStorage, então o token vai para o IndexedDB (filaOffline.ts) só
 * enquanto houver lote esperando, e só nos navegadores com Background Sync (Chrome, Edge, Android). Ele sai
 * quando a fila esvazia, no logout, no 401 e quando o token expira (8 horas).
 */

/** Tag registrada na Background Sync API. */
export const TAG_SYNC = 'sync-lotes'
/** Canal em que o service worker avisa as abas do que enviou. */
export const CANAL_SYNC = 'aguas-sync'
/** Canal em que as abas avisam umas às outras que a fila mudou (o mesmo do store.tsx). */
export const CANAL_FILA = 'aguas-fila'
/** Por quanto tempo o selo de sincronizado fica no cabeçalho. */
export const DURACAO_SELO_MS = 5000

/** Aviso do service worker para as abas abertas. */
export type AvisoSegundoPlano = {
  tipo: 'lotesEnviados'
  usuarioId: Id
  lotes: LoteDTO[]
  recusados: number
}

/** Validade padrão do token na API, usada quando não dá para ler o `exp` do JWT. */
const VALIDADE_PADRAO_MS = 8 * 60 * 60 * 1000

/** Quando o token expira (ms desde 1970), lido do `exp` do JWT. */
export function expiracaoDoToken(token: string, agora = Date.now()): number {
  try {
    const parte = token.split('.')[1] ?? ''
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(base64)) as { exp?: unknown }
    if (typeof exp === 'number' && Number.isFinite(exp)) return exp * 1000
  } catch {
    /* token sem o formato de JWT */
  }
  return agora + VALIDADE_PADRAO_MS
}

/** POST /lotes com o token guardado, para o service worker (que não tem window nem sessionStorage). */
export function enviarComToken(token: string, apiUrl = API_URL, origem = globalThis.location?.origin ?? 'http://localhost'): Enviar {
  const url = new URL(semBarraNoFim(apiUrl) + '/lotes', origem)
  return async (p) => {
    let resp: Response
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': p.chave,
        },
        body: JSON.stringify({ processoId: p.processoId, pecas: p.pecas, litros: p.litros }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_ENVIO_MS),
      })
    } catch {
      throw new ApiError(0, { codigo: 'SEM_CONEXAO', mensagem: 'Não foi possível conectar ao servidor.' })
    }
    if (!resp.ok) {
      const erro = await lerErroDaResposta(resp)
      const espera = resp.status === 429 ? (lerRetryAfter(resp.headers.get('Retry-After')) ?? ESPERA_PADRAO_S) : null
      throw new ApiError(resp.status, erro, espera)
    }
    return (await resp.json()) as LoteDTO
  }
}

/** Algum lote da lista ainda espera envio? (Recusados não: esses dependem do operador.) */
export const algumEsperando = (lista: LotePendente[]) => lista.some((p) => p.estado === 'pendente')

/** O envio pela página parou com lote esperando a rede ou o limite por minuto: hora de pedir o Background Sync. */
export const sobrouParaDepois = (r: ResultadoSincronizacao) => r.parouPor === 'semConexao' || r.parouPor === 'limite'

/** Toast da página quando o service worker enviou a fila. */
export const textoEnviadosEmSegundoPlano = (n: number) =>
  n === 1 ? 'Sincronizado em segundo plano: 1 lote guardado foi enviado.' : `Sincronizado em segundo plano: ${n} lotes guardados foram enviados.`

function postar(nome: string, mensagem: unknown) {
  const canal = new BroadcastChannel(nome)
  canal.postMessage(mensagem)
  canal.close()
}

/** Avisa as abas: os lotes enviados (para a lista e o selo) e que a fila mudou (para o painel de pendentes). */
function avisarAbas(aviso: AvisoSegundoPlano) {
  if (typeof BroadcastChannel === 'undefined') return
  postar(CANAL_SYNC, aviso)
  postar(CANAL_FILA, 'mudou')
}

/**
 * - `semCredencial`: não há token guardado (ou expirou); a fila espera a pessoa entrar de novo no site.
 * - `concluido`: a fila foi processada, ou a sessão expirou (não adianta tentar de novo).
 * - `tentarDepois`: sem conexão ou no limite por minuto; o navegador repete o sync mais tarde.
 */
export type ResultadoSegundoPlano = 'semCredencial' | 'concluido' | 'tentarDepois'

type Dependencias = {
  criarEnvio: (token: string) => Enviar
  avisar: (aviso: AvisoSegundoPlano) => void
  agora: () => number
}

/** O que o service worker faz no evento `sync-lotes`. */
export async function sincronizarEmSegundoPlano({
  criarEnvio = (t) => enviarComToken(t),
  avisar = avisarAbas,
  agora = Date.now,
}: Partial<Dependencias> = {}): Promise<ResultadoSegundoPlano> {
  const credencial = await lerCredencial()
  if (!credencial) return 'semCredencial'
  if (credencial.expiraEm <= agora()) {
    await apagarCredencial()
    return 'semCredencial'
  }

  const r = await sincronizarPendentes(credencial.usuarioId, criarEnvio(credencial.token))
  if (r.enviados.length || r.recusados.length) {
    avisar({ tipo: 'lotesEnviados', usuarioId: credencial.usuarioId, lotes: r.enviados.map((e) => e.lote), recusados: r.recusados.length })
  }
  if (r.parouPor === 'sessaoExpirada') {
    await apagarCredencial()
    return 'concluido'
  }
  if (r.parouPor) return 'tentarDepois'
  // Fila vazia: o token não precisa mais ficar no aparelho. (Outra aba pode ter guardado um lote no meio.)
  if (!algumEsperando(await listarPendentes(credencial.usuarioId))) await apagarCredencial()
  return 'concluido'
}

/** O evento `sync` do service worker (tipado aqui porque o TypeScript não traz a Background Sync API). */
export type EventoSync = { tag: string; waitUntil: (p: Promise<unknown>) => void }

/** Responde ao `sync-lotes`. Rejeitar a promessa faz o navegador tentar de novo, com espera crescente. */
export function tratarSync(evento: EventoSync, sincronizar: () => Promise<ResultadoSegundoPlano> = sincronizarEmSegundoPlano) {
  if (evento.tag !== TAG_SYNC) return
  evento.waitUntil(
    sincronizar().then((r) => {
      if (r === 'tentarDepois') throw new Error('Lotes ainda pendentes; o navegador tenta de novo mais tarde.')
    }),
  )
}

/* ---------- Lado da página ---------- */

type RegistroComSync = { active: unknown; sync?: { register: (tag: string) => Promise<void> } }
type ContainerSw = { getRegistration: () => Promise<RegistroComSync | undefined> }

/**
 * Pede ao service worker para enviar a fila quando a conexão voltar. Guarda o token no IndexedDB só se o
 * navegador tiver Background Sync; sem ela (Firefox, Safari), devolve false e a página segue enviando sozinha.
 */
export async function pedirEnvioEmSegundoPlano(
  usuarioId: Id,
  token: string | null,
  sw: ContainerSw | undefined = globalThis.navigator?.serviceWorker as ContainerSw | undefined,
  agora = Date.now(),
): Promise<boolean> {
  if (!token || !sw) return false
  const registro = await sw.getRegistration()
  if (!registro?.active || !registro.sync) return false
  const expiraEm = expiracaoDoToken(token, agora)
  if (expiraEm <= agora) return false
  await guardarCredencial({ token, usuarioId, expiraEm })
  await registro.sync.register(TAG_SYNC)
  return true
}

/**
 * Chama `f` com os lotes que o service worker enviou em nome deste usuário. (Os recusados chegam pelo canal da
 * fila, que já atualiza o painel de pendentes.) Devolve a função que para de ouvir.
 */
export function ouvirSegundoPlano(usuarioId: Id, f: (lotes: LoteDTO[]) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const canal = new BroadcastChannel(CANAL_SYNC)
  canal.onmessage = (e: MessageEvent<Partial<AvisoSegundoPlano> | null>) => {
    const aviso = e.data
    if (aviso?.tipo === 'lotesEnviados' && aviso.usuarioId === usuarioId && aviso.lotes?.length) f(aviso.lotes)
  }
  return () => canal.close()
}
