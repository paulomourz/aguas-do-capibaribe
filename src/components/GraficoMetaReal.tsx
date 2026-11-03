import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { desvioDe, fmtL, fmtNum, fmtPct, statusDe } from '../domain'
import { StatusBadge, statusMeta, type Status } from './ui'

export type GrupoMetaReal = { nome: string; real: number; esperado: number }

const COR_META = 'var(--color-meta)'
const COR_STATUS: Record<Status, string> = { ok: 'var(--color-ok)', warn: 'var(--color-warn)', crit: 'var(--color-crit)' }

/** Barras de consumo real x esperado por processo. A barra real leva a cor da faixa de status; a meta fica neutra. */
export default function GraficoMetaReal({ dados }: { dados: GrupoMetaReal[] }) {
  const linhas = dados.map((d) => ({ ...d, desvio: desvioDe(d.real, d.esperado), status: statusDe(desvioDe(d.real, d.esperado)) }))
  const descricao = linhas
    .map((d) => `${d.nome}: consumo ${fmtL(d.real)}, esperado ${fmtL(d.esperado)}, ${statusMeta[d.status].label}`)
    .join('; ')

  return (
    <figure className="w-full">
      <figcaption className="sr-only">Consumo real comparado ao esperado por processo. {descricao}.</figcaption>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-2" aria-hidden="true">
        <Legenda cor={COR_META} texto="Esperado pela meta" />
        <Legenda cor={COR_STATUS.ok} texto="Real, dentro da meta" />
        <Legenda cor={COR_STATUS.warn} texto="Real, em atenção" />
        <Legenda cor={COR_STATUS.crit} texto="Real, crítico" />
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={linhas} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="nome" interval={0} tickFormatter={(n: string) => abreviar(n, linhas.length)} tickLine={false} axisLine={{ stroke: 'var(--color-line-strong)' }} tick={{ fill: 'var(--color-ink)', fontSize: 13 }} />
            <YAxis width={64} tickLine={false} axisLine={false} tick={{ fill: 'var(--color-ink-2)', fontSize: 12 }} tickFormatter={(v: number) => fmtNum(v)} />
            <Tooltip cursor={{ fill: 'var(--color-track)' }} content={<Dica />} />
            <Bar dataKey="esperado" name="Esperado" fill={COR_META} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
            <Bar dataKey="real" name="Real" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
              {linhas.map((d) => (
                <Cell key={d.nome} fill={COR_STATUS[d.status]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-ink">
        {linhas.map((d) => (
          <li key={d.nome} className="flex items-center gap-2">
            <span className="font-semibold">{d.nome}</span>
            <StatusBadge status={d.status} size="sm" />
          </li>
        ))}
      </ul>
    </figure>
  )
}

/** Com 4 ou mais processos, os nomes não cabem lado a lado no celular; o nome completo fica na lista abaixo do gráfico. */
const abreviar = (nome: string, grupos: number) => (grupos >= 4 && nome.length > 8 ? `${nome.slice(0, 7)}.` : nome)

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: cor }} />
      {texto}
    </span>
  )
}

type LinhaDica = GrupoMetaReal & { desvio: number; status: Status }

function Dica({ active, payload }: { active?: boolean; payload?: readonly { payload: LinhaDica }[] }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink shadow-card">
      <p className="mb-1 font-semibold">{d.nome}</p>
      <p className="tabular-nums">Real: {fmtL(d.real)}</p>
      <p className="tabular-nums">Esperado: {fmtL(d.esperado)}</p>
      <p className="tabular-nums">
        Desvio: {fmtPct(d.desvio)} · {statusMeta[d.status].label}
      </p>
    </div>
  )
}
