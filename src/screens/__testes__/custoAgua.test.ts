import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fmtReais, type Lote, type PrecoM3 } from '../../domain'

/*
 * Tela Custo da água (G12) em cada estado. A store é trocada por uma falsa, para escolher os lotes e os preços sem API;
 * a tela é renderizada para HTML (react-dom/server), sem navegador. O cálculo está em domain/__testes__/custo.test.ts.
 */

const tela = vi.hoisted(() => ({
  lotes: { dados: [] as Lote[], carregando: false, erro: false },
  precos: { dados: [] as PrecoM3[], carregando: false, erro: false },
}))

vi.mock('../../store', () => ({
  periodoAtual: () => ({ mes: 11, ano: 2026 }),
  useApp: () => ({ nomeProcesso: (id: string) => `Processo ${id}`, notificar: () => {} }),
  useLotesDoMes: () => ({ ...tela.lotes, recarregar: () => {} }),
  usePrecosM3: () => ({ ...tela.precos, recarregar: () => {}, cadastrar: async () => tela.precos.dados[0] }),
}))

const { default: CustoAgua } = await import('../CustoAgua')

const lote = (processoId: string, litros: number, esperado: number, data: string): Lote => ({
  id: `${processoId}-${data}`,
  processoId,
  pecas: 10,
  litros,
  esperado,
  desvio: 0,
  status: 'ok',
  data: new Date(data),
  usuarioId: 'u1',
})
const preco = (valor: number, vigencia: string): PrecoM3 => ({
  id: vigencia,
  valor,
  vigencia,
  cadastradoPor: 'Gestora',
  cadastradoEm: new Date(`${vigencia}T12:00:00Z`),
})

const render = () => renderToStaticMarkup(h(CustoAgua))

beforeEach(() => {
  tela.lotes = { dados: [lote('1', 1500, 1000, '2026-11-10T12:00:00Z'), lote('2', 800, 1000, '2026-11-11T12:00:00Z')], carregando: false, erro: false }
  tela.precos = { dados: [preco(10, '2026-01-01')], carregando: false, erro: false }
})

describe('Custo da água', () => {
  it('mostra o custo do mês, o do excesso e a tabela por processo', () => {
    const html = render()
    expect(html).toContain('Custo por processo')
    expect(html).toContain('Processo 1')
    expect(html).toContain(fmtReais(23)) // 2.300 L a R$ 10/m³
    expect(html).toContain(fmtReais(5)) // 500 L de excesso, só do processo 1
    expect(html).toContain('Vigente hoje:')
    expect(html).toContain('Histórico do preço do m³')
    expect(html).not.toContain('fora do custo')
  })

  it('lote antes de qualquer preço: avisa que ficou fora do custo', () => {
    tela.precos.dados = [preco(10, '2026-11-11')]
    expect(render()).toContain('1 lote sem preço do m³ ficou fora do custo.')
  })

  it('sem preço cadastrado: pede o cadastro e mostra o custo como traço', () => {
    tela.precos.dados = []
    const html = render()
    expect(html).toContain('Cadastre o preço do m³ para ver o custo.')
    expect(html).toContain('Nenhum preço cadastrado')
    expect(html).toContain('Nenhum preço vigente hoje.')
    expect(html).toContain('—')
  })

  it('sem lotes no mês: estado vazio, e o cadastro de preço continua na tela', () => {
    tela.lotes.dados = []
    const html = render()
    expect(html).toContain('Sem lotes no período')
    expect(html).toContain('Cadastrar preço')
  })

  it('carregando: esqueleto do custo e dos preços', () => {
    tela.lotes.carregando = true
    tela.precos.carregando = true
    const html = render()
    expect(html).toContain('Carregando custo…')
    expect(html).toContain('Carregando preços…')
    expect(html).not.toContain('Vigente hoje:')
  })

  it('erro ao carregar: oferece tentar de novo no custo e nos preços', () => {
    tela.precos.erro = true
    const html = render()
    expect(html).toContain('Não foi possível carregar o custo')
    expect(html).toContain('Não foi possível carregar os preços')
  })
})
