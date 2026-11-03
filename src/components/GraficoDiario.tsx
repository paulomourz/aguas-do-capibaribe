import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtL, fmtNum, type ConsumoDia } from '../domain'

const COR_REAL = 'var(--color-grafico-real)'
const COR_ESPERADO = 'var(--color-terracota)'

/** Linhas de consumo real e esperado por dia. A linha do esperado é tracejada, para não depender só da cor. */
export default function GraficoDiario({ dias, periodo }: { dias: ConsumoDia[]; periodo: string }) {
  const comLote = dias.filter((d) => d.lotes > 0)
  const real = comLote.reduce((s, d) => s + d.real, 0)
  const esperado = comLote.reduce((s, d) => s + d.esperado, 0)

  return (
    <figure className="w-full">
      <figcaption className="sr-only">
        Consumo diário em {periodo}: {comLote.length} dias com lotes, {fmtL(real)} consumidos e {fmtL(esperado)} esperados. Os valores de cada dia estão na tabela abaixo do gráfico.
      </figcaption>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-2" aria-hidden="true">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5" style={{ background: COR_REAL }} /> Real
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: COR_ESPERADO }} /> Esperado pela meta
        </span>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dias} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="dia" minTickGap={16} tickLine={false} axisLine={{ stroke: 'var(--color-line-strong)' }} tick={{ fill: 'var(--color-ink-2)', fontSize: 12 }} />
            <YAxis width={64} tickLine={false} axisLine={false} tick={{ fill: 'var(--color-ink-2)', fontSize: 12 }} tickFormatter={(v: number) => fmtNum(v)} />
            <Tooltip cursor={{ stroke: 'var(--color-line-strong)' }} content={<Dica />} />
            <Line type="linear" dataKey="esperado" name="Esperado" stroke={COR_ESPERADO} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line type="linear" dataKey="real" name="Real" stroke={COR_REAL} strokeWidth={2} dot={{ r: 3, fill: COR_REAL, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-[14px] text-ink">
        <summary className="cursor-pointer font-semibold text-link">Ver os valores por dia</summary>
        {comLote.length === 0 ? (
          <p className="mt-2 text-ink-2">Nenhum lote neste período.</p>
        ) : (
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-left tabular-nums">
              <caption className="sr-only">Consumo por dia em {periodo}</caption>
              <thead>
                <tr className="border-b border-line-strong">
                  <th scope="col" className="py-1 pr-4 font-semibold">Dia</th>
                  <th scope="col" className="py-1 pr-4 text-right font-semibold">Lotes</th>
                  <th scope="col" className="py-1 pr-4 text-right font-semibold">Real</th>
                  <th scope="col" className="py-1 text-right font-semibold">Esperado</th>
                </tr>
              </thead>
              <tbody>
                {comLote.map((d) => (
                  <tr key={d.dia} className="border-b border-line">
                    <td className="py-1 pr-4">{d.dia}</td>
                    <td className="py-1 pr-4 text-right">{fmtNum(d.lotes)}</td>
                    <td className="py-1 pr-4 text-right">{fmtL(d.real)}</td>
                    <td className="py-1 text-right">{fmtL(d.esperado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </figure>
  )
}

function Dica({ active, payload }: { active?: boolean; payload?: readonly { payload: ConsumoDia }[] }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink shadow-card">
      <p className="mb-1 font-semibold">Dia {d.dia}</p>
      <p className="tabular-nums">Real: {fmtL(d.real)}</p>
      <p className="tabular-nums">Esperado: {fmtL(d.esperado)}</p>
      <p className="tabular-nums">Lotes: {fmtNum(d.lotes)}</p>
    </div>
  )
}
