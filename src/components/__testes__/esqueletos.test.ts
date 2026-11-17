import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SkeletonCard from '../SkeletonCard'
import SkeletonChart from '../SkeletonChart'
import { SeloFantasma, TextoFantasma } from '../ui'

/*
 * Esqueletos das telas do gestor (issue #161). O Vitest roda sem navegador, então os componentes são renderizados
 * para HTML com o react-dom/server e o teste confere a estrutura: o que o leitor de tela anuncia, o que fica
 * escondido dele e os textos fantasmas que reservam o espaço do conteúdo real. O tamanho na tela (CLS) é medido no
 * navegador, em e2e/carregamento.spec.ts.
 */

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el)
/** Quantas vezes um trecho aparece no HTML. */
const contar = (texto: string, trecho: string) => texto.split(trecho).length - 1

describe('TextoFantasma', () => {
  it('mostra o texto transparente sobre o fundo do esqueleto, para ocupar o mesmo espaço', () => {
    const saida = html(h(TextoFantasma, null, 'Soma das metas'))
    expect(saida).toContain('Soma das metas')
    expect(saida).toMatch(/class="skeleton rounded text-transparent"/)
  })

  it('aceita classes extras', () => {
    expect(html(h(TextoFantasma, { className: 'font-semibold', children: 'x' }))).toContain('text-transparent font-semibold')
  })
})

describe('SeloFantasma', () => {
  it('tem o tamanho do selo pequeno, com o espaço do ícone de 16 px', () => {
    const saida = html(h(SeloFantasma, null, 'Atenção'))
    expect(saida).toContain('px-2.5 py-1 text-[13px]')
    expect(saida).toContain('h-4 w-4')
    expect(saida).toContain('Atenção')
  })

  it('é uma pílula (StatusBadge) por padrão e uma etiqueta (AlertBadge) quando pedido', () => {
    expect(html(h(SeloFantasma, null, 'Ok'))).toContain('rounded-full')
    const etiqueta = html(h(SeloFantasma, { forma: 'etiqueta', children: 'Aberto' }))
    expect(etiqueta).toContain('rounded-md')
    expect(etiqueta).not.toContain('rounded-full')
  })
})

describe('SkeletonCard', () => {
  it('mostra o rótulo de verdade e esconde o esqueleto do leitor de tela', () => {
    const saida = html(h(SkeletonCard, { label: 'Consumo total do mês' }))
    expect(saida).toContain('Consumo total do mês')
    expect(saida).toContain('data-testid="skeleton-card"')
    expect(saida).toContain('aria-hidden="true"')
  })

  it('repete a estrutura do KpiCard: ícone de 40 px e valor em 32 px sem entrelinha', () => {
    const saida = html(h(SkeletonCard, { label: 'Desvio geral' }))
    expect(saida).toContain('h-10 w-10')
    expect(saida).toContain('text-[32px]')
    expect(saida).toContain('leading-none')
  })

  it('usa um rodapé fantasma padrão ou o rodapé recebido', () => {
    expect(html(h(SkeletonCard, { label: 'A' }))).toContain('Carregando dados do mês')
    const comRodape = html(h(SkeletonCard, { label: 'A', rodape: h(TextoFantasma, null, '00 lotes em novembro de 2026') }))
    expect(comRodape).toContain('00 lotes em novembro de 2026')
    expect(comRodape).not.toContain('Carregando dados do mês')
  })
})

describe('SkeletonChart', () => {
  it('anuncia o carregamento para o leitor de tela e esconde o desenho', () => {
    const saida = html(h(SkeletonChart, { formato: 'agua', label: 'Carregando gráfico meta x real…' }))
    expect(saida).toMatch(/^<div role="status"/)
    expect(saida).toContain('<span class="sr-only">Carregando gráfico meta x real…</span>')
    expect(saida).toContain('<div aria-hidden="true">')
    expect(saida).toContain('data-testid="skeleton-chart"')
  })

  it('tem um texto de carregamento padrão', () => {
    expect(html(h(SkeletonChart, { formato: 'diario' }))).toContain('Carregando gráfico…')
  })

  it("'agua': legenda, área de 240 px e um rótulo por processo, com os nomes recebidos", () => {
    const saida = html(h(SkeletonChart, { formato: 'agua', nomes: ['Amaciamento', 'Estonagem'] }))
    expect(saida).toContain('Valores em mil L')
    expect(saida).toContain('height:240px')
    expect(saida).toContain('Amaciamento')
    expect(saida).toContain('Estonagem')
    // Duas barras (meta e real) por processo.
    expect(contar(saida, 'rounded-b-none')).toBe(4)
  })

  it('sem nomes, usa três processos genéricos', () => {
    const saida = html(h(SkeletonChart, { formato: 'agua' }))
    expect(contar(saida, '>Processo<')).toBe(3)
    expect(contar(saida, 'rounded-b-none')).toBe(6)
  })

  it('repete a altura das barras de exemplo quando há mais processos que exemplos', () => {
    const saida = html(h(SkeletonChart, { formato: 'agua', nomes: ['A', 'B', 'C', 'D', 'E'] }))
    expect(contar(saida, 'rounded-b-none')).toBe(10)
    expect(contar(saida, 'height:62%')).toBe(2)
  })

  it("'metaReal': legenda de status, área Recharts de 280 px e um selo por processo", () => {
    const saida = html(h(SkeletonChart, { formato: 'metaReal', nomes: ['Amaciamento', 'Estonagem'] }))
    for (const t of ['Esperado pela meta', 'Real, dentro da meta', 'Real, em atenção', 'Real, crítico']) expect(saida).toContain(t)
    expect(saida).toContain('h-[280px]')
    expect(saida).toContain('height:242px')
    expect(contar(saida, 'Em atenção')).toBe(2)
  })

  it("'diario': legenda com traço, área de 260 px, linha pulsante e o link dos valores por dia", () => {
    const saida = html(h(SkeletonChart, { formato: 'diario' }))
    expect(saida).toContain('h-[260px]')
    expect(saida).toContain('height:222px')
    expect(saida).toContain('<polyline')
    expect(saida).toContain('skeleton-linha')
    expect(saida).toContain('Ver os valores por dia')
    expect(contar(saida, 'h-0.5 w-5')).toBe(2)
  })
})
