/*
 * Glossário têxtil da lavagem denim (issue #55, item #27 do parecer de 27/10/2026).
 * Fonte única dos nomes padronizados dos processos e das dicas exibidas na interface.
 * Termos, consumos de referência e fontes estão explicados em docs/tecnico/glossario-textil.md: mudar nos dois.
 */

export type TermoGlossario = {
  /** Nome padronizado, como deve ser cadastrado em Processos e metas. */
  nome: string
  /** Outros nomes usados no chão de fábrica que significam o mesmo processo. */
  sinonimos: string[]
  /** O que o processo faz, em uma frase curta para a dica. */
  definicao: string
  /** Por que o processo consome água, para ajudar a ler o desvio. */
  agua: string
}

export const GLOSSARIO: TermoGlossario[] = [
  {
    nome: 'Estonagem',
    sinonimos: ['stone wash', 'stonewash', 'stone washing', 'lavagem com pedras', 'estonado'],
    definicao: 'Desgaste do jeans em máquina com pedras-pomes ou enzimas, que clareia o índigo e dá o aspecto de usado.',
    agua: 'Usa banho para a ação mecânica e enxágues para tirar o pó das pedras e o corante solto.',
  },
  {
    nome: 'Amaciamento',
    sinonimos: ['amaciar', 'amaciante', 'softener', 'softening', 'acabamento macio'],
    definicao: 'Última etapa do beneficiamento: aplica amaciante no banho para deixar a peça macia ao toque.',
    agua: 'Normalmente é um banho curto, sem enxágue depois, por isso tende a gastar menos que as outras etapas.',
  },
  {
    nome: 'Alvejamento',
    sinonimos: ['alvejar', 'branqueamento', 'bleaching', 'bleach', 'clareamento', 'cloro'],
    definicao: 'Clareamento do índigo com oxidantes (hipoclorito, permanganato ou peróxido), seguido de neutralização.',
    agua: 'Precisa de banho de alvejamento, banho de neutralização e enxágues para remover o químico da peça.',
  },
  {
    nome: 'Tingimento',
    sinonimos: ['tingir', 'tinturaria', 'dyeing', 'sobretingimento'],
    definicao: 'Aplicação de corante na peça pronta (sobretingimento) para mudar ou reforçar a cor.',
    agua: 'Costuma ser uma das etapas que mais gastam: banho de tingimento, fixação e vários enxágues.',
  },
]

/**
 * Consumo de referência do beneficiamento completo de uma peça de jeans, em litros.
 * As fontes consultadas trazem o total da lavanderia por peça, não o valor de cada etapa.
 */
export const REFERENCIA_POR_PECA = { min: 49, max: 70 }

/** Minúsculas, sem acentos e sem espaços extras: "  Alvejaménto " → "alvejamento". */
export function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim()
}

/** Termo do glossário pelo nome padronizado ou por um sinônimo, sem diferenciar maiúsculas ou acentos. */
export function termoDe(nome: string): TermoGlossario | undefined {
  const n = normalizar(nome)
  if (!n) return undefined
  return GLOSSARIO.find((t) => normalizar(t.nome) === n || t.sinonimos.some((s) => normalizar(s) === n))
}

/**
 * Nome padronizado que deveria ser usado no lugar de `nome`, ou undefined se já está no padrão
 * (ou se o processo não faz parte do glossário).
 */
export function nomeSugerido(nome: string): string | undefined {
  const t = termoDe(nome)
  return t && t.nome !== nome.trim() ? t.nome : undefined
}
