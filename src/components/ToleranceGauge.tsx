import { useEffect, useState } from 'react'
import { fmtPct } from '../domain'
import { anguloDoDesvio, arcosDasFaixas, pontoNoArco } from '../domain/gauge'
import { cx, statusMeta, type Status } from './ui'

const COR: Record<Status, string> = { ok: 'var(--color-ok)', warn: 'var(--color-warn)', crit: 'var(--color-crit)' }

// Semicírculo de centro (CX, CY) e raio R no viewBox 0 0 200 116.
const CX = 100
const CY = 100
const R = 80
const ESPESSURA = 16
const ARCOS = arcosDasFaixas()

function caminhoDoArco(de: number, ate: number) {
  const a = pontoNoArco(CX, CY, R, de)
  const b = pontoNoArco(CX, CY, R, ate)
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`
}

/**
 * Gauge do nível de tolerância hídrica (#98). O desvio e o status vêm da API; aqui só desenha.
 * As faixas não levam número (os limites não aparecem na interface) e a cor nunca vem sozinha:
 * a legenda abaixo traz ícone, nome da faixa e o desvio (RNF13).
 * Quando o desvio muda no estado global, o ponteiro gira até a posição nova com transição.
 */
export default function ToleranceGauge({
  desvio,
  status,
  legenda = true,
  decorativo = false,
  className,
}: {
  desvio: number
  status: Status
  /** Mostra ícone, faixa e desvio abaixo do arco. Desligue quando a tela já mostra isso ao lado. */
  legenda?: boolean
  /** Esconde o gauge dos leitores de tela quando o mesmo dado já está em texto por perto. */
  decorativo?: boolean
  className?: string
}) {
  const m = statusMeta[status]
  const alvo = anguloDoDesvio(desvio)
  // Começa na meta e gira até o desvio no quadro seguinte, para a transição aparecer também ao abrir a tela.
  const [angulo, setAngulo] = useState(() => anguloDoDesvio(0))
  useEffect(() => {
    const id = requestAnimationFrame(() => setAngulo(alvo))
    return () => cancelAnimationFrame(id)
  }, [alvo])

  const descricao = `Indicador de tolerância: desvio de ${fmtPct(desvio)} em relação à meta, faixa ${m.label}.`
  const topoMeta = pontoNoArco(CX, CY, R + ESPESSURA / 2 + 2, 0)

  return (
    <figure className={cx('flex flex-col items-center', className)} data-status={status} aria-hidden={decorativo || undefined}>
      <svg viewBox="0 0 200 116" className="w-full" role="img" aria-label={descricao}>
        {ARCOS.map((a) => (
          <path
            key={a.status}
            d={caminhoDoArco(a.de, a.ate)}
            fill="none"
            stroke={COR[a.status]}
            strokeWidth={ESPESSURA}
            className={cx(a.status === 'crit' && status === 'crit' && 'gauge-pulso')}
            opacity={a.status === status ? 1 : 0.35}
          />
        ))}
        {/* Marca da meta (0%) no topo do arco */}
        <line x1={CX} y1={CY - R + ESPESSURA / 2 + 2} x2={topoMeta.x} y2={topoMeta.y - 4} stroke="var(--color-ink)" strokeWidth={2} />
        <g className="gauge-ponteiro" style={{ transform: `rotate(${angulo}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
          <path d={`M ${CX - 5} ${CY} L ${CX} ${CY - R + 4} L ${CX + 5} ${CY} Z`} fill={COR[status]} stroke="var(--color-surface)" strokeWidth={1} />
        </g>
        <circle cx={CX} cy={CY} r={9} fill={COR[status]} stroke="var(--color-surface)" strokeWidth={2} />
      </svg>
      {legenda && (
        // O rótulo do SVG já diz o mesmo para o leitor de tela; a legenda é para quem enxerga.
        <figcaption className={cx('mt-1 flex items-center gap-1.5 text-sm font-semibold', m.text)} aria-hidden="true">
          <m.Icon size={16} strokeWidth={2.2} />
          {m.label} · <span className="tabular-nums">{fmtPct(desvio)}</span>
        </figcaption>
      )}
    </figure>
  )
}
