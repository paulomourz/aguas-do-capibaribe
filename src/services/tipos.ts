/* Tipos trocados com a API REST (Spring Boot). Datas em ISO 8601. */

export type Id = number
export type Perfil = 'gestor' | 'operador'
export type Unidade = 'lote' | 'peca'
export type StatusAlerta = 'aberto' | 'analise' | 'resolvido'

export type UsuarioDTO = { id: Id; nome: string; usuario: string; perfil: Perfil; ativo: boolean }
export type NovoUsuarioDTO = { nome: string; usuario: string; perfil: Perfil; senha: string }
/** Para trocar a senha, senhaAtual é obrigatória (conferida pelo servidor). */
export type AtualizarUsuarioDTO = { nome?: string; senha?: string; senhaAtual?: string }

export type LoginDTO = { usuario: string; senha: string }
export type SessaoDTO = { token: string; usuario: UsuarioDTO }

export type ProcessoDTO = { id: Id; nome: string; unidade: Unidade; meta: number }
export type SalvarProcessoDTO = Omit<ProcessoDTO, 'id'> & { id?: Id }

export type LoteDTO = {
  id: Id
  processoId: Id
  pecas: number
  litros: number
  esperado: number
  desvio: number
  data: string
  usuarioId: Id
}
export type NovoLoteDTO = { processoId: Id; pecas: number; litros: number }

export type AlertaDTO = { id: Id; processoId: Id; loteIds: Id[]; detectado: string; status: StatusAlerta }

/** Consumo de um processo no mês (mês definido no fuso America/Recife pelo servidor). */
export type ResumoDTO = { processoId: Id; real: number; esperado: number; lotes: number }

export type ErroApiDTO = { codigo: string; mensagem: string; campos?: Record<string, string> }
