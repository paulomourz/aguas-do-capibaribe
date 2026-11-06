/*
 * Tema claro/escuro.
 *
 * A escolha da pessoa (automático, claro ou escuro) fica no localStorage do aparelho. O tema que vale de
 * fato vai para o atributo data-tema do <html>, e o index.css troca as cores a partir dele.
 * "Automático" segue a preferência do sistema (prefers-color-scheme) e acompanha a mudança em tempo real.
 */

export type PreferenciaTema = 'automatico' | 'claro' | 'escuro'
export type TemaAplicado = 'claro' | 'escuro'

export const CHAVE_TEMA = 'aguas-do-capibaribe:tema'

export const rotuloTema: Record<PreferenciaTema, string> = { automatico: 'automático', claro: 'claro', escuro: 'escuro' }

/** Ordem em que o botão percorre as opções. */
const ORDEM: PreferenciaTema[] = ['automatico', 'claro', 'escuro']

export const proximaPreferencia = (atual: PreferenciaTema): PreferenciaTema => ORDEM[(ORDEM.indexOf(atual) + 1) % ORDEM.length]

const ehPreferencia = (v: unknown): v is PreferenciaTema => typeof v === 'string' && (ORDEM as string[]).includes(v)

/** Lê a escolha guardada. Sem escolha, valor inválido ou armazenamento bloqueado (modo privado): automático. */
export function lerPreferencia(armazenamento: Pick<Storage, 'getItem'> | null | undefined): PreferenciaTema {
  try {
    const v = armazenamento?.getItem(CHAVE_TEMA)
    return ehPreferencia(v) ? v : 'automatico'
  } catch {
    return 'automatico'
  }
}

/** Guarda a escolha. Devolve false se o navegador não deixou gravar; o tema vale só até recarregar. */
export function salvarPreferencia(armazenamento: Pick<Storage, 'setItem'> | null | undefined, preferencia: PreferenciaTema): boolean {
  try {
    if (!armazenamento) return false
    armazenamento.setItem(CHAVE_TEMA, preferencia)
    return true
  } catch {
    return false
  }
}

/** Qual tema aparece na tela: a escolha da pessoa ou, no automático, a do sistema. */
export const resolverTema = (preferencia: PreferenciaTema, sistemaEscuro: boolean): TemaAplicado =>
  preferencia === 'automatico' ? (sistemaEscuro ? 'escuro' : 'claro') : preferencia

/* ---------- Ligação com o navegador ---------- */

let preferencia: PreferenciaTema = 'automatico'
const ouvintes = new Set<() => void>()

const consultaEscuro = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null)

// Ler localStorage pode lançar erro (cookies bloqueados), por isso o acesso fica protegido.
const armazenamento = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function aplicar() {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-tema', resolverTema(preferencia, consultaEscuro()?.matches ?? false))
}

/** Chamar uma vez, antes de desenhar a tela: aplica o tema e passa a acompanhar o sistema. */
export function iniciarTema() {
  preferencia = lerPreferencia(armazenamento())
  aplicar()
  consultaEscuro()?.addEventListener?.('change', () => {
    if (preferencia === 'automatico') aplicar()
  })
}

export function definirPreferencia(nova: PreferenciaTema) {
  preferencia = nova
  salvarPreferencia(armazenamento(), nova)
  aplicar()
  ouvintes.forEach((f) => f())
}

export const preferenciaAtual = () => preferencia

/** Para o React (useSyncExternalStore) redesenhar o botão quando a escolha mudar. */
export function assinarTema(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}
