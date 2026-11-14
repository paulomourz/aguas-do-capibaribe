import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assinarTema,
  CHAVE_TEMA,
  definirPreferencia,
  iniciarTema,
  lerPreferencia,
  preferenciaAtual,
  proximaPreferencia,
  resolverTema,
  salvarPreferencia,
  type PreferenciaTema,
} from '../tema'

/* O Vitest roda sem navegador, então a página, o localStorage e o prefers-color-scheme são simulados. */

function navegadorFalso({ sistemaEscuro = false, guardado }: { sistemaEscuro?: boolean; guardado?: string } = {}) {
  const dados = new Map<string, string>()
  if (guardado) dados.set(CHAVE_TEMA, guardado)
  const html = { tema: undefined as string | undefined, setAttribute(nome: string, valor: string) { if (nome === 'data-tema') this.tema = valor } }
  const mudancas: (() => void)[] = []
  const estado = { sistemaEscuro }

  vi.stubGlobal('document', { documentElement: html })
  vi.stubGlobal('localStorage', { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => void dados.set(k, v) })
  vi.stubGlobal('window', {
    matchMedia: () => ({
      get matches() {
        return estado.sistemaEscuro
      },
      addEventListener: (_: string, f: () => void) => void mudancas.push(f),
    }),
  })
  return {
    html,
    dados,
    /** O sistema do aparelho trocou de claro para escuro (ou o contrário) com o site aberto. */
    mudarSistema(escuro: boolean) {
      estado.sistemaEscuro = escuro
      mudancas.forEach((f) => f())
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolverTema', () => {
  it.each([
    ['automatico', true, 'escuro'],
    ['automatico', false, 'claro'],
    ['claro', true, 'claro'],
    ['escuro', false, 'escuro'],
  ] as [PreferenciaTema, boolean, string][])('%s com sistema escuro=%s → %s', (pref, sistemaEscuro, esperado) => {
    expect(resolverTema(pref, sistemaEscuro)).toBe(esperado)
  })
})

describe('proximaPreferencia', () => {
  it('percorre automático → claro → escuro → automático', () => {
    expect(proximaPreferencia('automatico')).toBe('claro')
    expect(proximaPreferencia('claro')).toBe('escuro')
    expect(proximaPreferencia('escuro')).toBe('automatico')
  })
})

describe('lerPreferencia e salvarPreferencia', () => {
  it('sem nada guardado, ou com valor estranho, fica no automático', () => {
    expect(lerPreferencia(null)).toBe('automatico')
    expect(lerPreferencia({ getItem: () => null })).toBe('automatico')
    expect(lerPreferencia({ getItem: () => 'roxo' })).toBe('automatico')
  })

  it('lê o que foi guardado', () => {
    expect(lerPreferencia({ getItem: () => 'escuro' })).toBe('escuro')
    expect(lerPreferencia({ getItem: () => 'claro' })).toBe('claro')
  })

  it('armazenamento bloqueado (modo privado) não quebra o site', () => {
    const bloqueado = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(lerPreferencia(bloqueado)).toBe('automatico')
    expect(salvarPreferencia(bloqueado, 'escuro')).toBe(false)
  })

  it('grava na chave do site', () => {
    const dados = new Map<string, string>()
    expect(salvarPreferencia({ setItem: (k, v) => void dados.set(k, v) }, 'claro')).toBe(true)
    expect(dados.get(CHAVE_TEMA)).toBe('claro')
  })
})

describe('tema na página', () => {
  it('aparelho no modo escuro e nenhuma escolha feita: abre no tema escuro', () => {
    const nav = navegadorFalso({ sistemaEscuro: true })
    iniciarTema()
    expect(preferenciaAtual()).toBe('automatico')
    expect(nav.html.tema).toBe('escuro')
  })

  it('aparelho no modo claro e nenhuma escolha feita: abre no tema claro', () => {
    const nav = navegadorFalso({ sistemaEscuro: false })
    iniciarTema()
    expect(nav.html.tema).toBe('claro')
  })

  it('escolheu claro no botão: recarregar a página mantém o claro, mesmo com o aparelho no escuro', () => {
    const nav = navegadorFalso({ sistemaEscuro: true })
    iniciarTema()
    definirPreferencia('claro')
    expect(nav.html.tema).toBe('claro')
    expect(nav.dados.get(CHAVE_TEMA)).toBe('claro')

    // "Recarrega": o estado da página some, mas o localStorage continua com a escolha.
    const recarregada = navegadorFalso({ sistemaEscuro: true, guardado: nav.dados.get(CHAVE_TEMA) })
    iniciarTema()
    expect(recarregada.html.tema).toBe('claro')
  })

  it('no automático, acompanha o sistema quando ele muda com o site aberto', () => {
    const nav = navegadorFalso({ sistemaEscuro: false })
    iniciarTema()
    expect(nav.html.tema).toBe('claro')
    nav.mudarSistema(true)
    expect(nav.html.tema).toBe('escuro')
  })

  it('com escolha manual, ignora a mudança do sistema', () => {
    const nav = navegadorFalso({ sistemaEscuro: false, guardado: 'claro' })
    iniciarTema()
    nav.mudarSistema(true)
    expect(nav.html.tema).toBe('claro')
  })

  it('avisa quem está ouvindo (o botão) quando a escolha muda', () => {
    navegadorFalso()
    iniciarTema()
    const ouvinte = vi.fn()
    const cancelar = assinarTema(ouvinte)
    definirPreferencia('escuro')
    expect(ouvinte).toHaveBeenCalledTimes(1)
    cancelar()
    definirPreferencia('claro')
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })
})
