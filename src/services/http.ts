import { ESPERA_PADRAO_S, escopoDaRota, lerRetryAfter, registrarBloqueio, segundosRestantes } from './limite'
import { esquecerCredencial } from './filaOffline'
import type { ErroApiDTO } from './tipos'

export const API_URL: string = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8080/api'

/** Tira as barras do fim da URL base (sem regex: `/\/+$/` tem backtracking quadrático, Sonar S8786). */
export function semBarraNoFim(url: string): string {
  let fim = url.length
  while (fim > 0 && url[fim - 1] === '/') fim--
  return url.slice(0, fim)
}

export const CHAVE_TOKEN = 'ac-token'
export const obterToken = () => sessionStorage.getItem(CHAVE_TOKEN)
export const salvarToken = (t: string) => sessionStorage.setItem(CHAVE_TOKEN, t)
export const limparSessao = () => {
  sessionStorage.removeItem(CHAVE_TOKEN)
  sessionStorage.removeItem('ac-sessao')
  // Logout, 401 ou sessão recusada: o token guardado para o envio em segundo plano sai junto (issue #160).
  void esquecerCredencial()
}

export class ApiError extends Error {
  readonly status: number
  readonly codigo: string
  readonly campos: Record<string, string>
  /** No 429: quantos segundos esperar antes de tentar de novo (cabeçalho Retry-After). */
  readonly esperarSegundos: number | null
  constructor(status: number, erro: ErroApiDTO, esperarSegundos: number | null = null) {
    super(erro.mensagem)
    this.name = 'ApiError'
    this.status = status
    this.codigo = erro.codigo
    this.campos = erro.campos ?? {}
    this.esperarSegundos = esperarSegundos
  }
}

/** O 429 que a API daria: usado quando a ação ainda está bloqueada e o pedido nem sai do aparelho. */
export const erroLimite = (segundos: number) =>
  new ApiError(429, { codigo: 'LIMITE_EXCEDIDO', mensagem: `Muitas tentativas. Aguarde ${segundos} segundos e tente de novo.` }, segundos)

type Opcoes = Omit<RequestInit, 'body'> & {
  corpo?: unknown
  query?: Record<string, string | number | undefined>
  /** Desiste depois deste tempo (ms) e trata como sem conexão. Na Wi-Fi instável, um fetch pode ficar pendurado por minutos. */
  timeoutMs?: number
}

/** Corpo de erro da API ({codigo, mensagem, campos}); sem corpo JSON, uma mensagem genérica com o status. */
export async function lerErroDaResposta(resp: Response): Promise<ErroApiDTO> {
  const generico: ErroApiDTO = { codigo: `HTTP_${resp.status}`, mensagem: 'Erro inesperado no servidor.' }
  try {
    const j = (await resp.json()) as Partial<ErroApiDTO>
    if (j && typeof j.mensagem === 'string') return { codigo: j.codigo ?? generico.codigo, mensagem: j.mensagem, campos: j.campos }
  } catch {
    /* corpo vazio ou não JSON */
  }
  return generico
}

const ROTA_LOGIN = '/auth/login'
/** Disparado quando o servidor recusa o token (expirado ou usuário desativado); o store limpa a sessão. */
export const EVENTO_SESSAO_EXPIRADA = 'ac-sessao-expirada'

export async function requisicao<T>(caminho: string, { corpo, query, headers, timeoutMs, ...init }: Opcoes = {}): Promise<T> {
  // A base só vale para endereço relativo (/api, no Docker, com o Nginx na mesma origem).
  // Passou do limite há pouco (429): não dispara de novo até o Retry-After acabar.
  const escopo = escopoDaRota(caminho, init.method)
  const restante = escopo ? segundosRestantes(escopo) : 0
  if (restante > 0) throw erroLimite(restante)

  const url = new URL(semBarraNoFim(API_URL) + caminho, window.location.origin)
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v))

  const token = obterToken()
  const h = new Headers(headers)
  h.set('Accept', 'application/json')
  if (corpo !== undefined) h.set('Content-Type', 'application/json')
  if (token) h.set('Authorization', `Bearer ${token}`)

  const sinal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
  let resp: Response
  try {
    resp = await fetch(url, { ...init, signal: init.signal ?? sinal, headers: h, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  } catch {
    throw new ApiError(0, { codigo: 'SEM_CONEXAO', mensagem: 'Não foi possível conectar ao servidor.' })
  }

  if (resp.status === 401 && caminho !== ROTA_LOGIN) {
    limparSessao()
    window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
    window.location.hash = '/sessao-expirada'
  }

  if (!resp.ok) {
    const erro = await lerErroDaResposta(resp)
    if (resp.status === 429) {
      // Sem o cabeçalho (ou com CORS escondendo-o), espera a janela inteira do limite.
      const segundos = lerRetryAfter(resp.headers.get('Retry-After')) ?? ESPERA_PADRAO_S
      if (escopo) registrarBloqueio(escopo, segundos)
      throw new ApiError(429, erro, segundos)
    }
    throw new ApiError(resp.status, erro)
  }

  if (resp.status === 204) return undefined as T
  const texto = await resp.text()
  return (texto ? JSON.parse(texto) : undefined) as T
}
