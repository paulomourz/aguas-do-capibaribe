import { ApiError, USAR_MOCK, limparSessao, obterToken, requisicao, salvarToken } from './http'
import { atraso } from './mockUtil'
import { mockAutenticar, mockUsuario } from './usuarios'
import type { LoginDTO, SessaoDTO, UsuarioDTO } from './tipos'

export async function login(dados: LoginDTO): Promise<SessaoDTO> {
  if (USAR_MOCK) {
    const u = mockAutenticar(dados.usuario.trim().toLowerCase(), dados.senha)
    if (!u) throw new ApiError(401, { codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'Usuário ou senha incorretos.' })
    const s: SessaoDTO = { token: `mock-${u.id}`, usuario: u }
    salvarToken(s.token)
    return atraso(s)
  }
  const s = await requisicao<SessaoDTO>('/auth/login', { method: 'POST', corpo: dados })
  salvarToken(s.token)
  return s
}

/** Recupera o usuário da sessão salva (ao recarregar a página). */
export async function me(): Promise<UsuarioDTO> {
  if (!USAR_MOCK) return requisicao('/auth/me')
  const u = mockUsuario(Number(obterToken()?.replace(/^mock-/, '')))
  if (!u || !u.ativo) throw new ApiError(401, { codigo: 'NAO_AUTENTICADO', mensagem: 'Sessão expirada.' })
  return atraso(u)
}

export async function logout(): Promise<void> {
  limparSessao()
}
