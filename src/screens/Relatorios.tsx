import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  Banner,
  Button,
  Card,
  CardHeader,
  DataTable,
  DiamondDivider,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  LogoMark,
  PageHeader,
  StatePreview,
  Select,
  StatusBadge,
  statusMeta,
} from '../components/ui'
import SkeletonChart from '../components/SkeletonChart'
import { IconArrowLeft, IconCalendar, IconDownload, IconPrinter } from '../components/icons'
import { consumoPorDia, desvioDe, fmtDataHora, fmtL, fmtLitrosPorPeca, fmtNum, fmtPct, litrosPorPeca, meses, nomeArquivoRelatorio, statusDe, textoDaReferencia, type Resumo } from '../domain'
import { Link, navigate } from '../router'
import { periodoAtual, useApp, useEstadoTela, useLotesDoMes, useResumo } from '../store'

// A biblioteca de gráficos só é carregada quando a tela precisa dela.
const GraficoMetaReal = lazy(() => import('../components/GraficoMetaReal'))
const GraficoDiario = lazy(() => import('../components/GraficoDiario'))

/** Gera o PDF de verdade e baixa. A biblioteca só é carregada no primeiro uso. */
function useBaixarPdf() {
  const { nomeProcesso, usuario, notificar } = useApp()
  const [gerando, setGerando] = useState(false)
  const [falha, setFalha] = useState(false)

  async function baixar(mes: number, ano: number, linhas: Resumo[]) {
    setFalha(false)
    setGerando(true)
    try {
      const { baixarRelatorioPdf } = await import('../services/relatorioPdf')
      const nome = await baixarRelatorioPdf({ mes, ano, linhas, nomeProcesso, responsavel: usuario?.nome })
      notificar(`${nome} baixado.`)
    } catch (e) {
      console.error(e)
      setFalha(true)
    } finally {
      setGerando(false)
    }
  }

  return { baixar, gerando, falha }
}

/* ---------- G7 Relatórios ---------- */

export function Relatorios({ mesInicial, anoInicial }: { mesInicial?: number; anoInicial?: number }) {
  const { nomeProcesso, processos } = useApp()
  const atual = periodoAtual()
  const [mes, setMes] = useState(mesInicial ?? atual.mes)
  const [ano, setAno] = useState(anoInicial ?? atual.ano)
  const consulta = useResumo(mes, ano)
  const lotesDoMes = useLotesDoMes(mes, ano)
  const [processoGrafico, setProcessoGrafico] = useState('')
  const [estado, setEstado] = useEstadoTela(consulta)
  const { baixar, gerando, falha: falhaPdf } = useBaixarPdf()

  const dados = estado === 'vazio' ? [] : consulta.dados
  const real = dados.reduce((s, r) => s + r.real, 0)
  const esperado = dados.reduce((s, r) => s + r.esperado, 0)
  const lotes = dados.reduce((s, r) => s + r.lotes, 0)
  const periodo = `${meses[mes - 1]} de ${ano}`
  const carregado = estado !== 'carregando' && estado !== 'erro'
  const podeExportar = carregado && dados.length > 0
  const semLotes = carregado && dados.length === 0
  // Enquanto carrega, a seção de gráficos já ocupa o seu lugar com esqueletos: se ela só aparecesse com os dados,
  // empurraria a tabela para baixo (CLS, issue #161).
  const carregandoResumo = estado === 'carregando'

  const totalDesvio = esperado ? desvioDe(real, esperado) : 0
  // O processo escolhido pode não ter lotes no mês novo: nesse caso, volta para todos.
  const filtro = dados.some((r) => r.processoId === processoGrafico) ? processoGrafico : ''
  const noGrafico = filtro ? dados.filter((r) => r.processoId === filtro) : dados
  const lotesNoGrafico = filtro ? lotesDoMes.dados.filter((l) => l.processoId === filtro) : lotesDoMes.dados
  const tdF = 'border-t-2 border-line-strong bg-page px-4 py-4 font-semibold text-ink first:pl-6 last:pr-6'

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <StatePreview value={estado} onChange={setEstado} />
      <PageHeader
        title="Relatórios"
        description="Consumo consolidado por tipo de processo no período escolhido."
      />

      <Card className="p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,240px)_minmax(0,160px)_1fr] sm:items-end">
          <Field id="mes" label="Mês">
            <Select id="mes" value={mes} disabled={gerando} onChange={(e) => setMes(Number(e.target.value))}>
              {meses.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="ano" label="Ano">
            <Select id="ano" value={ano} disabled={gerando} onChange={(e) => setAno(Number(e.target.value))}>
              {[atual.ano, atual.ano - 1].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="text"
              icon={<IconPrinter size={20} />}
              onClick={() => navigate(`/relatorios/pdf?mes=${mes}&ano=${ano}`)}
              disabled={!podeExportar || gerando}
              aria-describedby={semLotes ? 'aviso-sem-lotes' : undefined}
            >
              Pré-visualizar e imprimir
            </Button>
            <Button
              variant="secondary"
              icon={<IconDownload size={20} />}
              onClick={() => baixar(mes, ano, dados)}
              loading={gerando}
              disabled={!podeExportar}
              aria-describedby={semLotes ? 'aviso-sem-lotes' : undefined}
              className="w-full sm:w-auto"
            >
              {gerando ? 'Gerando PDF…' : 'Baixar PDF'}
            </Button>
          </div>
        </div>
        {gerando && (
          <p role="status" className="mt-4 text-[15px] text-ink-2">
            Gerando {nomeArquivoRelatorio(mes, ano)}…
          </p>
        )}
        {semLotes && (
          <div id="aviso-sem-lotes" className="mt-4">
            <Banner tone="info" title="Sem lotes neste período">
              Não há lotes registrados em {periodo.toLowerCase()}, por isso não há relatório para baixar. Escolha outro mês ou ano.
            </Banner>
          </div>
        )}
        {falhaPdf && (
          <div className="mt-4">
            <Banner tone="crit" title="Não foi possível gerar o PDF">
              Tente novamente em instantes. Os filtros escolhidos foram mantidos.
            </Banner>
          </div>
        )}
      </Card>

      {(podeExportar || carregandoResumo) && (
        <section aria-labelledby="graficos-titulo" aria-busy={carregandoResumo || lotesDoMes.carregando}>
          <Card className="flex flex-col">
            <CardHeader
              id="graficos-titulo"
              title="Gráficos do período"
              subtitle={periodo}
              action={
                <Field id="processo-grafico" label="Processo">
                  <Select id="processo-grafico" value={filtro} disabled={carregandoResumo} onChange={(e) => setProcessoGrafico(e.target.value)}>
                    <option value="">Todos os processos</option>
                    {dados.map((r) => (
                      <option key={r.processoId} value={r.processoId}>
                        {nomeProcesso(r.processoId)}
                      </option>
                    ))}
                  </Select>
                </Field>
              }
            />
            <div className="grid gap-8 p-4 sm:p-6 lg:grid-cols-2">
              <div className="min-w-0">
                <h3 className="mb-3 font-display text-[16px] font-semibold text-ink">Real x esperado</h3>
                {carregandoResumo ? (
                  <SkeletonChart formato="metaReal" nomes={processos.map((p) => p.nome)} label="Carregando gráfico real x esperado…" />
                ) : (
                  <Suspense fallback={<SkeletonChart formato="metaReal" nomes={noGrafico.map((r) => nomeProcesso(r.processoId))} label="Carregando gráfico real x esperado…" />}>
                    <GraficoMetaReal dados={noGrafico.map((r) => ({ nome: nomeProcesso(r.processoId), real: r.real, esperado: r.esperado }))} />
                  </Suspense>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="mb-3 font-display text-[16px] font-semibold text-ink">Consumo por dia</h3>
                {carregandoResumo || lotesDoMes.carregando ? (
                  <SkeletonChart formato="diario" label="Carregando consumo por dia…" />
                ) : lotesDoMes.erro ? (
                  <ErrorState title="Gráfico indisponível" onRetry={lotesDoMes.recarregar} />
                ) : (
                  <Suspense fallback={<SkeletonChart formato="diario" label="Carregando consumo por dia…" />}>
                    <GraficoDiario dias={consumoPorDia(lotesNoGrafico, mes, ano)} periodo={periodo} />
                  </Suspense>
                )}
              </div>
            </div>
          </Card>
        </section>
      )}

      <Card as="section" className="overflow-hidden">
        <CardHeader
          title="Consumo por tipo de processo"
          subtitle={
            <span className="flex items-center gap-2">
              <IconCalendar size={16} /> {periodo}
              {dados.length > 0 && estado === 'dados' && <span className="tabular-nums">· {fmtNum(lotes)} lotes</span>}
            </span>
          }
        />
        <div className="mt-4">
          {estado === 'carregando' ? (
            <LoadingBlock rows={4} label="Carregando relatório…" />
          ) : estado === 'erro' ? (
            <ErrorState title="Não foi possível carregar o relatório" onRetry={() => setEstado('dados')} />
          ) : dados.length === 0 ? (
            <EmptyState
              icon={<IconCalendar size={28} />}
              title="Sem dados no período"
              description={`Não há lotes registrados em ${periodo.toLowerCase()}. Escolha outro mês ou ano.`}
            />
          ) : (
            <DataTable<Resumo>
              rows={dados}
              rowKey={(r) => r.processoId}
              caption={`Consumo por tipo de processo em ${periodo}`}
              minWidth={720}
              cols={[
                { key: 'p', header: 'Processo', mobile: 'title', render: (r) => <span className="font-semibold">{nomeProcesso(r.processoId)}</span> },
                { key: 'l', header: 'Lotes', num: true, render: (r) => fmtNum(r.lotes) },
                { key: 'c', header: 'Consumido (L)', num: true, render: (r) => fmtNum(r.real) },
                { key: 'e', header: 'Esperado (L)', num: true, render: (r) => fmtNum(r.esperado) },
                { key: 'lp', header: 'L/peça', num: true, render: (r) => fmtLitrosPorPeca(r.litrosPorPeca) },
                { key: 'd', header: 'Desvio', num: true, mobile: 'value', render: (r) => <span className="font-semibold">{fmtPct(desvioDe(r.real, r.esperado))}</span> },
                { key: 's', header: 'Status', mobile: 'badge', render: (r) => <StatusBadge status={statusDe(desvioDe(r.real, r.esperado))} size="sm" /> },
              ]}
              footer={
                <tr>
                  <td className={tdF}>Total</td>
                  <td className={`${tdF} text-right tabular-nums`}>{fmtNum(lotes)}</td>
                  <td className={`${tdF} whitespace-nowrap text-right tabular-nums`}>{fmtNum(real)}</td>
                  <td className={`${tdF} whitespace-nowrap text-right tabular-nums`}>{fmtNum(esperado)}</td>
                  <td className={`${tdF} text-right tabular-nums`}>{fmtLitrosPorPeca(litrosPorPeca(real, dados.reduce((s, r) => s + r.pecas, 0)))}</td>
                  <td className={`${tdF} text-right tabular-nums`}>{fmtPct(totalDesvio)}</td>
                  <td className={tdF}>
                    <StatusBadge status={statusDe(totalDesvio)} size="sm" />
                  </td>
                </tr>
              }
            />
          )}
          {/* Totais no mobile */}
          {estado === 'dados' && dados.length > 0 && (
            <div className="flex flex-col gap-3 border-t-2 border-line-strong bg-page px-4 py-4 md:hidden">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Total</span>
                <span className="font-display text-lg font-semibold tabular-nums">{fmtPct(totalDesvio)}</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[15px]">
                <div>
                  <dt className="text-[13px] text-ink-2">Consumido</dt>
                  <dd className="font-semibold tabular-nums">{fmtL(real)}</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-ink-2">Esperado</dt>
                  <dd className="font-semibold tabular-nums">{fmtL(esperado)}</dd>
                </div>
              </dl>
              <StatusBadge status={statusDe(totalDesvio)} size="sm" />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/* ---------- G8 Pré-visualização do PDF (A4 vertical) ---------- */

const A4_W = 794
const A4_H = 1123

export function RelatorioPdf({ mes, ano }: { mes: number; ano: number }) {
  const { nomeProcesso, usuario } = useApp()
  const { baixar, gerando, falha } = useBaixarPdf()
  const wrap = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  const [geradoEm] = useState(() => new Date())

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setEscala(Math.min(1, e.contentRect.width / A4_W)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const consulta = useResumo(mes, ano)
  const dados = consulta.dados
  const real = dados.reduce((s, r) => s + r.real, 0)
  const esperado = dados.reduce((s, r) => s + r.esperado, 0)
  const lotes = dados.reduce((s, r) => s + r.lotes, 0)
  const periodo = `${meses[mes - 1]} de ${ano}`
  const nomeArquivo = nomeArquivoRelatorio(mes, ano)

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Pré-visualização do PDF"
        description={`${nomeArquivo} · A4 vertical`}
        back={
          <Link to={`/relatorios?mes=${mes}&ano=${ano}`} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-[15px] font-semibold text-link hover:underline">
            <IconArrowLeft size={18} /> Relatórios
          </Link>
        }
        actions={
          <>
            <Button variant="secondary" icon={<IconPrinter size={18} />} onClick={() => window.print()}>
              Imprimir
            </Button>
            <Button icon={<IconDownload size={18} />} onClick={() => baixar(mes, ano, dados)} loading={gerando} disabled={dados.length === 0}>
              {gerando ? 'Gerando PDF…' : 'Baixar PDF'}
            </Button>
          </>
        }
      />
      {falha && (
        <Banner tone="crit" title="Não foi possível gerar o PDF">
          Tente novamente em instantes.
        </Banner>
      )}

      <div ref={wrap} className="rounded-[8px] bg-neutral-bg p-0 sm:p-8">
        <div className="mx-auto" style={{ width: A4_W * escala, height: A4_H * escala }}>
          <article
            aria-label={`Relatório de consumo de água, ${periodo}`}
            className="tema-claro origin-top-left bg-white text-ink shadow-xl"
            style={{ width: A4_W, height: A4_H, transform: `scale(${escala})` }}
          >
            <div className="h-1 bg-terracota" />
            <div className="flex h-[calc(100%-4px)] flex-col px-16 py-14">
              <header className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-3">
                  <LogoMark size={52} />
                  <div>
                    <p className="font-display text-[22px] font-bold text-brand">Águas do Capibaribe</p>
                    <p className="text-[13px] text-ink-2">Gestão de consumo de água por lote</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] text-ink-2">Período</p>
                  <p className="font-display text-[18px] font-semibold">{periodo}</p>
                </div>
              </header>
              <DiamondDivider tone="areia" opacity={1} className="my-8" />

              <h1 className="text-[28px] font-bold">Relatório de consumo por tipo de processo</h1>
              <p className="mt-2 text-[15px] text-ink-2">
                Comparação entre o consumo real de água e o total esperado pelas metas dos processos.
              </p>

              {dados.length === 0 ? (
                <p className="mt-10 rounded-lg bg-page p-6 text-[15px] text-ink-2">
                  {consulta.carregando ? 'Carregando dados do período…' : consulta.erro ? 'Não foi possível carregar os dados do período.' : 'Não há lotes registrados neste período.'}
                </p>
              ) : (
                <>
                  <div className="mt-8 grid grid-cols-3 gap-4">
                    {[
                      ['Total consumido', fmtL(real)],
                      ['Total esperado', fmtL(esperado)],
                      ['Desvio geral', fmtPct(desvioDe(real, esperado))],
                    ].map(([l, v]) => (
                      <div key={l} className="rounded-lg border border-line px-4 py-3">
                        <p className="text-[13px] text-ink-2">{l}</p>
                        <p className="mt-1 font-display text-[22px] font-semibold tabular-nums">{v}</p>
                      </div>
                    ))}
                  </div>

                  <table className="mt-8 w-full border-collapse text-left text-[14px]">
                    <thead>
                      <tr className="border-b-2 border-brand">
                        {['Processo', 'Lotes', 'Consumido (L)', 'Esperado (L)', 'L/peça', 'Desvio', 'Situação'].map((h, i) => (
                          <th key={h} className={`py-2 text-[13px] font-medium text-ink-2 ${i > 0 && i < 6 ? 'text-right' : ''} ${i === 6 ? 'pl-6' : ''}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dados.map((r) => {
                        const dv = desvioDe(r.real, r.esperado)
                        const m = statusMeta[statusDe(dv)]
                        return (
                          <tr key={r.processoId} className="border-b border-line">
                            <td className="py-3 font-semibold">{nomeProcesso(r.processoId)}</td>
                            <td className="py-3 text-right tabular-nums">{fmtNum(r.lotes)}</td>
                            <td className="py-3 text-right whitespace-nowrap tabular-nums">{fmtNum(r.real)}</td>
                            <td className="py-3 text-right whitespace-nowrap tabular-nums">{fmtNum(r.esperado)}</td>
                            <td className="py-3 text-right tabular-nums">{fmtLitrosPorPeca(r.litrosPorPeca)}</td>
                            <td className="py-3 text-right font-semibold tabular-nums">{fmtPct(dv)}</td>
                            <td className={`py-3 pl-6 ${m.text}`}>
                              <span className="inline-flex items-center gap-1.5 font-semibold">
                                <m.Icon size={15} strokeWidth={2.2} /> {m.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ink bg-page">
                        <td className="py-3 pl-2 font-semibold">Total</td>
                        <td className="py-3 text-right font-semibold tabular-nums">{fmtNum(lotes)}</td>
                        <td className="py-3 text-right font-semibold whitespace-nowrap tabular-nums">{fmtNum(real)}</td>
                        <td className="py-3 text-right font-semibold whitespace-nowrap tabular-nums">{fmtNum(esperado)}</td>
                        <td className="py-3 text-right font-semibold tabular-nums">{fmtLitrosPorPeca(litrosPorPeca(real, dados.reduce((s, r) => s + r.pecas, 0)))}</td>
                        <td className="py-3 text-right font-semibold tabular-nums">{fmtPct(desvioDe(real, esperado))}</td>
                        <td className="py-3 pl-6" />
                      </tr>
                    </tfoot>
                  </table>
                  <p className="mt-4 text-[12px] text-ink-2">
                    Desvio = (consumido − esperado) ÷ esperado. L/peça = consumido ÷ peças. {textoDaReferencia}. Valores em litros.
                  </p>
                </>
              )}

              <footer className="mt-auto">
                <DiamondDivider tone="terracota" opacity={0.4} className="mb-4" />
                <div className="flex justify-between text-[12px] text-ink-2">
                  <span>
                    Gerado em {fmtDataHora(geradoEm)}
                    {usuario ? ` por ${usuario.nome}` : ''}
                  </span>
                  <span>Página 1 de 1</span>
                </div>
              </footer>
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
