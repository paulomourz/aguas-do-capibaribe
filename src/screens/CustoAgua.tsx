import { useState, type FormEvent } from 'react'
import { Button, Card, CardHeader, DataTable, EmptyState, ErrorState, Field, LoadingBlock, PageHeader, TextInput, type Col } from '../components/ui'
import { IconDroplet } from '../components/icons'
import { diaNoFusoDaLavanderia, fmtDataHora, fmtReais, lerNumeroBR, precoVigente, type PrecoM3 } from '../domain'
import { errosDaApi, useApp, usePrecosM3 } from '../store'

/** AAAA-MM-DD → DD/MM/AAAA, sem passar por Date (que mudaria o dia pelo fuso). */
const fmtDia = (dia: string) => dia.split('-').reverse().join('/')

/** G12: custo da água. Nesta etapa, só o preço do m³ com o histórico. */
export default function CustoAgua() {
  const precos = usePrecosM3()
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader title="Custo da água" description="O consumo em reais, pelo preço do m³ da água comprada." />
      <CardPrecoM3 {...precos} />
    </div>
  )
}

type Erros = { valor?: string; vigencia?: string }

function CardPrecoM3({ dados, carregando, erro, recarregar, cadastrar }: ReturnType<typeof usePrecosM3>) {
  const { notificar } = useApp()
  const [valor, setValor] = useState('')
  const [vigencia, setVigencia] = useState(() => diaNoFusoDaLavanderia(new Date()))
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const v = lerNumeroBR(valor)
    const novo: Erros = {}
    if (valor.trim() === '') novo.valor = 'Informe o preço do m³.'
    else if (Number.isNaN(v)) novo.valor = 'Use apenas números no preço, por exemplo 12,50.'
    if (!vigencia) novo.vigencia = 'Informe a data a partir da qual o preço vale.'
    setErros(novo)
    if (Object.keys(novo).length) return
    setSalvando(true)
    try {
      const salvo = await cadastrar({ valor: v, vigencia })
      notificar(`Preço do m³ de ${fmtReais(salvo.valor)} cadastrado a partir de ${fmtDia(salvo.vigencia)}.`)
      setValor('')
    } catch (err) {
      const { mensagem, campos } = errosDaApi(err)
      setErros(campos)
      if (!Object.keys(campos).length) notificar(mensagem, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const hoje = precoVigente(dados, diaNoFusoDaLavanderia(new Date()))
  const cols: Col<PrecoM3>[] = [
    { key: 'valor', header: 'Preço do m³', num: true, mobile: 'value', render: (p) => fmtReais(p.valor) },
    { key: 'vigencia', header: 'Vale a partir de', mobile: 'title', render: (p) => <span className="tabular-nums">{fmtDia(p.vigencia)}</span> },
    { key: 'por', header: 'Cadastrado por', render: (p) => p.cadastradoPor ?? 'Usuário removido' },
    { key: 'em', header: 'Cadastrado em', mobile: 'subtitle', render: (p) => <span className="tabular-nums">{fmtDataHora(p.cadastradoEm)}</span> },
  ]

  return (
    <Card as="section" className="overflow-hidden">
      <CardHeader
        id="preco-m3"
        title="Preço do m³"
        subtitle={
          carregando || erro ? undefined : hoje ? (
            <>
              Vigente hoje: <strong className="font-semibold text-ink tabular-nums">{fmtReais(hoje.valor)}</strong>, desde {fmtDia(hoje.vigencia)}.
            </>
          ) : (
            'Nenhum preço vigente hoje.'
          )
        }
      />

      <form onSubmit={salvar} noValidate className="flex flex-col gap-4 px-4 py-6 sm:flex-row sm:items-start sm:px-6">
        <Field id="preco-valor" label="Novo preço do m³" error={erros.valor} hint="Média do que a lavanderia paga entre poço e caminhão-pipa." className="sm:w-64">
          <TextInput
            id="preco-valor"
            inputMode="decimal"
            autoComplete="off"
            suffix="R$/m³"
            value={valor}
            invalid={!!erros.valor}
            onChange={(e) => {
              setValor(e.target.value)
              setErros((x) => ({ ...x, valor: undefined }))
            }}
            className="tabular-nums"
          />
        </Field>
        <Field id="preco-vigencia" label="Vale a partir de" error={erros.vigencia} className="sm:w-48">
          <TextInput
            id="preco-vigencia"
            type="date"
            value={vigencia}
            invalid={!!erros.vigencia}
            onChange={(e) => {
              setVigencia(e.target.value)
              setErros((x) => ({ ...x, vigencia: undefined }))
            }}
          />
        </Field>
        <Button type="submit" loading={salvando} className="sm:mt-8">
          {salvando ? 'Cadastrando…' : 'Cadastrar preço'}
        </Button>
      </form>

      {carregando ? (
        <LoadingBlock rows={3} label="Carregando preços…" />
      ) : erro ? (
        <ErrorState title="Não foi possível carregar os preços" onRetry={recarregar} />
      ) : dados.length === 0 ? (
        <EmptyState icon={<IconDroplet size={28} />} title="Nenhum preço cadastrado" description="Cadastre o preço do m³ para ver o custo da água." />
      ) : (
        <DataTable rows={[...dados].reverse()} cols={cols} rowKey={(p) => p.id} caption="Histórico do preço do m³" minWidth={640} />
      )}
    </Card>
  )
}
