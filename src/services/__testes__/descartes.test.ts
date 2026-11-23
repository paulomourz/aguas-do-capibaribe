import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FORM_DESCARTE_VAZIO } from '../../domain/descarte'
import type { DescarteDTO } from '../tipos'

/* Chamadas à API do descarte de efluentes e o salvar da tela (issues #201 e #202), sem rede. */

const http = vi.hoisted(() => ({ requisicao: vi.fn() }))
vi.mock('../http', async (original) => ({ ...(await original<typeof import('../http')>()), requisicao: http.requisicao }))

const { ApiError } = await import('../http')
const { listarDescartes, registrarDescarte, salvarDescarte } = await import('../descartes')

const GRAVADO: DescarteDTO = {
  id: 1, loteId: 10, data: '2026-11-23T15:00:00Z', volumeLitros: 200, ph: 7.5, turbidezNtu: 12, reutilizadoPercentual: 0,
}
const FORM = { ...FORM_DESCARTE_VAZIO, volumeLitros: '200', ph: '7,5', turbidezNtu: '12' }

beforeEach(() => http.requisicao.mockReset())

describe('API dos descartes', () => {
  it('lista pela rota do lote', async () => {
    http.requisicao.mockResolvedValue([GRAVADO])
    expect(await listarDescartes(10)).toEqual([GRAVADO])
    expect(http.requisicao).toHaveBeenCalledWith('/lotes/10/descartes')
  })

  it('registra com POST e o corpo do descarte', async () => {
    http.requisicao.mockResolvedValue(GRAVADO)
    const dados = { volumeLitros: 200, ph: 7.5, turbidezNtu: 12, reutilizadoPercentual: 0 }
    expect(await registrarDescarte(10, dados)).toEqual(GRAVADO)
    expect(http.requisicao).toHaveBeenCalledWith('/lotes/10/descartes', { method: 'POST', corpo: dados })
  })
})

describe('salvarDescarte', () => {
  it('formulário válido: envia e devolve o descarte gravado', async () => {
    const enviar = vi.fn().mockResolvedValue(GRAVADO)
    expect(await salvarDescarte(10, FORM, enviar)).toEqual({ ok: true, gravado: GRAVADO })
    expect(enviar).toHaveBeenCalledWith(10, { volumeLitros: 200, ph: 7.5, turbidezNtu: 12, reutilizadoPercentual: 0 })
  })

  it('formulário inválido: não envia nada', async () => {
    const enviar = vi.fn()
    const r = await salvarDescarte(10, { ...FORM, ph: '15' }, enviar)
    expect(r).toEqual({ ok: false, erros: { ph: 'O pH vai de 0 a 14.' } })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('422 da API: o erro volta para o campo', async () => {
    const enviar = vi.fn().mockRejectedValue(new ApiError(422, { codigo: 'VALIDACAO', mensagem: 'Verifique', campos: { ph: 'O pH vai de 0 a 14.' } }))
    expect(await salvarDescarte(10, FORM, enviar)).toEqual({ ok: false, erros: { ph: 'O pH vai de 0 a 14.' } })
  })

  it('outro erro da API: vira a mensagem do aviso', async () => {
    const enviar = vi.fn().mockRejectedValue(new ApiError(404, { codigo: 'NAO_ENCONTRADO', mensagem: 'Lote não encontrado.' }))
    expect(await salvarDescarte(10, FORM, enviar)).toEqual({ ok: false, erros: {}, mensagem: 'Lote não encontrado.' })
  })

  it('falha sem resposta da API: mensagem genérica', async () => {
    const enviar = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await salvarDescarte(10, FORM, enviar)).toEqual({ ok: false, erros: {}, mensagem: 'Erro inesperado. Tente novamente.' })
  })
})
