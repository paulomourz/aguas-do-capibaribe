import { limparSessao, requisicao, salvarToken } from './http'
import type { LoginDTO, SessaoDTO, UsuarioDTO } from './tipos'

export async function login(dados: LoginDTO): Promise<SessaoDTO> {
  const s = await requisicao<SessaoDTO>('/auth/login', { method: 'POST', corpo: dados })
  salvarToken(s.token)
  return s
}

/** Recupera o usuário da sessão salva (ao recarregar a página). */
export async function me(): Promise<UsuarioDTO> {
  return requisicao('/auth/me')
}

export async function logout(): Promise<void> {
  limparSessao()
}
