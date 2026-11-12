import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, requisicao } from '../http'
import { _limparBloqueios, escopoDaRota, estaBloqueado, lerRetryAfter, registrarBloqueio, segundosRestantes } from '../limite'

/*
 * Erro 429 (issue #101, RNF19): a API manda Retry-After; o site não dispara a mesma ação até o prazo acabar.
 */

describe('lerRetryAfter', () => {
  const agora = Date.UTC(2026, 10, 11, 12, 0, 0)
  it.each([
    ['30', 30],
    [' 5 ', 5],
    ['0', 0],
    [new Date(agora + 42_000).toUTCString(), 42],
    [new Date(agora - 5_000).toUTCString(), 0],
    [null, null],
    ['', null],
    ['amanhã', null],
    ['-3', null],
  ])('%j → %j', (valor, esperado) => {
    expect(lerRetryAfter(valor, agora)).toBe(esperado)
  })
})

describe('escopoDaRota', () => {
  it('só o POST de login e o POST de lotes são limitados (como no FiltroDeLimite)', () => {
    expect(escopoDaRota('/auth/login', 'POST')).toBe('login')
    expect(escopoDaRota('/lotes', 'post')).toBe('lotes')
    expect(escopoDaRota('/lotes', 'GET')).toBeNull()
    expect(escopoDaRota('/lotes')).toBeNull()
    expect(escopoDaRota('/auth/me', 'POST')).toBeNull()
  })
})

describe('bloqueio por ação', () => {
  beforeEach(() => _limparBloqueios())

  it('conta os segundos até liberar e libera no fim', () => {
    const t0 = 1_000_000
    registrarBloqueio('lotes', 30, t0)
    expect(segundosRestantes('lotes', t0)).toBe(30)
    expect(segundosRestantes('lotes', t0 + 10_500)).toBe(20)
    expect(estaBloqueado('login', t0)).toBe(false)
    expect(segundosRestantes('lotes', t0 + 30_000)).toBe(0)
  })

  it('um prazo mais curto não encurta o que já está valendo', () => {
    const t0 = 1_000_000
    registrarBloqueio('login', 50, t0)
    registrarBloqueio('login', 10, t0 + 1000)
    expect(segundosRestantes('login', t0 + 1000)).toBe(49)
  })
})

describe('requisicao com 429', () => {
  const fetchFalso = vi.fn<typeof fetch>()

  beforeEach(() => {
    _limparBloqueios()
    fetchFalso.mockReset()
    vi.stubGlobal('fetch', fetchFalso)
    vi.stubGlobal('window', { location: { origin: 'http://localhost', hash: '' }, dispatchEvent: () => true })
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
  })
  afterEach(() => vi.unstubAllGlobals())

  const resposta429 = (retryAfter?: string) =>
    new Response(JSON.stringify({ codigo: 'LIMITE_EXCEDIDO', mensagem: 'Muitas tentativas. Aguarde 30 segundos e tente de novo.' }), {
      status: 429,
      headers: retryAfter ? { 'Retry-After': retryAfter, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    })

  it('lê o Retry-After, guarda o prazo e não dispara de novo até ele acabar', async () => {
    fetchFalso.mockResolvedValueOnce(resposta429('30'))

    const e1 = await requisicao('/auth/login', { method: 'POST', corpo: {} }).catch((e: unknown) => e)
    expect(e1).toBeInstanceOf(ApiError)
    expect((e1 as ApiError).status).toBe(429)
    expect((e1 as ApiError).codigo).toBe('LIMITE_EXCEDIDO')
    expect((e1 as ApiError).esperarSegundos).toBe(30)
    expect(segundosRestantes('login')).toBe(30)

    // Segundo clique durante a espera: recusado no aparelho, sem ir à rede.
    const e2 = await requisicao('/auth/login', { method: 'POST', corpo: {} }).catch((e: unknown) => e)
    expect((e2 as ApiError).status).toBe(429)
    expect(fetchFalso).toHaveBeenCalledTimes(1)

    // As outras ações continuam livres.
    fetchFalso.mockResolvedValueOnce(new Response('[]', { status: 200 }))
    await expect(requisicao('/lotes')).resolves.toEqual([])
  })

  it('sem o cabeçalho (ex.: CORS escondendo), espera a janela inteira de um minuto', async () => {
    fetchFalso.mockResolvedValueOnce(resposta429())
    const e = await requisicao('/lotes', { method: 'POST', corpo: {} }).catch((x: unknown) => x)
    expect((e as ApiError).esperarSegundos).toBe(60)
    expect(segundosRestantes('lotes')).toBe(60)
  })

  it('depois do prazo, volta a enviar', async () => {
    vi.useFakeTimers()
    try {
      fetchFalso.mockResolvedValueOnce(resposta429('2'))
      await requisicao('/lotes', { method: 'POST', corpo: {} }).catch(() => {})
      vi.advanceTimersByTime(2_000)
      fetchFalso.mockResolvedValueOnce(new Response('{"id":1}', { status: 201 }))
      await expect(requisicao('/lotes', { method: 'POST', corpo: {} })).resolves.toEqual({ id: 1 })
      expect(fetchFalso).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
