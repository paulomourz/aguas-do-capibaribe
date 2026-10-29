import { useState } from 'react'
import {
  AlertBadge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Modal,
  PageHeader,
  StatePreview,
  StatusBadge,
  Tabs,
  Tag,
  alertMeta,
  cx,
  statusMeta,
} from '../components/ui'
import { IconArrowLeft, IconBell, IconCheckCircle, IconChevron, IconClock, IconSearch } from '../components/icons'
import { desvioMedio, fmtData, fmtDataHora, fmtHora, fmtL, fmtNum, fmtPct, statusDe, type AlertaStatus, type Lote } from '../domain'
import { Link, navigate } from '../router'
import { errosDaApi, useApp, useEstadoTela } from '../store'

const abaLabel: Record<AlertaStatus, string> = { aberto: 'Abertos', analise: 'Em análise', resolvido: 'Resolvidos' }
const vazioTexto: Record<AlertaStatus, string> = {
  aberto: 'Nenhum alerta aberto',
  analise: 'Nenhum alerta em análise',
  resolvido: 'Nenhum alerta resolvido',
}

/* ---------- G4 Alertas (lista) ---------- */

export function Alertas({ aba }: { aba: AlertaStatus }) {
  const { alertas, nomeProcesso } = useApp()
  const [estado, setEstado] = useEstadoTela()
  const base = estado === 'vazio' ? [] : alertas
  const lista = base.filter((a) => a.status === aba)

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <StatePreview value={estado} onChange={setEstado} />
      <PageHeader
        title="Alertas"
        description="Um alerta é gerado quando 3 ou mais lotes consecutivos do mesmo processo ficam acima da meta."
      />

      <Tabs<AlertaStatus>
        label="Situação dos alertas"
        value={aba}
        onChange={(v) => navigate(`/alertas?aba=${v}`, { replace: true })}
        tabs={(['aberto', 'analise', 'resolvido'] as AlertaStatus[]).map((s) => ({
          value: s,
          label: abaLabel[s],
          tone: s === 'aberto' ? ('crit' as const) : undefined,
          count: base.filter((a) => a.status === s).length,
        }))}
      />

      <div role="tabpanel" aria-label={abaLabel[aba]}>
        {estado === 'carregando' ? (
          <Card>
            <LoadingBlock rows={3} label="Carregando alertas…" />
          </Card>
        ) : estado === 'erro' ? (
          <Card>
            <ErrorState title="Não foi possível carregar os alertas" onRetry={() => setEstado('dados')} />
          </Card>
        ) : lista.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconBell size={28} />}
              title={vazioTexto[aba]}
              description={
                aba === 'aberto'
                  ? 'Quando um processo tiver 3 ou mais lotes consecutivos acima da meta, o alerta aparecerá aqui.'
                  : 'Os alertas aparecem aqui conforme a situação for atualizada.'
              }
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {lista.map((a) => {
              const dm = desvioMedio(a)
              return (
                <li key={a.id}>
                  <Card as="article">
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-5">
                      <div className={cx('w-[128px] shrink-0 font-display text-[36px] font-bold leading-none tracking-tight tabular-nums', statusMeta[statusDe(dm)].text)}>
                        {fmtPct(dm)}
                        <span className="mt-1 block font-sans text-[13px] font-medium tracking-normal text-ink-2">desvio médio</span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[20px] font-semibold leading-tight text-ink">{nomeProcesso(a.processoId)}</h2>
                          <AlertBadge status={a.status} size="sm" />
                        </div>
                        <p className="flex flex-wrap items-center gap-x-2 text-[15px] text-ink-2">
                          <span>
                            <strong className="font-semibold text-ink tabular-nums">{a.lotes.length} lotes seguidos</strong> acima da meta
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <IconClock size={15} /> {fmtDataHora(a.detectado)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Alerta {a.id}</span>
                        </p>
                      </div>
                      <Link
                        to={`/alertas/${a.id}`}
                        className="flex min-h-11 items-center gap-1 self-start rounded-lg text-[15px] font-semibold text-link hover:underline md:ml-auto md:self-center"
                      >
                        Ver detalhe<span className="sr-only"> do alerta {a.id}, {nomeProcesso(a.processoId)}</span> <IconChevron size={18} />
                      </Link>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ---------- G5 Detalhe do alerta ---------- */

export function AlertaDetalhe({ id }: { id: string }) {
  const { alertas, nomeProcesso, mudarStatusAlerta, notificar, processos, carregando } = useApp()
  const [acao, setAcao] = useState<AlertaStatus | null>(null)
  const [salvando, setSalvando] = useState(false)
  const alerta = alertas.find((a) => a.id === id)

  const voltar = (
    <Link to="/alertas" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-[15px] font-semibold text-link hover:underline">
      <IconArrowLeft size={18} /> Alertas
    </Link>
  )

  if (!alerta) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Detalhe do alerta" back={voltar} />
        <Card>
          {carregando ? (
            <LoadingBlock rows={3} label="Carregando alerta…" />
          ) : (
            <ErrorState title="Alerta não encontrado" description="Este alerta não existe ou foi removido." />
          )}
        </Card>
      </div>
    )
  }

  const dm = desvioMedio(alerta)
  const processo = processos.find((p) => p.id === alerta.processoId)

  async function confirmar() {
    if (!acao || !alerta) return
    setSalvando(true)
    try {
      await mudarStatusAlerta(alerta.id, acao)
      notificar(`Alerta ${alerta.id} marcado como “${alertMeta[acao].label}”.`)
      navigate(`/alertas?aba=${acao}`)
    } catch (err) {
      notificar(errosDaApi(err).mensagem, 'erro')
    } finally {
      setSalvando(false)
      setAcao(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        back={voltar}
        title={`${nomeProcesso(alerta.processoId)} · ${alerta.lotes.length} lotes acima da meta`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <AlertBadge status={alerta.status} />
            <span className="tabular-nums">Alerta {alerta.id} · detectado em {fmtDataHora(alerta.detectado)}</span>
          </span>
        }
        actions={
          alerta.status !== 'resolvido' && (
            <>
              {alerta.status === 'aberto' && (
                <Button variant="secondary" icon={<IconSearch size={18} />} onClick={() => setAcao('analise')}>
                  Marcar em análise
                </Button>
              )}
              <Button icon={<IconCheckCircle size={18} />} onClick={() => setAcao('resolvido')}>
                Marcar como resolvido
              </Button>
            </>
          )
        }
      />

      <section aria-label="Resumo do alerta" className="grid gap-4 sm:grid-cols-3 lg:gap-6">
        <Card className="p-6">
          <p className="text-[15px] text-ink-2">Processo</p>
          <p className="mt-2 font-display text-[22px] font-semibold">{nomeProcesso(alerta.processoId)}</p>
          {processo && (
            <p className="mt-1 text-[15px] text-ink-2 tabular-nums">
              Meta: {fmtNum(processo.meta)} {processo.unidade === 'peca' ? 'litros por peça' : 'litros por lote'}
            </p>
          )}
        </Card>
        <Card className="p-6">
          <p className="text-[15px] text-ink-2">Lotes consecutivos acima da meta</p>
          <p className="mt-2 font-display text-[32px] font-semibold leading-none tabular-nums">{alerta.lotes.length}</p>
        </Card>
        <Card className="p-6">
          <p className="text-[15px] text-ink-2">Desvio médio</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="font-display text-[32px] font-semibold leading-none tabular-nums">{fmtPct(dm)}</span>
            <StatusBadge status={statusDe(dm)} size="sm" />
          </div>
        </Card>
      </section>

      <Card as="section" className="overflow-hidden">
        <CardHeader title="Sequência de lotes que gerou o alerta" subtitle="Do mais antigo ao mais recente." />
        <div className="mt-4">
          <DataTable<Lote>
            rows={alerta.lotes}
            rowKey={(l) => l.id}
            caption="Sequência de lotes do alerta"
            minWidth={760}
            cols={[
              { key: 'l', header: 'Lote', mobile: 'title', render: (l) => <span className="font-semibold tabular-nums">{l.id}</span> },
              { key: 'd', header: 'Data e hora', mobile: 'subtitle', render: (l) => <span className="whitespace-nowrap tabular-nums">{fmtData(l.data)} {fmtHora(l.data)}</span> },
              { key: 'p', header: 'Peças', num: true, render: (l) => fmtNum(l.pecas) },
              { key: 'r', header: 'Real (L)', num: true, render: (l) => fmtNum(l.litros) },
              { key: 'e', header: 'Esperado (L)', num: true, render: (l) => fmtNum(l.esperado) },
              { key: 'v', header: 'Desvio', num: true, mobile: 'value', render: (l) => <span className="font-semibold">{fmtPct(l.desvio)}</span> },
              { key: 's', header: 'Status', mobile: 'badge', render: (l) => <StatusBadge status={l.status} size="sm" /> },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-4 text-[15px] text-ink-2 sm:px-6">
          Lotes relacionados: {alerta.lotes.map((l) => <Tag key={l.id}>{l.id}</Tag>)}
        </div>
      </Card>

      <Modal
        open={!!acao}
        onClose={() => !salvando && setAcao(null)}
        size="sm"
        title={acao === 'resolvido' ? 'Marcar alerta como resolvido?' : 'Marcar alerta em análise?'}
        description={
          acao === 'resolvido'
            ? `O alerta ${alerta.id} de ${nomeProcesso(alerta.processoId)} sairá da lista de abertos e ficará em Resolvidos.`
            : `A equipe saberá que o alerta ${alerta.id} de ${nomeProcesso(alerta.processoId)} está sendo verificado.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setAcao(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={confirmar} loading={salvando} data-autofocus>
              {acao === 'resolvido' ? 'Confirmar resolução' : 'Confirmar análise'}
            </Button>
          </>
        }
      >
        {acao && (
          <div className="flex flex-wrap items-center gap-3 text-[15px] text-ink-2">
            <span>Situação:</span>
            <AlertBadge status={alerta.status} size="sm" />
            <IconChevron size={18} />
            <AlertBadge status={acao} size="sm" />
          </div>
        )}
      </Modal>
    </div>
  )
}
