import type { ReactNode } from 'react'
import { Card, Skeleton, TextoFantasma } from './ui'

/**
 * Esqueleto de um KpiCard (issue #161). Repete a estrutura do card real (cabeçalho com ícone de 40 px, valor em 32 px
 * com `leading-none` e rodapé em 15 px), para que a troca pelo card carregado não mude a altura da linha de
 * indicadores (CLS).
 *
 * O rótulo já é o texto de verdade (ele não depende dos dados), então quebra de linha igual ao card carregado. O
 * rodapé é um texto fantasma parecido com o real (ex.: "00 lotes em novembro de 2026"), pelo mesmo motivo: nas
 * colunas estreitas ele quebra em duas ou três linhas, e um traço de uma linha só deixaria o card baixo demais.
 *
 * É decorativo: quem anuncia o carregamento para o leitor de tela é a região que agrupa os cards.
 */
export default function SkeletonCard({ label, rodape }: { label: string; rodape?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div aria-hidden="true" data-testid="skeleton-card" className="contents">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-medium text-ink-2">{label}</span>
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
        </div>
        <div className="font-display text-[32px] font-semibold leading-none">
          <Skeleton className="inline-block h-[1em] w-2/3 align-top" />
        </div>
        <div className="text-[15px]">{rodape ?? <TextoFantasma>Carregando dados do mês</TextoFantasma>}</div>
      </div>
    </Card>
  )
}
