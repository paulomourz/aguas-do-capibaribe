import { usuariosIniciais } from '../mock'
import { ApiError, USAR_MOCK, requisicao } from './http'
import { atraso, idNum } from './mockUtil'
import type { AtualizarUsuarioDTO, Id, NovoUsuarioDTO, UsuarioDTO } from './tipos'

let base: UsuarioDTO[] = usuariosIniciais.map((u) => ({
  id: idNum(u.id), nome: u.nome, usuario: u.usuario, perfil: u.perfil, ativo: u.ativo,
}))
/* Senhas só existem no modo simulado; a API real guarda apenas o hash BCrypt. */
const senhas = new Map<Id, string>(usuariosIniciais.map((u) => [idNum(u.id), u.senha ?? '']))
const achar = (id: Id) => {
  const u = base.find((x) => x.id === id)
  if (!u) throw new ApiError(404, { codigo: 'NAO_ENCONTRADO', mensagem: 'Usuário não encontrado.' })
  return u
}

export const mockAutenticar = (login: string, senha: string) =>
  base.find((u) => u.usuario === login && u.ativo && senhas.get(u.id) === senha)
export const mockUsuario = (id: Id) => base.find((u) => u.id === id)

export async function listarUsuarios(): Promise<UsuarioDTO[]> {
  return USAR_MOCK ? atraso(base) : requisicao('/usuarios')
}

export async function criarUsuario(dados: NovoUsuarioDTO): Promise<UsuarioDTO> {
  if (!USAR_MOCK) return requisicao('/usuarios', { method: 'POST', corpo: dados })
  if (base.some((u) => u.usuario.toLowerCase() === dados.usuario.toLowerCase()))
    throw new ApiError(409, { codigo: 'USUARIO_DUPLICADO', mensagem: 'Usuário já existe.', campos: { usuario: 'Este usuário já existe. Escolha outro.' } })
  const novo: UsuarioDTO = { id: Math.max(0, ...base.map((u) => u.id)) + 1, nome: dados.nome, usuario: dados.usuario, perfil: dados.perfil, ativo: true }
  base = [...base, novo]
  senhas.set(novo.id, dados.senha)
  return atraso(novo)
}

export async function atualizarUsuario(id: Id, dados: AtualizarUsuarioDTO): Promise<UsuarioDTO> {
  if (!USAR_MOCK) return requisicao(`/usuarios/${id}`, { method: 'PATCH', corpo: dados })
  const atual = achar(id)
  if (dados.senha !== undefined) {
    if (dados.senhaAtual !== senhas.get(id))
      throw new ApiError(422, { codigo: 'VALIDACAO', mensagem: 'A senha atual está incorreta.', campos: { senhaAtual: 'A senha atual está incorreta.' } })
    senhas.set(id, dados.senha)
  }
  const u = { ...atual, ...(dados.nome ? { nome: dados.nome } : {}) }
  base = base.map((x) => (x.id === id ? u : x))
  return atraso(u)
}

/** O gestor define uma nova senha para outra pessoa. */
export async function redefinirSenha(id: Id, senha: string): Promise<UsuarioDTO> {
  if (!USAR_MOCK) return requisicao(`/usuarios/${id}/senha`, { method: 'PATCH', corpo: { senha } })
  const u = achar(id)
  senhas.set(id, senha)
  return atraso(u)
}

export async function definirAtivo(id: Id, ativo: boolean): Promise<UsuarioDTO> {
  if (!USAR_MOCK) return requisicao(`/usuarios/${id}/ativo`, { method: 'PATCH', corpo: { ativo } })
  const u = { ...achar(id), ativo }
  base = base.map((x) => (x.id === id ? u : x))
  return atraso(u)
}
