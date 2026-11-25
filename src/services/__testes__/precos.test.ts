import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrecoM3DTO } from '../tipos'

/* Chamadas à API do preço do m³ e o salvar do formulário da tela Custo da água, sem rede. */

const http = vi.hoisted(() => ({ requisicao: vi.fn() }))
vi.mock('../http', async (original) => ({ ...(await original<typeof import('../http')>()), requisicao: http.requisicao }))

const { ApiError } = await import('../http')
const { cadastrarPrecoM3, listarPrecosM3, salvarPrecoM3 } = await import('../precos')

const SALVO: PrecoM3DTO = { id: 1, valor: 12.5, vigencia: '2026-11-01', cadastradoPor: 'Gestora', cadastradoEm: '2026-11-24T12:00:00Z' }

beforeEach(() => http.requisicao.mockReset())

describe('API do preço do m³', () => {
  it('lista o histórico', async () => {
    http.requisicao.mockResolvedValue([SALVO])
    expect(await listarPrecosM3()).toEqual([SALVO])
    expect(http.requisicao).toHaveBeenCalledWith('/precos-m3')
  })

  it('cadastra com POST e o corpo do preço', async () => {
    http.requisicao.mockResolvedValue(SALVO)
    expect(await cadastrarPrecoM3({ valor: 12.5, vigencia: '2026-11-01' })).toEqual(SALVO)
    expect(http.requisicao).toHaveBeenCalledWith('/precos-m3', { method: 'POST', corpo: { valor: 12.5, vigencia: '2026-11-01' } })
  })
})

describe('salvarPrecoM3', () => {
  it('valor no formato brasileiro: envia o número e devolve o preço salvo', async () => {
    const enviar = vi.fn().mockResolvedValue(SALVO)
    expect(await salvarPrecoM3('1.012,50', '2026-11-01', enviar)).toEqual({ ok: true, salvo: SALVO })
    expect(enviar).toHaveBeenCalledWith({ valor: 1012.5, vigencia: '2026-11-01' })
  })

  it('sem valor e sem data: não envia e aponta os dois campos', async () => {
    const enviar = vi.fn()
    expect(await salvarPrecoM3('  ', '', enviar)).toEqual({
      ok: false,
      erros: { valor: 'Informe o preço do m³.', vigencia: 'Informe a data a partir da qual o preço vale.' },
    })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('valor que não é número: não envia', async () => {
    const enviar = vi.fn()
    expect(await salvarPrecoM3('doze', '2026-11-01', enviar)).toEqual({ ok: false, erros: { valor: 'Use apenas números no preço, por exemplo 12,50.' } })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('422 da API: o erro volta para o campo', async () => {
    const enviar = vi.fn().mockRejectedValue(new ApiError(422, { codigo: 'VALIDACAO', mensagem: 'Verifique', campos: { valor: 'O preço do m³ deve ser maior que zero.' } }))
    expect(await salvarPrecoM3('0', '2026-11-01', enviar)).toEqual({ ok: false, erros: { valor: 'O preço do m³ deve ser maior que zero.' } })
  })

  it('outro erro da API: vira a mensagem do aviso', async () => {
    const enviar = vi.fn().mockRejectedValue(new ApiError(403, { codigo: 'PROIBIDO', mensagem: 'Sem permissão.' }))
    expect(await salvarPrecoM3('12', '2026-11-01', enviar)).toEqual({ ok: false, erros: {}, mensagem: 'Sem permissão.' })
  })

  it('falha sem resposta da API: mensagem genérica', async () => {
    const enviar = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await salvarPrecoM3('12', '2026-11-01', enviar)).toEqual({ ok: false, erros: {}, mensagem: 'Erro inesperado. Tente novamente.' })
  })
})
