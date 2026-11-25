import { requisicao } from './http'
import type { NovoPrecoM3DTO, PrecoM3DTO } from './tipos'

/** Histórico do preço do m³ (só gestor e admin), por vigência e, na mesma vigência, por cadastro. */
export async function listarPrecosM3(): Promise<PrecoM3DTO[]> {
  return requisicao('/precos-m3')
}

/** Quem cadastrou vem do token. Não há como editar nem apagar um preço. */
export async function cadastrarPrecoM3(dados: NovoPrecoM3DTO): Promise<PrecoM3DTO> {
  return requisicao('/precos-m3', { method: 'POST', corpo: dados })
}
