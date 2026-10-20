import { processosIniciais } from '../mock'
import { USAR_MOCK, requisicao } from './http'
import { atraso, idNum } from './mockUtil'
import type { ProcessoDTO, SalvarProcessoDTO } from './tipos'

let base: ProcessoDTO[] = processosIniciais.map((p) => ({ ...p, id: idNum(p.id) }))

export async function listarProcessos(): Promise<ProcessoDTO[]> {
  return USAR_MOCK ? atraso(base) : requisicao('/processos')
}

export async function salvarProcesso(dados: SalvarProcessoDTO): Promise<ProcessoDTO> {
  if (!USAR_MOCK)
    return dados.id
      ? requisicao(`/processos/${dados.id}`, { method: 'PUT', corpo: dados })
      : requisicao('/processos', { method: 'POST', corpo: dados })
  const p: ProcessoDTO = { ...dados, id: dados.id ?? Math.max(0, ...base.map((x) => x.id)) + 1 }
  base = base.some((x) => x.id === p.id) ? base.map((x) => (x.id === p.id ? p : x)) : [...base, p]
  return atraso(p)
}
