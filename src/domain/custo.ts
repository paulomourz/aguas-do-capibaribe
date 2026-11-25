import { diaNoFusoDaLavanderia } from './filtroLotes'
import type { Lote, PrecoM3 } from './tipos'

/*
 * Custo da água. O preço do m³ vigente num dia é o de maior vigência menor ou igual ao dia;
 * na mesma vigência, vence o cadastrado por último (é assim que se corrige um erro de digitação).
 */

/** Preço vigente no dia AAAA-MM-DD, ou undefined se nenhum vale ainda. */
export function precoVigente(precos: PrecoM3[], dia: string): PrecoM3 | undefined {
  let vigente: PrecoM3 | undefined
  for (const p of precos) {
    if (p.vigencia > dia) continue
    if (!vigente || p.vigencia > vigente.vigencia || (p.vigencia === vigente.vigencia && p.cadastradoEm >= vigente.cadastradoEm)) vigente = p
  }
  return vigente
}

/** Totais em litros e em R$. Custo null: nenhum lote do grupo tinha preço vigente. Sem arredondar (só na exibição). */
export type Custo = { consumo: number; excesso: number; custo: number | null; custoExcesso: number | null }
export type CustoDoMes = Custo & { porProcesso: (Custo & { processoId: string })[]; semPreco: number }

/**
 * Custo da água e custo do excesso dos lotes do mês. Lote sem preço vigente entra no consumo em litros,
 * mas fica fora dos valores em R$. Excesso de um lote = max(0, litros − esperado): um lote abaixo da meta não compensa outro.
 */
export function custoDoMes(lotes: Lote[], precos: PrecoM3[]): CustoDoMes {
  const vazio = (): Custo => ({ consumo: 0, excesso: 0, custo: null, custoExcesso: null })
  const total = vazio()
  const porProcesso = new Map<string, Custo>()
  let semPreco = 0
  for (const l of lotes) {
    const preco = precoVigente(precos, diaNoFusoDaLavanderia(l.data))?.valor
    const excesso = Math.max(0, l.litros - l.esperado)
    if (preco === undefined) semPreco++
    if (!porProcesso.has(l.processoId)) porProcesso.set(l.processoId, vazio())
    for (const c of [total, porProcesso.get(l.processoId)!]) {
      c.consumo += l.litros
      c.excesso += excesso
      if (preco === undefined) continue
      c.custo = (c.custo ?? 0) + (l.litros / 1000) * preco
      c.custoExcesso = (c.custoExcesso ?? 0) + (excesso / 1000) * preco
    }
  }
  return { ...total, porProcesso: [...porProcesso].map(([processoId, c]) => ({ processoId, ...c })), semPreco }
}
