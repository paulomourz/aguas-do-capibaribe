import { useState, type FormEvent } from 'react'
import { Banner, Button, Card, CardHeader, DataTable, EmptyState, ErrorState, Field, KpiCard, LoadingBlock, PageHeader, TextInput, type Col } from '../components/ui'
import CamposMesAno from '../components/CamposMesAno'
import { salvarPrecoM3, type ErrosPrecoM3 } from '../services'
import { IconCalendar, IconDroplet } from '../components/icons'
import { avisoDoCusto, custoDoMes, diaNoFusoDaLavanderia, fmtDataHora, fmtDia, fmtL, fmtNum, fmtReais, meses, precoVigente, type CustoDoMes, type PrecoM3 } from '../domain'
import { periodoAtual, useApp, useLotesDoMes, usePrecosM3 } from '../store'

/** G12: custo da água. O custo do mês, por processo, e o preço do m³ com o histórico. */
export default function CustoAgua() {
  const { nomeProcesso } = useApp()
  const atual = periodoAtual()
  const [mes, setMes] = useState(atual.mes)
  const [ano, setAno] = useState(atual.ano)
  const lotes = useLotesDoMes(mes, ano)
  const precos = usePrecosM3()
  const periodo = `${meses[mes - 1]} de ${ano}`.toLowerCase()
  const custo = custoDoMes(lotes.dados, precos.dados)
  const aviso = avisoDoCusto(custo, precos.dados)
  const reais = (v: number | null) => (v === null ? '—' : fmtReais(v))

  const cols: Col<CustoDoMes['porProcesso'][number]>[] = [
    { key: 'processo', header: 'Processo', mobile: 'title', render: (p) => nomeProcesso(p.processoId) },
    { key: 'consumo', header: 'Consumo (L)', num: true, render: (p) => fmtNum(p.consumo) },
    { key: 'custo', header: 'Custo (R$)', num: true, mobile: 'value', render: (p) => reais(p.custo) },
    { key: 'excesso', header: 'Excesso (L)', num: true, render: (p) => fmtNum(p.excesso) },
    { key: 'custoExcesso', header: 'Custo do excesso (R$)', num: true, render: (p) => reais(p.custoExcesso) },
  ]

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader title="Custo da água" description="O consumo em reais, pelo preço do m³ da água comprada." />

      <Card className="p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,240px)_minmax(0,160px)] sm:items-end">
          <CamposMesAno mes={mes} ano={ano} setMes={setMes} setAno={setAno} />
        </div>
      </Card>

      {lotes.carregando || precos.carregando ? (
        <LoadingBlock rows={4} label="Carregando custo…" />
      ) : lotes.erro || precos.erro ? (
        <ErrorState
          title="Não foi possível carregar o custo"
          onRetry={() => {
            if (lotes.erro) lotes.recarregar()
            if (precos.erro) precos.recarregar()
          }}
        />
      ) : lotes.dados.length === 0 ? (
        <EmptyState icon={<IconCalendar size={28} />} title="Sem lotes no período" description={`Não há lotes registrados em ${periodo}. Escolha outro mês ou ano.`} />
      ) : (
        <>
          {aviso && <Banner tone="warn">{aviso}</Banner>}
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard label="Custo da água" value={reais(custo.custo)} icon={<IconDroplet size={20} />} footer={`${fmtL(custo.consumo)} em ${periodo}`} />
            <KpiCard label="Custo do excesso" value={reais(custo.custoExcesso)} icon={<IconDroplet size={20} />} footer={`${fmtL(custo.excesso)} acima do esperado`} />
          </div>
          <Card as="section" className="overflow-hidden">
            <CardHeader id="custo-processos" title="Custo por processo" subtitle={periodo} />
            <DataTable rows={custo.porProcesso} cols={cols} rowKey={(p) => p.processoId} caption="Custo da água por processo" minWidth={720} />
          </Card>
        </>
      )}

      <CardPrecoM3 {...precos} />
    </div>
  )
}


function CardPrecoM3({ dados, carregando, erro, recarregar, cadastrar }: ReturnType<typeof usePrecosM3>) {
  const { notificar } = useApp()
  const [valor, setValor] = useState('')
  const [vigencia, setVigencia] = useState(() => diaNoFusoDaLavanderia(new Date()))
  const [erros, setErros] = useState<ErrosPrecoM3>({})
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const r = await salvarPrecoM3(valor, vigencia, cadastrar)
    setSalvando(false)
    setErros(r.ok ? {} : r.erros)
    if (r.ok) {
      notificar(`Preço do m³ de ${fmtReais(r.salvo.valor)} cadastrado a partir de ${fmtDia(r.salvo.vigencia)}.`)
      setValor('')
    } else if (r.mensagem) notificar(r.mensagem, 'erro')
  }

  const hoje = precoVigente(dados, diaNoFusoDaLavanderia(new Date()))
  const cols: Col<PrecoM3>[] = [
    { key: 'valor', header: 'Preço do m³', num: true, mobile: 'value', render: (p) => fmtReais(p.valor) },
    { key: 'vigencia', header: 'Vale a partir de', mobile: 'title', render: (p) => <span className="tabular-nums">{fmtDia(p.vigencia)}</span> },
    { key: 'por', header: 'Cadastrado por', render: (p) => p.cadastradoPor },
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
