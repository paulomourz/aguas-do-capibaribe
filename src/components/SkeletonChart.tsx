import type { ReactNode } from 'react'
import { cx, SeloFantasma, Skeleton, TextoFantasma } from './ui'

/**
 * Esqueleto dos gráficos (issue #161), no formato de cada um:
 *  - 'agua'     BarChart (colunas de água Meta x real do Dashboard), área de 240 px;
 *  - 'metaReal' GraficoMetaReal (barras Recharts dos Relatórios), área de 280 px e lista de status embaixo;
 *  - 'diario'   GraficoDiario (linhas Recharts por dia), área de 260 px e o "Ver os valores por dia" embaixo.
 *
 * Legenda, área do gráfico e rodapé usam as mesmas classes de tipografia e espaçamento do gráfico real, e os textos
 * fixos da legenda ficam transparentes sobre o fundo do esqueleto: a largura e a altura saem iguais às do gráfico,
 * então trocar o esqueleto pelo gráfico não empurra o resto da tela (CLS). Se mudar o layout de um gráfico, mude
 * aqui também; o teste e2e/carregamento.spec.ts mede o deslocamento.
 *
 * `nomes` são os processos esperados no gráfico (os cadastrados, que o app já tem antes do resumo chegar): com eles,
 * os rótulos embaixo das barras quebram como os reais. Sem nomes, usa três grupos genéricos.
 */
export type FormatoGrafico = 'agua' | 'metaReal' | 'diario'

/** Um processo no esqueleto: o nome (também a chave da lista) e as alturas de exemplo das barras de meta e real. */
type Grupo = { nome: string; meta: number; real: number }

/** Alturas relativas das barras de exemplo (meta, real) de cada grupo. */
const BARRAS: [number, number][] = [
  [62, 54],
  [78, 88],
  [48, 40],
  [70, 58],
]

const SEM_NOMES = ['Processo A', 'Processo B', 'Processo C']

const CONTEUDO: Record<FormatoGrafico, (props: Readonly<{ grupos: Grupo[] }>) => ReactNode> = {
  agua: EsqueletoAgua,
  metaReal: EsqueletoMetaReal,
  diario: EsqueletoDiario,
}

export default function SkeletonChart({ formato, nomes = [], label = 'Carregando gráfico…' }: Readonly<{ formato: FormatoGrafico; nomes?: string[]; label?: string }>) {
  const grupos = (nomes.length ? nomes : SEM_NOMES).map((nome, i) => {
    const [meta, real] = BARRAS[i % BARRAS.length]
    return { nome, meta, real }
  })
  const Conteudo = CONTEUDO[formato]
  // <output> já é anunciado pelo leitor de tela como região de status (role="status", aria-live="polite").
  return (
    <output className="block w-full" data-testid="skeleton-chart">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <Conteudo grupos={grupos} />
      </div>
    </output>
  )
}

function EsqueletoAgua({ grupos }: Readonly<{ grupos: Grupo[] }>) {
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <ItemLegenda>Meta</ItemLegenda>
        <ItemLegenda>Real</ItemLegenda>
        <span className="ml-auto">
          <TextoFantasma>Valores em mil L</TextoFantasma>
        </span>
      </div>
      <div className="flex gap-4">
        <EixoY largura="w-8" altura={240} />
        <AreaBarras altura={240} grupos={grupos} largura="w-8 sm:w-9" gap="gap-1.5 sm:gap-2" className="justify-around px-4" />
      </div>
      <div className="ml-12 mt-3 flex justify-around px-4 text-[13px] font-medium">
        {grupos.map((g) => (
          <TextoFantasma key={g.nome} className="text-center">
            {g.nome}
          </TextoFantasma>
        ))}
      </div>
    </>
  )
}

function EsqueletoMetaReal({ grupos }: Readonly<{ grupos: Grupo[] }>) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <ItemLegenda>Esperado pela meta</ItemLegenda>
        <ItemLegenda>Real, dentro da meta</ItemLegenda>
        <ItemLegenda>Real, em atenção</ItemLegenda>
        <ItemLegenda>Real, crítico</ItemLegenda>
      </div>
      {/* Recharts: 8 px de margem no topo e 30 px do eixo X embaixo, dentro dos 280 px. */}
      <div className="flex h-[280px] w-full pt-2">
        <EixoY largura="w-16" altura={242} />
        <AreaBarras altura={242} grupos={grupos} largura="w-[min(40px,6vw)]" gap="gap-0.5" className="justify-around" />
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
        {grupos.map((g) => (
          <li key={g.nome} className="flex items-center gap-2">
            <TextoFantasma className="font-semibold">{g.nome}</TextoFantasma>
            <SeloFantasma>Em atenção</SeloFantasma>
          </li>
        ))}
      </ul>
    </>
  )
}

function EsqueletoDiario() {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <ItemLegenda traco>Real</ItemLegenda>
        <ItemLegenda traco>Esperado pela meta</ItemLegenda>
      </div>
      {/* Recharts: 8 px de margem no topo e 30 px do eixo X embaixo, dentro dos 260 px. */}
      <div className="flex h-[260px] w-full pt-2">
        <EixoY largura="w-16" altura={222} />
        <AreaLinhas altura={222} />
      </div>
      <div className="mt-3 text-[14px] font-semibold">
        <TextoFantasma>Ver os valores por dia</TextoFantasma>
      </div>
    </>
  )
}

function ItemLegenda({ children, traco }: Readonly<{ children: ReactNode; traco?: boolean }>) {
  return (
    <span className="flex items-center gap-2">
      {traco ? <Skeleton className="h-0.5 w-5 rounded-none" /> : <Skeleton className="h-3 w-3 rounded-sm" />}
      <TextoFantasma>{children}</TextoFantasma>
    </span>
  )
}

/** Marcas do eixo Y: cinco valores, do topo à base. */
function EixoY({ largura, altura }: Readonly<{ largura: string; altura: number }>) {
  return (
    <div className={cx('flex shrink-0 flex-col justify-between pr-2', largura)} style={{ height: altura }}>
      {[0, 1, 2, 3, 4].map((marca) => (
        <Skeleton key={marca} className="ml-auto h-2.5 w-3/4" />
      ))}
    </div>
  )
}

/** Linhas de grade horizontais (a de baixo é o eixo X). */
function Grade() {
  return (
    <>
      {[0, 25, 50, 75, 100].map((p) => (
        <div key={p} className={cx('absolute inset-x-0 border-t', p === 0 ? 'border-line-strong' : 'border-dashed border-line')} style={{ bottom: `${p}%` }} />
      ))}
    </>
  )
}

function AreaBarras({ altura, grupos, largura, gap, className }: Readonly<{ altura: number; grupos: Grupo[]; largura: string; gap: string; className?: string }>) {
  return (
    <div className="relative min-w-0 flex-1" style={{ height: altura }}>
      <Grade />
      <div className={cx('absolute inset-0 flex items-end', className)}>
        {grupos.map((g) => (
          <div key={g.nome} className={cx('flex h-full items-end', gap)}>
            <Skeleton className={cx('rounded-b-none rounded-t', largura)} style={{ height: `${g.meta}%` }} />
            <Skeleton className={cx('rounded-b-none rounded-t', largura)} style={{ height: `${g.real}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Uma linha quebrada genérica, desenhada com a cor do esqueleto (pulsa na opacidade, ver .skeleton-linha). */
function AreaLinhas({ altura }: Readonly<{ altura: number }>) {
  return (
    <div className="relative min-w-0 flex-1" style={{ height: altura }}>
      <Grade />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points="0,62 12,48 24,55 36,34 48,42 60,28 72,46 84,38 100,30"
          fill="none"
          stroke="var(--color-skeleton)"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          className="skeleton-linha"
        />
      </svg>
    </div>
  )
}
