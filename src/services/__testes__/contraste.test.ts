import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/*
 * Medição de contraste (WCAG 2.1 AA) das cores do site nos dois temas (issue #106).
 *
 * Lê as cores direto do src/index.css: o tema claro vem do bloco @theme e o escuro do bloco
 * :root[data-tema='escuro'] (que só troca os valores). Para cada par "texto sobre fundo" usado nas telas,
 * calcula a razão de contraste pela fórmula da WCAG e confere o mínimo:
 *   - 4,5:1 para texto (WCAG 1.4.3);
 *   - 3:1 para barras, linhas dos gráficos e bordas de campo (WCAG 1.4.11).
 * Se alguém mudar uma cor e o contraste cair, este teste quebra no CI.
 */

const css = readFileSync(fileURLToPath(new URL('../../index.css', import.meta.url)), 'utf8')

function bloco(inicio: string): string {
  const i = css.indexOf(inicio)
  if (i < 0) throw new Error(`Bloco "${inicio}" não encontrado no index.css`)
  const fim = css.indexOf('\n}', i)
  return css.slice(i, fim)
}

function cores(trecho: string): Record<string, string> {
  const mapa: Record<string, string> = {}
  for (const m of trecho.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) mapa[m[1]] = m[2].toLowerCase()
  return mapa
}

const claro = cores(bloco('@theme {'))
const escuro = { ...claro, ...cores(bloco(":root[data-tema='escuro'] {")) }

/** No tema escuro, a classe text-brand usa --color-brand-ink (regra no index.css). */
const TEMAS: Record<string, Record<string, string>> = {
  claro: { ...claro, 'brand-texto': claro.brand, white: '#ffffff' },
  escuro: { ...escuro, 'brand-texto': escuro['brand-ink'], white: '#ffffff' },
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(frente: string, fundo: string): number {
  const a = luminancia(frente)
  const b = luminancia(fundo)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** [cor da frente, cor do fundo, onde aparece] */
type Par = [string, string, string]

const TEXTO: Par[] = [
  // Texto comum nas telas (cartões, tabelas, fundo da página, linhas zebradas)
  ['ink', 'page', 'texto principal sobre o fundo da página'],
  ['ink', 'surface', 'texto principal nos cartões'],
  ['ink', 'zebra', 'tabelas zebradas'],
  ['ink', 'brand-soft', 'item selecionado / destaque'],
  ['ink', 'sertao', 'menu lateral'],
  ['ink-2', 'page', 'texto secundário na página'],
  ['ink-2', 'surface', 'texto secundário e eixos dos gráficos'],
  ['ink-2', 'zebra', 'texto secundário em tabelas'],
  ['ink-2', 'brand-soft', 'texto secundário em destaque'],
  ['ink-2', 'neutral-bg', 'texto secundário em fundo neutro'],
  ['ink-2', 'track', 'tooltip do gráfico sobre o cursor'],
  ['ink-2', 'sertao', 'itens do menu lateral'],
  ['link', 'surface', 'links'],
  ['link', 'page', 'links na página'],
  ['link', 'zebra', 'links em tabelas'],
  ['link', 'brand-soft', 'links em destaque'],
  ['brand-texto', 'surface', 'títulos e botões secundários (text-brand)'],
  ['brand-texto', 'page', 'text-brand na página'],
  ['brand-texto', 'brand-soft', 'text-brand em destaque'],
  ['couro', 'sertao', 'título das seções do menu lateral'],
  ['couro', 'surface', 'text-couro'],
  ['neutral-ink', 'neutral-bg', 'etiqueta neutra'],
  // Situação dos lotes (etiquetas e textos de alerta)
  ['ok', 'ok-bg', 'etiqueta "dentro da meta"'],
  ['warn', 'warn-bg', 'etiqueta "atenção"'],
  ['crit', 'crit-bg', 'etiqueta "crítico"'],
  ['ok', 'surface', 'texto verde'],
  ['warn', 'surface', 'texto de atenção'],
  ['crit', 'surface', 'mensagens de erro'],
  ['crit', 'page', 'mensagens de erro na página'],
  // Cabeçalho e tela de acesso (fundo da marca)
  ['white', 'brand', 'cabeçalho, botão principal'],
  ['white', 'brand-hover', 'botão principal com o mouse em cima'],
  ['on-dark', 'brand', 'menu do cabeçalho'],
  ['on-dark', 'brand-hover', 'menu do cabeçalho com o mouse em cima'],
  ['on-dark-muted', 'brand', 'texto de apoio da tela de acesso'],
  ['areia', 'brand', 'subtítulo e mês de referência no cabeçalho'],
  ['areia', 'brand-hover', 'perfil do usuário com o mouse em cima'],
]

const NAO_TEXTO: Par[] = [
  ['field-border', 'surface', 'borda dos campos de formulário'],
  ['field-border', 'page', 'borda dos campos na página'],
  ['grafico-real', 'surface', 'linha do consumo real (gráfico diário)'],
  ['terracota', 'surface', 'linha do esperado (gráfico diário)'],
  ['meta', 'surface', 'barra "esperado pela meta" (gráfico meta x real)'],
  ['meta', 'track', 'barra "esperado" com o cursor do gráfico'],
  ['ok', 'surface', 'barra "real, dentro da meta"'],
  ['warn', 'surface', 'barra "real, em atenção"'],
  ['crit', 'surface', 'barra "real, crítico"'],
]

describe.each(Object.entries(TEMAS))('contraste no tema %s', (_tema, cor) => {
  it.each(TEXTO)('texto %s sobre %s (%s) tem pelo menos 4,5:1', (frente, fundo) => {
    expect(cor[frente], `cor ${frente} não existe no index.css`).toBeDefined()
    expect(cor[fundo], `cor ${fundo} não existe no index.css`).toBeDefined()
    expect(contraste(cor[frente], cor[fundo])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(NAO_TEXTO)('%s sobre %s (%s) tem pelo menos 3:1', (frente, fundo) => {
    expect(cor[frente], `cor ${frente} não existe no index.css`).toBeDefined()
    expect(cor[fundo], `cor ${fundo} não existe no index.css`).toBeDefined()
    expect(contraste(cor[frente], cor[fundo])).toBeGreaterThanOrEqual(3)
  })
})
