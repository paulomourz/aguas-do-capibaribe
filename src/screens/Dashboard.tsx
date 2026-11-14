import { lazy, Suspense } from 'react'
import BarChart from '../components/BarChart'
import {
  AlertBadge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  KpiCard,
  LoadingBlock,
  PageHeader,
  StatePreview,
  Skeleton,
  StatusBadge,
} from '../components/ui'
import { IconBell, IconChevron, IconDroplet, IconReport, IconTarget, IconTrend } from '../components/icons'
import { consumoPorDia, desvioDe, desvioMedio, fmtDataHora, fmtL, fmtLitrosPorPeca, fmtNum, fmtPct, litrosPorPeca, meses, textoDaReferencia, type Resumo } from '../domain'
import { statusDe } from '../domain'
import { Link, navigate } from '../router'
import { periodoAtual, useApp, useEstadoTela, useLotesDoMes, useResumo } from '../store'

// A biblioteca de gráficos só é carregada quando a tela precisa dela.
const GraficoDiario = lazy(() => import('../components/GraficoDiario'))

export default function Dashboard() {
  const { alertas, nomeProcesso } = useApp()
  const { mes, ano } = periodoAtual()
  const consulta = useResumo(mes, ano)
  const lotesDoMes = useLotesDoMes(mes, ano)
  const [estado, setEstado] = useEstadoTela(consulta)
  const resumo = estado === 'vazio' ? [] : consulta.dados
  const real = resumo.reduce((s, r) => s + r.real, 0)
  const esperado = resumo.reduce((s, r) => s + r.esperado, 0)
  const desvio = esperado ? desvioDe(real, esperado) : 0
  const pegada = litrosPorPeca(real, resumo.reduce((s, r) => s + r.pecas, 0))
  const ativos = alertas.filter((a) => a.status !== 'resolvido')
  const periodo = `${meses[mes - 1]} de ${ano}`

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <StatePreview value={estado} onChange={setEstado} />
      <PageHeader
        title="Dashboard"
        description={`Consumo de água de ${periodo.toLowerCase()} comparado às metas de cada processo.`}
      />

      {/* Alertas ativos — em destaque no topo */}
      <Card as="section" className="overflow-hidden border-l-4 border-l-brand">
        <CardHeader
          id="alertas-ativos"
          title={`Alertas ativos${estado === 'dados' && ativos.length ? ` (${ativos.length})` : ''}`}
          subtitle="Processos com 3 ou mais lotes consecutivos acima da meta."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/alertas')} icon={<IconBell size={18} />}>
              Ver todos os alertas
            </Button>
          }
        />
        <div className="mt-4">
          {estado === 'carregando' ? (
            <LoadingBlock rows={2} label="Carregando alertas…" />
          ) : estado === 'erro' ? (
            <ErrorState title="Não foi possível carregar os alertas" onRetry={() => setEstado('dados')} />
          ) : estado === 'vazio' || ativos.length === 0 ? (
            <EmptyState icon={<IconBell size={28} />} title="Nenhum alerta ativo" description="Nenhum processo tem desvio recorrente no momento." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {ativos.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/alertas/${a.id}`}
                    className="group flex flex-col gap-3 px-4 py-4 hover:bg-zebra sm:flex-row sm:items-center sm:gap-6 sm:px-6"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertBadge status={a.status} size="sm" />
                        <span className="font-display text-[18px] font-semibold text-ink">{nomeProcesso(a.processoId)}</span>
                      </div>
                      <span className="text-[15px] text-ink-2">
                        {a.lotes.length} lotes consecutivos acima da meta · {fmtDataHora(a.detectado)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="text-[15px] text-ink-2">
                        Desvio médio <strong className="font-semibold text-ink tabular-nums">{fmtPct(desvioMedio(a))}</strong>
                      </span>
                      <span className="flex items-center gap-1 text-[15px] font-semibold text-link group-hover:underline">
                        Ver detalhe <IconChevron size={18} />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Indicadores */}
      <section aria-label="Indicadores do mês" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-6">
        {estado === 'carregando' ? (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col gap-4 p-6">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))
        ) : estado === 'erro' ? (
          <Card className="sm:col-span-2 xl:col-span-4">
            <ErrorState title="Não foi possível carregar os indicadores" onRetry={() => setEstado('dados')} />
          </Card>
        ) : (
          <>
            <KpiCard
              label="Consumo total do mês"
              value={resumo.length ? fmtNum(real) : '—'}
              unit={resumo.length ? 'L' : undefined}
              icon={<IconDroplet size={20} />}
              footer={resumo.length ? `${fmtNum(resumo.reduce((s, r) => s + r.lotes, 0))} lotes em ${periodo.toLowerCase()}` : 'Nenhum lote registrado no mês'}
            />
            <KpiCard
              label="Total esperado pela meta"
              value={resumo.length ? fmtNum(esperado) : '—'}
              unit={resumo.length ? 'L' : undefined}
              icon={<IconTarget size={20} />}
              footer={resumo.length ? 'Soma das metas dos lotes registrados' : 'Sem lotes para calcular'}
            />
            <KpiCard
              label="Desvio geral"
              value={resumo.length ? fmtPct(desvio) : '—'}
              icon={<IconTrend size={20} />}
              footer={
                resumo.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={statusDe(desvio)} size="sm" />
                    <span className="tabular-nums">
                      {fmtL(Math.abs(real - esperado))} {real >= esperado ? 'acima' : 'abaixo'}
                    </span>
                  </div>
                ) : (
                  'Sem lotes para calcular'
                )
              }
            />
            <KpiCard
              label="Água por peça"
              value={pegada == null ? '—' : fmtLitrosPorPeca(pegada)}
              unit={pegada == null ? undefined : 'L'}
              icon={<IconDroplet size={20} />}
              footer={pegada == null ? 'Sem lotes para calcular' : `Média do mês. ${textoDaReferencia}.`}
            />
          </>
        )}
      </section>

      {/* Resumo por processo */}
      <section aria-labelledby="resumo-titulo" className="grid gap-4 lg:grid-cols-12 lg:items-start lg:gap-6">
        <Card className="overflow-hidden lg:col-span-7">
          <CardHeader
            id="resumo-titulo"
            title="Resumo por tipo de processo"
            subtitle={periodo}
            action={
              <Button variant="text" size="sm" icon={<IconReport size={18} />} onClick={() => navigate('/relatorios')}>
                Ver relatório completo
              </Button>
            }
          />
          <div className="mt-4">
            {estado === 'carregando' ? (
              <LoadingBlock rows={3} />
            ) : estado === 'erro' ? (
              <ErrorState onRetry={() => setEstado('dados')} />
            ) : resumo.length === 0 ? (
              <EmptyState icon={<IconDroplet size={28} />} title="Nenhum lote neste mês" description="Os totais aparecem assim que o primeiro lote do mês for registrado." />
            ) : (
              <DataTable<Resumo>
                rows={resumo}
                rowKey={(r) => r.processoId}
                caption="Resumo de consumo por tipo de processo"
                minWidth={520}
                cols={[
                  { key: 'p', header: 'Processo', mobile: 'title', render: (r) => <span className="font-semibold">{nomeProcesso(r.processoId)}</span> },
                  { key: 'r', header: 'Real (L)', num: true, render: (r) => fmtNum(r.real) },
                  { key: 'e', header: 'Esperado (L)', num: true, render: (r) => fmtNum(r.esperado) },
                  { key: 'lp', header: 'L/peça', num: true, render: (r) => fmtLitrosPorPeca(r.litrosPorPeca) },
                  { key: 'd', header: 'Desvio', num: true, mobile: 'value', render: (r) => <span className="font-semibold">{fmtPct(desvioDe(r.real, r.esperado))}</span> },
                  { key: 's', header: 'Status', mobile: 'badge', render: (r) => <StatusBadge status={statusDe(desvioDe(r.real, r.esperado))} size="sm" /> },
                ]}
              />
            )}
          </div>
        </Card>

        <Card className="flex flex-col lg:col-span-5">
          <CardHeader title="Meta x real" subtitle="Litros por processo no mês" />
          <div className="flex-1 p-4 sm:p-6">
            {estado === 'carregando' ? (
              <Skeleton className="h-[280px] w-full" />
            ) : estado === 'erro' ? (
              <ErrorState title="Gráfico indisponível" onRetry={() => setEstado('dados')} />
            ) : resumo.length === 0 ? (
              <EmptyState title="Sem dados para o gráfico" />
            ) : (
              <BarChart data={resumo.map((r) => ({ label: nomeProcesso(r.processoId), meta: r.esperado, real: r.real }))} />
            )}
          </div>
        </Card>
      </section>

      {/* Consumo diário */}
      <section aria-labelledby="diario-titulo">
        <Card className="flex flex-col">
          <CardHeader id="diario-titulo" title="Consumo por dia" subtitle={periodo} />
          <div className="p-4 sm:p-6">
            {estado === 'carregando' || lotesDoMes.carregando ? (
              <Skeleton className="h-[260px] w-full" />
            ) : estado === 'erro' || lotesDoMes.erro ? (
              <ErrorState
                title="Gráfico indisponível"
                onRetry={() => {
                  setEstado('dados')
                  lotesDoMes.recarregar()
                }}
              />
            ) : resumo.length === 0 ? (
              <EmptyState title="Sem dados para o gráfico" />
            ) : (
              <Suspense fallback={<Skeleton className="h-[260px] w-full" />}>
                <GraficoDiario dias={consumoPorDia(lotesDoMes.dados, mes, ano)} periodo={periodo} />
              </Suspense>
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}
