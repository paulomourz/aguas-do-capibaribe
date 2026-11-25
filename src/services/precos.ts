import { lerNumeroBR } from '../domain/formatacao'
import { ApiError, requisicao } from './http'
import type { NovoPrecoM3DTO, PrecoM3DTO } from './tipos'

/** Histórico do preço do m³ (só gestor e admin), por vigência e, na mesma vigência, por cadastro. */
export async function listarPrecosM3(): Promise<PrecoM3DTO[]> {
  return requisicao('/precos-m3')
}

/** Quem cadastrou vem do token. Não há como editar nem apagar um preço. */
export async function cadastrarPrecoM3(dados: NovoPrecoM3DTO): Promise<PrecoM3DTO> {
  return requisicao('/precos-m3', { method: 'POST', corpo: dados })
}

export type ErrosPrecoM3 = { valor?: string; vigencia?: string }
export type ResultadoPrecoM3<T> = { ok: true; salvo: T } | { ok: false; erros: ErrosPrecoM3; mensagem?: string }

/**
 * Valida o formulário do preço do m³ (valor digitado como "12,50" e vigência AAAA-MM-DD) e, se estiver certo, envia.
 * Erro de campo da API (422) volta para o campo; outro erro vira a mensagem do aviso. Separado da tela para ser testado sem navegador.
 */
export async function salvarPrecoM3<T>(valor: string, vigencia: string, enviar: (dados: NovoPrecoM3DTO) => Promise<T>): Promise<ResultadoPrecoM3<T>> {
  const v = lerNumeroBR(valor)
  const erros: ErrosPrecoM3 = {}
  if (valor.trim() === '') erros.valor = 'Informe o preço do m³.'
  else if (Number.isNaN(v)) erros.valor = 'Use apenas números no preço, por exemplo 12,50.'
  if (!vigencia) erros.vigencia = 'Informe a data a partir da qual o preço vale.'
  if (Object.keys(erros).length) return { ok: false, erros }
  try {
    return { ok: true, salvo: await enviar({ valor: v, vigencia }) }
  } catch (e) {
    if (e instanceof ApiError && Object.keys(e.campos).length) return { ok: false, erros: e.campos }
    return { ok: false, erros: {}, mensagem: e instanceof ApiError ? e.message : 'Erro inesperado. Tente novamente.' }
  }
}
