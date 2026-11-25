import { Field, Select } from './ui'
import { meses } from '../domain'
import { periodoAtual } from '../store'

/** Seletor de mês e ano (Relatórios e Custo da água): o ano corrente e o anterior. */
export default function CamposMesAno({ mes, ano, setMes, setAno, disabled }: Readonly<{ mes: number; ano: number; setMes: (m: number) => void; setAno: (a: number) => void; disabled?: boolean }>) {
  const atual = periodoAtual()
  return (
    <>
      <Field id="mes" label="Mês">
        <Select id="mes" value={mes} disabled={disabled} onChange={(e) => setMes(Number(e.target.value))}>
          {meses.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="ano" label="Ano">
        <Select id="ano" value={ano} disabled={disabled} onChange={(e) => setAno(Number(e.target.value))}>
          {[atual.ano, atual.ano - 1].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </Field>
    </>
  )
}
