import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _fecharBanco, guardarPendente, listarPendentes, novaChave, type LotePendente } from '../filaOffline'
import { ApiError } from '../http'
import { classificarErro, sincronizarPendentes } from '../sincronizacao'
import type { LoteDTO } from '../tipos'

/*
 * Simula a Wi-Fi da lavanderia caindo e voltando entre o site e uma API que, como a real, guarda a
 * Idempotency-Key (ux_lote_chave_envio) e devolve o mesmo lote quando a chave se repete.
 */

type Rede = 'ok' | 'fora' | 'perdeResposta'

function apiFalsa() {
  const gravados = new Map<string, LoteDTO>()
  let rede: Rede = 'ok'
  let proximoId = 1
  const chamadas: string[] = []
  const recusar = new Set<string>()
  let expirada = false

  const enviar = async (p: LotePendente): Promise<LoteDTO> => {
    chamadas.push(p.chave)
    await new Promise((r) => setTimeout(r, 1))
    if (rede === 'fora') throw new ApiError(0, { codigo: 'SEM_CONEXAO', mensagem: 'Não foi possível conectar ao servidor.' })
    if (expirada) throw new ApiError(401, { codigo: 'NAO_AUTENTICADO', mensagem: 'Sessão expirada.' })
    if (recusar.has(p.chave)) throw new ApiError(422, { codigo: 'VALIDACAO', mensagem: 'Verifique', campos: { processoId: 'Selecione um processo válido.' } })
    let lote = gravados.get(p.chave)
    if (!lote) {
      lote = { id: proximoId++, processoId: p.processoId, pecas: p.pecas, litros: p.litros, esperado: 100, desvio: 0, statusConformidade: 'DENTRO_DA_META', data: new Date().toISOString(), usuarioId: p.usuarioId }
      gravados.set(p.chave, lote)
    }
    // A API gravou, mas a resposta não voltou (Wi-Fi caiu no meio do caminho).
    if (rede === 'perdeResposta') throw new ApiError(0, { codigo: 'SEM_CONEXAO', mensagem: 'Não foi possível conectar ao servidor.' })
    return lote
  }
  return {
    enviar,
    gravados,
    chamadas,
    recusar,
    set rede(r: Rede) {
      rede = r
    },
    set expirada(v: boolean) {
      expirada = v
    },
  }
}

let relogio = 0
function pendente(usuarioId = 7, extra: Partial<LotePendente> = {}): LotePendente {
  relogio++
  return {
    chave: novaChave(),
    usuarioId,
    processoId: 1,
    pecas: 10,
    litros: 100 + relogio,
    criadoEm: new Date(Date.UTC(2026, 10, 3, 12, 0, relogio)).toISOString(),
    estado: 'pendente',
    tentativas: 0,
    ...extra,
  }
}

beforeEach(async () => {
  await _fecharBanco()
  globalThis.indexedDB = new IDBFactory()
})
afterEach(async () => {
  await _fecharBanco()
})

describe('sincronização da fila de lotes', () => {
  it('envia na ordem em que os lotes foram registrados e esvazia a fila', async () => {
    const api = apiFalsa()
    const [a, b, c] = [pendente(), pendente(), pendente()]
    // Guardados fora de ordem: a fila ordena pela hora do registro.
    for (const p of [c, a, b]) await guardarPendente(p)

    const r = await sincronizarPendentes(7, api.enviar)

    expect(api.chamadas).toEqual([a.chave, b.chave, c.chave])
    expect(r.enviados.map((e) => e.chave)).toEqual([a.chave, b.chave, c.chave])
    expect(r.parouPor).toBeUndefined()
    expect(await listarPendentes(7)).toEqual([])
  })

  it('queda no meio do envio: para no primeiro erro, mantém o resto e conta a tentativa', async () => {
    const api = apiFalsa()
    const [a, b, c] = [pendente(), pendente(), pendente()]
    for (const p of [a, b, c]) await guardarPendente(p)

    let n = 0
    const enviarECair = async (p: LotePendente) => {
      if (n++ === 1) api.rede = 'fora'
      return api.enviar(p)
    }
    const r = await sincronizarPendentes(7, enviarECair)

    expect(r.enviados.map((e) => e.chave)).toEqual([a.chave])
    expect(r.parouPor).toBe('semConexao')
    expect(r.restantes).toBe(2)
    // Não tentou o terceiro depois que a rede caiu (preserva a ordem para a regra de alerta).
    expect(api.chamadas).toEqual([a.chave, b.chave])
    const fila = await listarPendentes(7)
    expect(fila.map((p) => p.chave)).toEqual([b.chave, c.chave])
    expect(fila[0]).toMatchObject({ estado: 'pendente', tentativas: 1, ultimoErro: 'Sem conexão com o servidor.' })
    expect(fila[1].tentativas).toBe(0)

    // A conexão volta.
    api.rede = 'ok'
    const r2 = await sincronizarPendentes(7, api.enviar)
    expect(r2.enviados.map((e) => e.chave)).toEqual([b.chave, c.chave])
    expect(await listarPendentes(7)).toEqual([])
    expect(api.gravados.size).toBe(3)
  })

  it('resposta perdida: a API gravou, o site reenvia com a mesma chave e NÃO duplica', async () => {
    const api = apiFalsa()
    const p = pendente()
    await guardarPendente(p)

    api.rede = 'perdeResposta'
    const r1 = await sincronizarPendentes(7, api.enviar)
    expect(r1.enviados).toEqual([])
    expect(api.gravados.size).toBe(1) // o servidor tem o lote…
    expect(await listarPendentes(7)).toHaveLength(1) // …mas o site não sabe, então mantém na fila.

    api.rede = 'ok'
    const r2 = await sincronizarPendentes(7, api.enviar)
    expect(api.chamadas).toEqual([p.chave, p.chave])
    expect(api.gravados.size).toBe(1)
    expect(r2.enviados[0].lote.id).toBe(api.gravados.get(p.chave)!.id)
    expect(await listarPendentes(7)).toEqual([])
  })

  it('vários gatilhos ao mesmo tempo (online, intervalo, botão) enviam cada lote uma vez só', async () => {
    const api = apiFalsa()
    for (let i = 0; i < 5; i++) await guardarPendente(pendente())

    const rs = await Promise.all([1, 2, 3, 4].map(() => sincronizarPendentes(7, api.enviar)))

    expect(api.chamadas).toHaveLength(5)
    expect(new Set(api.chamadas).size).toBe(5)
    expect(rs.flatMap((r) => r.enviados)).toHaveLength(5)
    expect(await listarPendentes(7)).toEqual([])
  })

  it('lote recusado pela API (422) fica marcado para o operador e não trava os outros', async () => {
    const api = apiFalsa()
    const [a, b] = [pendente(), pendente()]
    await guardarPendente(a)
    await guardarPendente(b)
    api.recusar.add(a.chave)

    const r = await sincronizarPendentes(7, api.enviar)

    expect(r.enviados.map((e) => e.chave)).toEqual([b.chave])
    expect(r.recusados.map((x) => x.pendente.chave)).toEqual([a.chave])
    const fila = await listarPendentes(7)
    expect(fila).toHaveLength(1)
    expect(fila[0]).toMatchObject({ chave: a.chave, estado: 'recusado', ultimoErro: 'Selecione um processo válido.' })

    // Recusado não é reenviado sozinho.
    await sincronizarPendentes(7, api.enviar)
    expect(api.chamadas.filter((c) => c === a.chave)).toHaveLength(1)
  })

  it('sessão expirada (401): para e guarda tudo para quando a pessoa entrar de novo', async () => {
    const api = apiFalsa()
    await guardarPendente(pendente())
    await guardarPendente(pendente())
    api.expirada = true

    const r = await sincronizarPendentes(7, api.enviar)

    expect(r.parouPor).toBe('sessaoExpirada')
    expect(api.chamadas).toHaveLength(1)
    expect(await listarPendentes(7)).toHaveLength(2)
  })

  it('cada usuário só envia os próprios lotes', async () => {
    const api = apiFalsa()
    const meu = pendente(7)
    const deOutro = pendente(8)
    await guardarPendente(meu)
    await guardarPendente(deOutro)

    await sincronizarPendentes(7, api.enviar)

    expect(api.chamadas).toEqual([meu.chave])
    expect((await listarPendentes(8)).map((p) => p.chave)).toEqual([deOutro.chave])
  })
})

describe('classificarErro', () => {
  const erro = (status: number) => new ApiError(status, { codigo: 'X', mensagem: 'm' })
  it.each([
    [0, 'tentarDepois'],
    [408, 'tentarDepois'],
    [429, 'tentarDepois'],
    [500, 'tentarDepois'],
    [502, 'tentarDepois'],
    [503, 'tentarDepois'],
    [401, 'sessaoExpirada'],
    [400, 'recusado'],
    [403, 'recusado'],
    [409, 'recusado'],
    [422, 'recusado'],
  ])('HTTP %i → %s', (status, tipo) => {
    expect(classificarErro(erro(status)).tipo).toBe(tipo)
  })
  it('erro que não veio da API (ex.: tempo esgotado lendo a resposta) → tentar depois', () => {
    expect(classificarErro(new DOMException('aborted', 'AbortError')).tipo).toBe('tentarDepois')
  })
})

describe('novaChave', () => {
  it('gera UUID v4 diferente a cada lote', () => {
    const chaves = new Set(Array.from({ length: 200 }, novaChave))
    expect(chaves.size).toBe(200)
    for (const c of chaves) expect(c).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
