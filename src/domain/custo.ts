import type { PrecoM3 } from './tipos'

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
