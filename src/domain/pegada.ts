// Pegada hídrica (#116): quantos litros de água cada peça consumiu, em média.

import { REFERENCIA_POR_PECA } from './glossario'

/** Litros por peça = litros ÷ peças. Sem peças, não há pegada: null. */
export function litrosPorPeca(litros: number, pecas: number): number | null {
  return pecas > 0 ? litros / pecas : null
}

/** Litros por peça com até 1 casa decimal ("60", "33,3"). Sem valor, um traço. */
export function fmtLitrosPorPeca(valor: number | null): string {
  return valor == null ? '—' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

/**
 * Posição em relação à referência da lavanderia completa de uma peça de jeans (49 a 70 L, somando todas as etapas).
 * Serve só como comparação: um processo isolado é uma etapa e tende a ficar abaixo da faixa.
 */
export function comparacaoComReferencia(valor: number | null): 'abaixo' | 'dentro' | 'acima' | null {
  if (valor == null) return null
  if (valor < REFERENCIA_POR_PECA.min) return 'abaixo'
  if (valor > REFERENCIA_POR_PECA.max) return 'acima'
  return 'dentro'
}

export const textoDaReferencia = `Referência: ${REFERENCIA_POR_PECA.min} a ${REFERENCIA_POR_PECA.max} L por peça na lavanderia completa`
