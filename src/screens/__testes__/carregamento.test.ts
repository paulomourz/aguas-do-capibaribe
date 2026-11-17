import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ViewState } from '../../components/ui'

/*
 * Dashboard e Relatórios enquanto os dados chegam (issue #161). A store é trocada por uma falsa, para escolher o
 * estado da tela sem API; a renderização é para HTML (react-dom/server), sem navegador.
 */

const tela = vi.hoisted(() => ({
  estado: 'carregando' as ViewState,
  carregandoLotes: false,
  processos: [] as { id: string; nome: string; unidade: 'lote'; meta: number }[],
  resumo: [] as { processoId: string; real: number; esperado: number; lotes: number; pecas: number; litrosPorPeca: number }[],
}))

vi.mock('../../store', () => ({
  periodoAtual: () => ({ mes: 11, ano: 2026 }),
  useApp: () => ({
    alertas: [],
    processos: tela.processos,
    nomeProcesso: (id: string) => tela.processos.find((p) => p.id === id)?.nome ?? id,
    usuario: null,
    notificar: () => {},
  }),
  useResumo: () => ({ dados: tela.resumo, carregando: tela.estado === 'carregando', erro: false, recarregar: () => {} }),
  useLotesDoMes: () => ({ dados: [], carregando: tela.carregandoLotes, erro: false, recarregar: () => {} }),
  useEstadoTela: () => [tela.estado, () => {}],
}))

const { default: Dashboard } = await import('../Dashboard')
const { Relatorios } = await import('../Relatorios')

const contar = (texto: string, trecho: string) => texto.split(trecho).length - 1
const PROCESSOS = [
  { id: '1', nome: 'Amaciamento', unidade: 'lote' as const, meta: 800 },
  { id: '2', nome: 'Estonagem', unidade: 'lote' as const, meta: 12 },
]

beforeEach(() => {
  tela.estado = 'carregando'
  tela.carregandoLotes = false
  tela.processos = []
  tela.resumo = []
})

describe('Dashboard carregando', () => {
  it('mostra um esqueleto por indicador, com o rótulo de verdade e um rodapé parecido com o real', () => {
    const saida = renderToStaticMarkup(h(Dashboard))
    expect(contar(saida, 'data-testid="skeleton-card"')).toBe(4)
    for (const rotulo of ['Consumo total do mês', 'Total esperado pela meta', 'Desvio geral', 'Água por peça']) expect(saida).toContain(rotulo)
    expect(saida).toContain('00 lotes em novembro de 2026')
    expect(saida).toContain('Soma das metas dos lotes registrados')
    expect(saida).toContain('0.000 L acima')
    expect(saida).toContain('Média do mês. Referência')
  })

  it('anuncia o carregamento dos indicadores e marca a região como ocupada', () => {
    const saida = renderToStaticMarkup(h(Dashboard))
    expect(saida).toContain('aria-label="Indicadores do mês" aria-busy="true"')
    expect(saida).toContain('<output class="sr-only">Carregando indicadores…</output>')
  })

  it('mostra os esqueletos dos dois gráficos no lugar deles', () => {
    const saida = renderToStaticMarkup(h(Dashboard))
    expect(contar(saida, 'data-testid="skeleton-chart"')).toBe(2)
    expect(saida).toContain('Carregando gráfico meta x real…')
    expect(saida).toContain('Carregando consumo por dia…')
  })

  it('usa os nomes dos processos já conhecidos no esqueleto do gráfico meta x real', () => {
    tela.processos = PROCESSOS
    const saida = renderToStaticMarkup(h(Dashboard))
    expect(saida).toContain('Amaciamento')
    expect(saida).toContain('Estonagem')
  })

  it('mostra a lista de alertas em esqueleto, no formato de cada item', () => {
    const saida = renderToStaticMarkup(h(Dashboard))
    expect(saida).toContain('<span class="sr-only">Carregando alertas…</span>')
    expect(contar(saida, '3 lotes consecutivos acima da meta')).toBe(2)
    expect(contar(saida, 'Ver detalhe')).toBe(2)
    expect(saida).not.toContain('Nenhum alerta ativo')
  })

  it('com os dados, troca os esqueletos pelos cards de verdade', () => {
    tela.estado = 'dados'
    tela.processos = PROCESSOS
    tela.resumo = [{ processoId: '1', real: 7600, esperado: 8000, lotes: 10, pecas: 1200, litrosPorPeca: 6.33 }]
    const saida = renderToStaticMarkup(h(Dashboard))
    expect(saida).not.toContain('data-testid="skeleton-card"')
    expect(saida).toContain('aria-busy="false"')
    expect(saida).toContain('Consumo total do mês')
    expect(saida).toContain('7.600')
  })
})

describe('Relatórios carregando', () => {
  it('a seção de gráficos já ocupa o seu lugar, com os dois esqueletos', () => {
    const saida = renderToStaticMarkup(h(Relatorios))
    expect(saida).toContain('Gráficos do período')
    expect(saida).toContain('aria-labelledby="graficos-titulo" aria-busy="true"')
    expect(contar(saida, 'data-testid="skeleton-chart"')).toBe(2)
    expect(saida).toContain('Carregando gráfico real x esperado…')
  })

  it('desabilita o filtro de processo enquanto o resumo não chega', () => {
    const saida = renderToStaticMarkup(h(Relatorios))
    expect(saida).toMatch(/<select[^>]*id="processo-grafico"[^>]*disabled=""/)
  })

  it('usa os nomes dos processos já conhecidos no esqueleto', () => {
    tela.processos = PROCESSOS
    const saida = renderToStaticMarkup(h(Relatorios))
    expect(contar(saida, 'Em atenção')).toBe(2)
    expect(saida).toContain('Amaciamento')
  })

  it('com o resumo e os lotes carregando, mostra o esqueleto do gráfico por dia', () => {
    tela.estado = 'dados'
    tela.carregandoLotes = true
    tela.processos = PROCESSOS
    tela.resumo = [{ processoId: '2', real: 13500, esperado: 12000, lotes: 9, pecas: 1000, litrosPorPeca: 13.5 }]
    const saida = renderToStaticMarkup(h(Relatorios))
    expect(saida).toContain('Carregando consumo por dia…')
    expect(saida).not.toMatch(/<select[^>]*id="processo-grafico"[^>]*disabled=""/)
  })

  it('com tudo carregado, os gráficos (ainda baixando a biblioteca) mostram o esqueleto do processo certo', () => {
    tela.estado = 'dados'
    tela.processos = PROCESSOS
    tela.resumo = [{ processoId: '2', real: 13500, esperado: 12000, lotes: 9, pecas: 1000, litrosPorPeca: 13.5 }]
    const saida = renderToStaticMarkup(h(Relatorios))
    expect(saida).toContain('aria-busy="false"')
    // O Suspense mostra o esqueleto enquanto o código do Recharts carrega, só com o processo que tem lotes.
    expect(contar(saida, 'Em atenção')).toBe(1)
    expect(saida).toContain('Estonagem')
  })

  it('sem lotes no mês, a seção de gráficos não aparece', () => {
    tela.estado = 'dados'
    const saida = renderToStaticMarkup(h(Relatorios))
    expect(saida).not.toContain('Gráficos do período')
    expect(saida).toContain('Sem lotes neste período')
  })
})
