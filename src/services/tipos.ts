/* Tipos trocados com a API REST (Spring Boot). Datas em ISO 8601. */

export type Id = number
export type Perfil = 'admin' | 'gestor' | 'operador' | 'sensor'
export type Unidade = 'lote' | 'peca'
export type StatusAlerta = 'aberto' | 'analise' | 'resolvido'
/** Faixa do desvio do lote, calculada pelo servidor. */
export type StatusConformidade = 'DENTRO_DA_META' | 'ATENCAO' | 'CRITICO'

export type UsuarioDTO = { id: Id; nome: string; usuario: string; perfil: Perfil; ativo: boolean }
export type NovoUsuarioDTO = { nome: string; usuario: string; perfil: Perfil; senha: string }
/** Para trocar a senha, senhaAtual é obrigatória (conferida pelo servidor). */
export type AtualizarUsuarioDTO = { nome?: string; senha?: string; senhaAtual?: string }

export type LoginDTO = { usuario: string; senha: string }
export type SessaoDTO = { token: string; usuario: UsuarioDTO }
/** Resposta da rotação: `token` é a chave nova (64 caracteres), mostrada uma única vez. */
export type TokenDeApiDTO = { token: string; usuario: UsuarioDTO }

export type ProcessoDTO = { id: Id; nome: string; unidade: Unidade; meta: number }
export type SalvarProcessoDTO = Omit<ProcessoDTO, 'id'> & { id?: Id }

export type LoteDTO = {
  id: Id
  processoId: Id
  pecas: number
  litros: number
  esperado: number
  desvio: number
  statusConformidade: StatusConformidade
  data: string
  usuarioId: Id
}
export type NovoLoteDTO = { processoId: Id; pecas: number; litros: number }

export type AlertaDTO = { id: Id; processoId: Id; loteIds: Id[]; detectado: string; status: StatusAlerta }

/** Consumo de um processo no mês (mês definido no fuso America/Recife pelo servidor). */
export type ResumoDTO = { processoId: Id; real: number; esperado: number; lotes: number }

export type AcaoAuditoria = 'CRIACAO_USUARIO' | 'REDEFINICAO_SENHA' | 'DESATIVACAO_USUARIO' | 'REATIVACAO_USUARIO' | 'ROTACAO_TOKEN'
export type PessoaDTO = { id: Id; nome: string | null; usuario: string | null }
export type RegistroAuditoriaDTO = { id: Id; acao: AcaoAuditoria; data: string; gestor: PessoaDTO; usuarioAfetado: PessoaDTO }
export type PaginaAuditoriaDTO = { itens: RegistroAuditoriaDTO[]; total: number; pagina: number; tamanho: number }

export type ErroApiDTO = { codigo: string; mensagem: string; campos?: Record<string, string> }
