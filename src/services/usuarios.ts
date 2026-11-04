import { requisicao } from './http'
import type { AtualizarUsuarioDTO, Id, NovoUsuarioDTO, UsuarioDTO } from './tipos'

export async function listarUsuarios(): Promise<UsuarioDTO[]> {
  return requisicao('/usuarios')
}

export async function criarUsuario(dados: NovoUsuarioDTO): Promise<UsuarioDTO> {
  return requisicao('/usuarios', { method: 'POST', corpo: dados })
}

export async function atualizarUsuario(id: Id, dados: AtualizarUsuarioDTO): Promise<UsuarioDTO> {
  return requisicao(`/usuarios/${id}`, { method: 'PATCH', corpo: dados })
}

/** O gestor define uma nova senha para outra pessoa. */
export async function redefinirSenha(id: Id, senha: string): Promise<UsuarioDTO> {
  return requisicao(`/usuarios/${id}/senha`, { method: 'PATCH', corpo: { senha } })
}

export async function definirAtivo(id: Id, ativo: boolean): Promise<UsuarioDTO> {
  return requisicao(`/usuarios/${id}/ativo`, { method: 'PATCH', corpo: { ativo } })
}
