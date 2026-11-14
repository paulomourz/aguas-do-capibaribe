import type { Lote } from './tipos'

/*
 * Filtros do histórico de lotes (issue #107): período, processo e quem registrou.
 * Os dias do filtro são os do fuso da lavanderia (America/Recife), o mesmo dos relatórios: um lote das 22h do dia 10
 * em Recife é do dia 10, mesmo já sendo dia 11 em UTC.
 */

export type FiltroHistorico = {
  processoId?: string
  usuarioId?: string
  /** Primeiro dia, AAAA-MM-DD, incluído. */
  de?: string
  /** Último dia, AAAA-MM-DD, incluído. */
  ate?: string
}

const diaRecife = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Recife',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** AAAA-MM-DD da data no fuso de Recife. */
export const diaNoFusoDaLavanderia = (d: Date) => diaRecife.format(d)

export function filtrarLotes(lotes: Lote[], f: FiltroHistorico): Lote[] {
  return lotes.filter((l) => {
    if (f.processoId && l.processoId !== f.processoId) return false
    if (f.usuarioId && l.usuarioId !== f.usuarioId) return false
    if (f.de || f.ate) {
      const dia = diaNoFusoDaLavanderia(l.data)
      if (f.de && dia < f.de) return false
      if (f.ate && dia > f.ate) return false
    }
    return true
  })
}

/** Data final antes da inicial: o filtro não tem como achar nada. */
export const periodoInvalido = (f: FiltroHistorico) => Boolean(f.de && f.ate && f.de > f.ate)

/** Algum filtro ligado (para o botão "Limpar filtro" e a mensagem de lista vazia). */
export const filtrando = (f: FiltroHistorico) => Boolean(f.processoId || f.usuarioId || f.de || f.ate)
