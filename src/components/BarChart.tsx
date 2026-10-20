import type { CSSProperties } from 'react'
import { fmtNum } from '../domain/formatacao'

type Grupo = { label: string; meta: number; real: number }

/** Gráfico de barras agrupadas Meta x Real, somente em tons de azul. */
export default function BarChart({ data, height = 240, unidade = 'mil L' }: { data: Grupo[]; height?: number; unidade?: string }) {
  const max = Math.max(...data.flatMap((d) => [d.meta, d.real])) * 1.12
  const passo = niceStep(max / 4)
  const ticks = Array.from({ length: Math.ceil(max / passo) + 1 }, (_, i) => i * passo)
  const topo = ticks[ticks.length - 1] || 1
  const k = (v: number) => fmtNum(Math.round(v / 1000))

  const descricao = data
    .map((d) => `${d.label}: meta ${fmtNum(d.meta)} litros, real ${fmtNum(d.real)} litros`)
    .join('; ')

  return (
    <figure className="w-full" role="img" aria-label={`Gráfico de barras meta versus real. ${descricao}.`}>
      <div className="mb-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-2" aria-hidden="true">
        <span className="flex items-center gap-2">
          <span className="water-legend-swatch water-legend-swatch--meta" /> Meta
        </span>
        <span className="flex items-center gap-2">
          <span className="water-legend-swatch water-legend-swatch--real" /> Real
        </span>
        <span className="ml-auto">Valores em {unidade}</span>
      </div>
      <div className="flex gap-4" aria-hidden="true">
        <div className="relative w-8 shrink-0" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-xs text-ink-2 tabular-nums"
              style={{ bottom: `${(t / topo) * 100}%`, transform: 'translateY(50%)' }}
            >
              {k(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }}>
          {ticks.map((t) => (
            <div
              key={t}
              className={t === 0 ? 'absolute inset-x-0 border-t border-line-strong' : 'absolute inset-x-0 border-t border-dashed border-line'}
              style={{ bottom: `${(t / topo) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end justify-around px-4">
            {data.map((d, index) => (
              <div key={d.label} className="flex h-full items-end gap-1.5 sm:gap-2">
                <Barra valor={d.meta} topo={topo} rotulo={k(d.meta)} meta delay={index * 160} />
                <Barra valor={d.real} topo={topo} rotulo={k(d.real)} delay={index * 160 + 80} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-12 mt-3 flex justify-around px-4" aria-hidden="true">
        {data.map((d) => (
          <span key={d.label} className="text-center text-[13px] font-medium text-ink">
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  )
}

function Barra({
  valor,
  topo,
  rotulo,
  meta,
  delay,
}: {
  valor: number
  topo: number
  rotulo: string
  meta?: boolean
  delay: number
}) {
  const nivel = Math.min(100, Math.max(0, (valor / topo) * 100))
  const animationStyle = {
    '--water-delay': `${delay}ms`,
    '--water-level': `${nivel}%`,
  } as CSSProperties

  return (
    <div className="water-bar h-full w-8 sm:w-9" style={animationStyle}>
      <span className="water-value text-xs font-semibold text-ink tabular-nums">{rotulo}</span>
      <div className={`water-column ${meta ? 'water-column--meta' : 'water-column--real'}`}>
        <div className="water-fill">
          <span className="water-surface" />
          <span className="water-ripple" />
          <span className="water-bubble water-bubble--one" />
          <span className="water-bubble water-bubble--two" />
          <span className="water-bubble water-bubble--three" />
        </div>
        <span className="water-glass-shine" />
      </div>
    </div>
  )
}

function niceStep(raw: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return s * pow
}
