import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ViewState } from '../../components/ui'

/*
 * Botão "Exportar para Excel (.xlsx)" na tela de Relatórios (issue #159). A store é trocada por uma falsa, para
 * escolher o estado da tela sem API; a tela é renderizada para HTML (react-dom/server), sem navegador. O clique e o
 * download de verdade são testados em e2e/planilha.spec.ts.
 */

const tela = vi.hoisted(() => ({
  estado: 'dados' as ViewState,
  lotes: { carregando: false, erro: false },
  resumo: [] as { processoId: string; real: number; esperado: number; lotes: number; pecas: number; litrosPorPeca: number }[],
}))

vi.mock('../../store', () => ({
  periodoAtual: () => ({ mes: 11, ano: 2026 }),
  useApp: () => ({ nomeProcesso: (id: string) => id, usuario: null, notificar: () => {} }),
  useResumo: () => ({ dados: tela.resumo, carregando: tela.estado === 'carregando', erro: false, recarregar: () => {} }),
  useLotesDoMes: () => ({ dados: [], carregando: tela.lotes.carregando, erro: tela.lotes.erro, recarregar: () => {} }),
  useEstadoTela: () => [tela.estado, () => {}],
}))

const { Relatorios, gerarComAviso } = await import('../Relatorios')

const RESUMO = [{ processoId: '1', real: 7600, esperado: 8000, lotes: 10, pecas: 1200, litrosPorPeca: 6.33 }]

/** A tag <button> que contém o texto. */
function botao(html: string, texto: string): string {
  const achado = [...html.matchAll(/<button[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]).find((b) => b.includes(texto))
  if (!achado) throw new Error(`Botão "${texto}" não encontrado`)
  return achado.slice(0, achado.indexOf('>') + 1)
}
const desabilitado = (html: string, texto: string) => botao(html, texto).includes('disabled=""')

beforeEach(() => {
  tela.estado = 'dados'
  tela.lotes = { carregando: false, erro: false }
  tela.resumo = RESUMO
})

describe('botão da planilha Excel em Relatórios', () => {
  it('com o resumo e os lotes do mês carregados, fica habilitado ao lado do PDF', () => {
    const html = renderToStaticMarkup(h(Relatorios))
    expect(desabilitado(html, 'Exportar para Excel (.xlsx)')).toBe(false)
    expect(desabilitado(html, 'Baixar PDF')).toBe(false)
  })

  it('espera os lotes do mês chegarem, sem travar o PDF', () => {
    tela.lotes.carregando = true
    const html = renderToStaticMarkup(h(Relatorios))
    expect(desabilitado(html, 'Exportar para Excel (.xlsx)')).toBe(true)
    expect(desabilitado(html, 'Baixar PDF')).toBe(false)
  })

  it('fica desabilitado se os lotes do mês não carregaram', () => {
    tela.lotes.erro = true
    expect(desabilitado(renderToStaticMarkup(h(Relatorios)), 'Exportar para Excel (.xlsx)')).toBe(true)
  })

  it('fica desabilitado enquanto o resumo carrega', () => {
    tela.estado = 'carregando'
    expect(desabilitado(renderToStaticMarkup(h(Relatorios)), 'Exportar para Excel (.xlsx)')).toBe(true)
  })

  it('sem lotes no período, fica desabilitado e aponta para o aviso', () => {
    tela.resumo = []
    const html = renderToStaticMarkup(h(Relatorios))
    expect(desabilitado(html, 'Exportar para Excel (.xlsx)')).toBe(true)
    expect(botao(html, 'Exportar para Excel (.xlsx)')).toContain('aria-describedby="aviso-sem-lotes"')
    expect(html).toContain('Sem lotes neste período')
  })
})

describe('gerarComAviso', () => {
  afterEach(() => vi.restoreAllMocks())

  it('avisa o nome do arquivo baixado', async () => {
    const notificar = vi.fn()
    expect(await gerarComAviso(async () => 'aguas-do-capibaribe-relatorio-2026-11.xlsx', notificar)).toBe(true)
    expect(notificar).toHaveBeenCalledWith('aguas-do-capibaribe-relatorio-2026-11.xlsx baixado.')
  })

  it('se der erro, não avisa, registra no console e devolve false', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const notificar = vi.fn()
    expect(
      await gerarComAviso(async () => {
        throw new Error('sem memória')
      }, notificar),
    ).toBe(false)
    expect(notificar).not.toHaveBeenCalled()
    expect(erro).toHaveBeenCalled()
  })
})
