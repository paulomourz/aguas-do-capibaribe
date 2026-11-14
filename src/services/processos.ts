import { requisicao } from './http'
import type { ProcessoDTO, SalvarProcessoDTO } from './tipos'

export async function listarProcessos(): Promise<ProcessoDTO[]> {
  return requisicao('/processos')
}

export async function salvarProcesso(dados: SalvarProcessoDTO): Promise<ProcessoDTO> {
  return dados.id
    ? requisicao(`/processos/${dados.id}`, { method: 'PUT', corpo: dados })
    : requisicao('/processos', { method: 'POST', corpo: dados })
}
