import type { ErroApiDTO } from './tipos'

export const API_URL: string = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8080/api'

export const CHAVE_TOKEN = 'ac-token'
export const obterToken = () => sessionStorage.getItem(CHAVE_TOKEN)
export const salvarToken = (t: string) => sessionStorage.setItem(CHAVE_TOKEN, t)
export const limparSessao = () => {
  sessionStorage.removeItem(CHAVE_TOKEN)
  sessionStorage.removeItem('ac-sessao')
}

export class ApiError extends Error {
  readonly status: number
  readonly codigo: string
  readonly campos: Record<string, string>
  constructor(status: number, erro: ErroApiDTO) {
    super(erro.mensagem)
    this.name = 'ApiError'
    this.status = status
    this.codigo = erro.codigo
    this.campos = erro.campos ?? {}
  }
}

type Opcoes = Omit<RequestInit, 'body'> & {
  corpo?: unknown
  query?: Record<string, string | number | undefined>
  /** Desiste depois deste tempo (ms) e trata como sem conexão. Na Wi-Fi instável, um fetch pode ficar pendurado por minutos. */
  timeoutMs?: number
}

const ROTA_LOGIN = '/auth/login'
/** Disparado quando o servidor recusa o token (expirado ou usuário desativado); o store limpa a sessão. */
export const EVENTO_SESSAO_EXPIRADA = 'ac-sessao-expirada'

export async function requisicao<T>(caminho: string, { corpo, query, headers, timeoutMs, ...init }: Opcoes = {}): Promise<T> {
  // A base só vale para endereço relativo (/api, no Docker, com o Nginx na mesma origem).
  const url = new URL(API_URL.replace(/\/+$/, '') + caminho, window.location.origin)
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
    let erro: ErroApiDTO = { codigo: `HTTP_${resp.status}`, mensagem: 'Erro inesperado no servidor.' }
    try {
      const j = (await resp.json()) as Partial<ErroApiDTO>
      if (j && typeof j.mensagem === 'string') erro = { codigo: j.codigo ?? erro.codigo, mensagem: j.mensagem, campos: j.campos }
    } catch {
      /* corpo vazio ou não JSON */
    }
    throw new ApiError(resp.status, erro)
  }

  if (resp.status === 204) return undefined as T
  const texto = await resp.text()
  return (texto ? JSON.parse(texto) : undefined) as T
}
