import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  algumEsperando,
  CANAL_FILA,
  CANAL_SYNC,
  enviarComToken,
  expiracaoDoToken,
  ouvirSegundoPlano,
  pedirEnvioEmSegundoPlano,
  sincronizarEmSegundoPlano,
  sobrouParaDepois,
  textoEnviadosEmSegundoPlano,
  tratarSync,
  TAG_SYNC,
  type AvisoSegundoPlano,
  type EventoSync,
} from '../envioSegundoPlano'
import { _fecharBanco, apagarCredencial, esquecerCredencial, guardarCredencial, guardarPendente, lerCredencial, listarPendentes, novaChave, type LotePendente } from '../filaOffline'
import { ApiError, limparSessao, semBarraNoFim } from '../http'
import type { LoteDTO } from '../tipos'

/*
 * Background Sync (issue #160): o service worker envia os lotes do IndexedDB quando a rede volta, com o token
 * guardado só enquanto houver lote esperando.
 */

const AGORA = Date.UTC(2026, 10, 18, 12, 0, 0)
const DAQUI_A_1H = AGORA + 60 * 60 * 1000

/** JWT de mentira: só o payload importa aqui (a API é quem confere a assinatura). */
function jwt(payload: object) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.assinatura`
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
    criadoEm: new Date(Date.UTC(2026, 10, 18, 11, 0, relogio)).toISOString(),
    estado: 'pendente',
    tentativas: 0,
    ...extra,
  }
}

function loteDe(p: LotePendente, id: number): LoteDTO {
  return { id, processoId: p.processoId, pecas: p.pecas, litros: p.litros, esperado: 100, desvio: 0, statusConformidade: 'DENTRO_DA_META', data: new Date(AGORA).toISOString(), usuarioId: p.usuarioId }
}

const semConexao = () => new ApiError(0, { codigo: 'SEM_CONEXAO', mensagem: 'Não foi possível conectar ao servidor.' })

beforeEach(async () => {
  await _fecharBanco()
  globalThis.indexedDB = new IDBFactory()
})
afterEach(async () => {
  await _fecharBanco()
  vi.unstubAllGlobals()
})

describe('credencial no IndexedDB', () => {
  it('guarda, lê e apaga o token', async () => {
    expect(await lerCredencial()).toBeUndefined()
    await guardarCredencial({ token: 't', usuarioId: 7, expiraEm: DAQUI_A_1H })
    expect(await lerCredencial()).toEqual({ token: 't', usuarioId: 7, expiraEm: DAQUI_A_1H })
    await apagarCredencial()
    expect(await lerCredencial()).toBeUndefined()
  })

  it('esquecerCredencial e limparSessao (logout, 401) apagam o token sem falhar', async () => {
    await esquecerCredencial()
    await guardarCredencial({ token: 't', usuarioId: 7, expiraEm: DAQUI_A_1H })
    await esquecerCredencial()
    expect(await lerCredencial()).toBeUndefined()

    await guardarCredencial({ token: 't', usuarioId: 7, expiraEm: DAQUI_A_1H })
    const sessao = new Map([['ac-token', 't']])
    vi.stubGlobal('sessionStorage', { removeItem: (k: string) => sessao.delete(k) })
    limparSessao()
    expect(sessao.size).toBe(0)
    await vi.waitFor(async () => expect(await lerCredencial()).toBeUndefined())
  })

  it('esquecerCredencial não quebra sem IndexedDB ou com o banco com defeito', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(esquecerCredencial()).resolves.toBeUndefined()
    vi.unstubAllGlobals()

    await _fecharBanco()
    globalThis.indexedDB = { open: () => { throw new Error('IndexedDB bloqueado') } } as unknown as IDBFactory
    await expect(esquecerCredencial()).resolves.toBeUndefined()
  })

  it('atualiza o banco da versão 1 sem perder os lotes guardados', async () => {
    const p = pendente()
    const v1 = await openDB('aguas-offline', 1, {
      upgrade(db) {
        db.createObjectStore('lotesPendentes', { keyPath: 'chave' }).createIndex('porUsuario', 'usuarioId')
        db.createObjectStore('cache')
      },
    })
    await v1.put('lotesPendentes', p)
    v1.close()

    await guardarCredencial({ token: 't', usuarioId: 7, expiraEm: DAQUI_A_1H })
    expect(await listarPendentes(7)).toEqual([p])
    expect(await lerCredencial()).toMatchObject({ token: 't' })
  })
})

describe('expiracaoDoToken', () => {
  it('lê o exp do JWT (base64url)', () => {
    expect(expiracaoDoToken(jwt({ sub: 'operador', exp: 1_800_000_000 }))).toBe(1_800_000_000_000)
  })

  it('sem exp legível, conta 8 horas a partir de agora', () => {
    const oitoHoras = 8 * 60 * 60 * 1000
    expect(expiracaoDoToken('nao-e-jwt', AGORA)).toBe(AGORA + oitoHoras)
    expect(expiracaoDoToken(jwt({ sub: 'x' }), AGORA)).toBe(AGORA + oitoHoras)
    expect(expiracaoDoToken('a.%%%.c', AGORA)).toBe(AGORA + oitoHoras)
  })
})

describe('semBarraNoFim', () => {
  it('tira só as barras do fim', () => {
    expect(semBarraNoFim('/api/')).toBe('/api')
    expect(semBarraNoFim('http://x/api///')).toBe('http://x/api')
    expect(semBarraNoFim('http://x/api')).toBe('http://x/api')
    expect(semBarraNoFim('///')).toBe('')
    expect(semBarraNoFim('')).toBe('')
  })
})

describe('enviarComToken (POST /lotes de dentro do service worker)', () => {
  it('manda o token, a Idempotency-Key e só os dados do lote', async () => {
    const p = pendente()
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify(loteDe(p, 41)), { status: 201 }))
    vi.stubGlobal('fetch', fetchFalso)

    const lote = await enviarComToken('tok', '/api/', 'https://aguas.exemplo')(p)

    expect(lote.id).toBe(41)
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [URL, RequestInit]
    expect(String(url)).toBe('https://aguas.exemplo/api/lotes')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Idempotency-Key': p.chave })
    expect(JSON.parse(String(init.body))).toEqual({ processoId: p.processoId, pecas: p.pecas, litros: p.litros })
  })

  it('rede fora vira status 0 (tentar depois)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(enviarComToken('tok', 'http://api')(pendente())).rejects.toMatchObject({ status: 0, codigo: 'SEM_CONEXAO' })
  })

  it('429 traz o Retry-After; sem ele, espera um minuto', async () => {
    const corpo = JSON.stringify({ codigo: 'LIMITE_EXCEDIDO', mensagem: 'Muitas tentativas.' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(corpo, { status: 429, headers: { 'Retry-After': '17' } })))
    await expect(enviarComToken('tok', 'http://api')(pendente())).rejects.toMatchObject({ status: 429, codigo: 'LIMITE_EXCEDIDO', esperarSegundos: 17 })

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })))
    await expect(enviarComToken('tok', 'http://api')(pendente())).rejects.toMatchObject({ status: 429, esperarSegundos: 60 })
  })

  it('recusa da API mantém código e campos', async () => {
    const corpo = JSON.stringify({ codigo: 'VALIDACAO', mensagem: 'Verifique', campos: { processoId: 'Selecione um processo válido.' } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(corpo, { status: 422 })))
    await expect(enviarComToken('tok', 'http://api')(pendente())).rejects.toMatchObject({
      status: 422,
      campos: { processoId: 'Selecione um processo válido.' },
      esperarSegundos: null,
    })
  })
})

describe('sincronizarEmSegundoPlano (evento sync-lotes)', () => {
  const credencial = (extra = {}) => guardarCredencial({ token: 'tok', usuarioId: 7, expiraEm: DAQUI_A_1H, ...extra })

  it('sem token guardado não faz nada', async () => {
    await guardarPendente(pendente())
    const criarEnvio = vi.fn()
    expect(await sincronizarEmSegundoPlano({ criarEnvio, agora: () => AGORA })).toBe('semCredencial')
    expect(criarEnvio).not.toHaveBeenCalled()
  })

  it('token expirado é apagado sem ir à rede', async () => {
    await guardarPendente(pendente())
    await credencial({ expiraEm: AGORA })
    const criarEnvio = vi.fn()
    expect(await sincronizarEmSegundoPlano({ criarEnvio, agora: () => AGORA })).toBe('semCredencial')
    expect(criarEnvio).not.toHaveBeenCalled()
    expect(await lerCredencial()).toBeUndefined()
  })

  it('rede de volta: envia tudo na ordem, avisa as abas e apaga o token', async () => {
    const [a, b] = [pendente(), pendente()]
    await guardarPendente(b)
    await guardarPendente(a)
    await credencial()
    const chamadas: string[] = []
    const avisos: AvisoSegundoPlano[] = []

    const r = await sincronizarEmSegundoPlano({
      criarEnvio: (token) => async (p) => {
        expect(token).toBe('tok')
        chamadas.push(p.chave)
        return loteDe(p, chamadas.length)
      },
      avisar: (x) => avisos.push(x),
      agora: () => AGORA,
    })

    expect(r).toBe('concluido')
    expect(chamadas).toEqual([a.chave, b.chave])
    expect(avisos).toEqual([{ tipo: 'lotesEnviados', usuarioId: 7, lotes: [loteDe(a, 1), loteDe(b, 2)], recusados: 0 }])
    expect(await listarPendentes(7)).toEqual([])
    expect(await lerCredencial()).toBeUndefined()
  })

  it('por padrão envia pela API com o token guardado', async () => {
    const p = pendente()
    await guardarPendente(p)
    await credencial()
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify(loteDe(p, 5)), { status: 201 }))
    vi.stubGlobal('fetch', fetchFalso)

    expect(await sincronizarEmSegundoPlano({ avisar: vi.fn(), agora: () => AGORA })).toBe('concluido')
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [URL, RequestInit]
    expect(String(url)).toMatch(/\/lotes$/)
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Idempotency-Key': p.chave })
  })

  it('ainda sem conexão: pede nova tentativa e mantém o token', async () => {
    await guardarPendente(pendente())
    await credencial()
    const avisar = vi.fn()
    const r = await sincronizarEmSegundoPlano({ criarEnvio: () => () => Promise.reject(semConexao()), avisar, agora: () => AGORA })
    expect(r).toBe('tentarDepois')
    expect(avisar).not.toHaveBeenCalled()
    expect(await lerCredencial()).toBeDefined()
    expect(await listarPendentes(7)).toHaveLength(1)
  })

  it('sessão expirada (401): apaga o token e não repete; os lotes esperam o próximo login', async () => {
    await guardarPendente(pendente())
    await credencial()
    const r = await sincronizarEmSegundoPlano({
      criarEnvio: () => () => Promise.reject(new ApiError(401, { codigo: 'NAO_AUTENTICADO', mensagem: 'Sessão expirada.' })),
      avisar: vi.fn(),
      agora: () => AGORA,
    })
    expect(r).toBe('concluido')
    expect(await lerCredencial()).toBeUndefined()
    expect(await listarPendentes(7)).toHaveLength(1)
  })

  it('lote recusado: avisa as abas e libera o token (o operador decide na tela)', async () => {
    await guardarPendente(pendente())
    await credencial()
    const avisos: AvisoSegundoPlano[] = []
    const r = await sincronizarEmSegundoPlano({
      criarEnvio: () => () => Promise.reject(new ApiError(422, { codigo: 'VALIDACAO', mensagem: 'Processo inválido.' })),
      avisar: (x) => avisos.push(x),
      agora: () => AGORA,
    })
    expect(r).toBe('concluido')
    expect(avisos).toEqual([{ tipo: 'lotesEnviados', usuarioId: 7, lotes: [], recusados: 1 }])
    expect((await listarPendentes(7))[0].estado).toBe('recusado')
    expect(await lerCredencial()).toBeUndefined()
  })

  it('avisa as abas pelo BroadcastChannel por padrão', async () => {
    const p = pendente()
    await guardarPendente(p)
    await credencial()
    const recebidos: LoteDTO[][] = []
    const pararDeOuvir = ouvirSegundoPlano(7, (x) => recebidos.push(x))
    const fila: unknown[] = []
    const canalFila = new BroadcastChannel(CANAL_FILA)
    canalFila.onmessage = (e) => fila.push(e.data)

    await sincronizarEmSegundoPlano({ criarEnvio: () => async (x) => loteDe(x, 9), agora: () => AGORA })
    await vi.waitFor(() => expect(recebidos).toHaveLength(1))
    await vi.waitFor(() => expect(fila).toEqual(['mudou']))
    pararDeOuvir()
    canalFila.close()

    expect(recebidos[0]).toMatchObject([{ id: 9 }])
  })

  it('ouvirSegundoPlano só repassa lotes enviados deste usuário', async () => {
    const recebidos: LoteDTO[][] = []
    const pararDeOuvir = ouvirSegundoPlano(7, (x) => recebidos.push(x))
    const lote = loteDe(pendente(), 3)
    const canal = new BroadcastChannel(CANAL_SYNC)
    canal.postMessage(null)
    canal.postMessage({ tipo: 'outra-coisa' })
    canal.postMessage({ tipo: 'lotesEnviados', usuarioId: 8, lotes: [lote], recusados: 0 })
    canal.postMessage({ tipo: 'lotesEnviados', usuarioId: 7, lotes: [], recusados: 1 })
    canal.postMessage({ tipo: 'lotesEnviados', usuarioId: 7, lotes: [lote], recusados: 0 })
    canal.close()
    await vi.waitFor(() => expect(recebidos).toEqual([[lote]]))
    pararDeOuvir()
  })

  it('sem BroadcastChannel, não avisa nem ouve (e não quebra)', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const p = pendente()
    await guardarPendente(p)
    await credencial()
    expect(await sincronizarEmSegundoPlano({ criarEnvio: () => async (x) => loteDe(x, 1), agora: () => AGORA })).toBe('concluido')
    const parar = ouvirSegundoPlano(7, vi.fn())
    expect(() => parar()).not.toThrow()
  })
})

describe('decisões da página', () => {
  it('algumEsperando ignora os recusados', () => {
    expect(algumEsperando([])).toBe(false)
    expect(algumEsperando([pendente(7, { estado: 'recusado' })])).toBe(false)
    expect(algumEsperando([pendente(7, { estado: 'recusado' }), pendente()])).toBe(true)
  })

  it('sobrouParaDepois: só sem conexão ou no limite por minuto', () => {
    const r = { enviados: [], recusados: [], restantes: 1 }
    expect(sobrouParaDepois({ ...r, parouPor: 'semConexao' })).toBe(true)
    expect(sobrouParaDepois({ ...r, parouPor: 'limite' })).toBe(true)
    expect(sobrouParaDepois({ ...r, parouPor: 'sessaoExpirada' })).toBe(false)
    expect(sobrouParaDepois({ ...r, restantes: 0 })).toBe(false)
  })

  it('texto do aviso no singular e no plural', () => {
    expect(textoEnviadosEmSegundoPlano(1)).toBe('Sincronizado em segundo plano: 1 lote guardado foi enviado.')
    expect(textoEnviadosEmSegundoPlano(3)).toBe('Sincronizado em segundo plano: 3 lotes guardados foram enviados.')
  })
})

describe('tratarSync', () => {
  const evento = (tag: string) => {
    let promessa: Promise<unknown> | undefined
    const e: EventoSync = { tag, waitUntil: (p) => (promessa = p) }
    return { e, promessa: () => promessa }
  }

  it('ignora outras tags', () => {
    const { e, promessa } = evento('outra')
    const sincronizar = vi.fn()
    tratarSync(e, sincronizar)
    expect(sincronizar).not.toHaveBeenCalled()
    expect(promessa()).toBeUndefined()
  })

  it('sync-lotes concluído resolve; ainda pendente rejeita para o navegador tentar de novo', async () => {
    const ok = evento(TAG_SYNC)
    tratarSync(ok.e, async () => 'concluido')
    await expect(ok.promessa()).resolves.toBeUndefined()

    const depois = evento(TAG_SYNC)
    tratarSync(depois.e, async () => 'tentarDepois')
    await expect(depois.promessa()).rejects.toThrow('tenta de novo')
  })
})

describe('pedirEnvioEmSegundoPlano (lado da página)', () => {
  const token = jwt({ sub: 'operador', exp: DAQUI_A_1H / 1000 })
  const swCom = (registro: unknown) => ({ getRegistration: async () => registro as never })

  it('com Background Sync: guarda o token e registra a tag sync-lotes', async () => {
    const register = vi.fn(async () => {})
    const ok = await pedirEnvioEmSegundoPlano(7, token, swCom({ active: {}, sync: { register } }), AGORA)
    expect(ok).toBe(true)
    expect(register).toHaveBeenCalledWith(TAG_SYNC)
    expect(await lerCredencial()).toEqual({ token, usuarioId: 7, expiraEm: DAQUI_A_1H })
  })

  it('sem Background Sync (Firefox, Safari) ou sem service worker ativo: não guarda o token', async () => {
    expect(await pedirEnvioEmSegundoPlano(7, token, swCom({ active: {} }), AGORA)).toBe(false)
    expect(await pedirEnvioEmSegundoPlano(7, token, swCom({ active: null, sync: { register: vi.fn() } }), AGORA)).toBe(false)
    expect(await pedirEnvioEmSegundoPlano(7, token, swCom(undefined), AGORA)).toBe(false)
    expect(await pedirEnvioEmSegundoPlano(7, token, undefined, AGORA)).toBe(false)
    expect(await lerCredencial()).toBeUndefined()
  })

  it('sem token, ou com token já vencido: não guarda nada', async () => {
    const register = vi.fn(async () => {})
    const sw = swCom({ active: {}, sync: { register } })
    expect(await pedirEnvioEmSegundoPlano(7, null, sw, AGORA)).toBe(false)
    expect(await pedirEnvioEmSegundoPlano(7, jwt({ exp: AGORA / 1000 - 1 }), sw, AGORA)).toBe(false)
    expect(register).not.toHaveBeenCalled()
    expect(await lerCredencial()).toBeUndefined()
  })
})
