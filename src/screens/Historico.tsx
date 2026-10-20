import { useState } from 'react'
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  LoadingBlock,
  PageHeader,
  StatePreview,
  Pagination,
  Select,
  StatusBadge,
  type Col,
} from '../components/ui'
import { IconHistory, IconPlus } from '../components/icons'
import { fmtData, fmtHora, fmtL, fmtNum, fmtPct, statusDe, type Lote } from '../domain'
import { navigate } from '../router'
import { useApp, useEstadoTela } from '../store'

const POR_PAGINA = 8

/** O3 (operador: somente os próprios lotes) e G6 (gestor: todos os lotes, com "Registrado por"). */
export default function Historico() {
  const { usuario, lotes, processos, nomeProcesso, nomeUsuario } = useApp()
  const gestor = usuario?.perfil === 'gestor'
  const [estado, setEstado] = useEstadoTela()
  const [processoId, setProcessoId] = useState('')
  const [pagina, setPagina] = useState(1)

  const base = estado === 'vazio' ? [] : gestor ? lotes : lotes.filter((l) => l.usuarioId === usuario?.id)
  const filtrados = base.filter((l) => !processoId || l.processoId === processoId)
  const pagina_ = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / POR_PAGINA)))
  const visiveis = filtrados.slice((pagina_ - 1) * POR_PAGINA, pagina_ * POR_PAGINA)

  const cols: Col<Lote>[] = [
    {
      key: 'data',
      header: 'Data e hora',
      mobile: 'subtitle',
      render: (l) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtData(l.data)} <span className="text-ink-2">{fmtHora(l.data)}</span>
        </span>
      ),
    },
    {
      key: 'processo',
      header: 'Processo',
      mobile: 'title',
      render: (l) => (
        <span className="font-semibold">
          {nomeProcesso(l.processoId)} <span className="font-normal text-ink-2 tabular-nums">· {l.id}</span>
        </span>
      ),
    },
    { key: 'pecas', header: 'Peças', num: true, render: (l) => fmtNum(l.pecas) },
    { key: 'litros', header: 'Real (L)', num: true, render: (l) => fmtNum(l.litros) },
    { key: 'esperado', header: 'Esperado (L)', num: true, render: (l) => fmtNum(l.esperado) },
    { key: 'desvio', header: 'Desvio', num: true, mobile: 'value', render: (l) => <span className="font-semibold">{fmtPct(l.desvio)}</span> },
    { key: 'status', header: 'Status', mobile: 'badge', render: (l) => <StatusBadge status={statusDe(l.desvio)} size="sm" /> },
  ]
  if (gestor) cols.push({ key: 'por', header: 'Registrado por', render: (l) => nomeUsuario(l.usuarioId) })

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <StatePreview value={estado} onChange={setEstado} />
      <PageHeader
        title="Histórico de lotes"
        description={gestor ? 'Todos os lotes registrados na lavanderia.' : 'Somente os lotes que você registrou.'}
      />

      <Card as="section" className="overflow-hidden">
        <FilterBar
          onClear={processoId ? () => { setProcessoId(''); setPagina(1) } : undefined}
        >
          <Field id="filtro-processo" label="Processo" className="sm:w-64">
            <Select
              id="filtro-processo"
              value={processoId}
              disabled={estado !== 'dados'}
              onChange={(e) => {
                setProcessoId(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todos os processos</option>
              {processos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Field>
        </FilterBar>

        {estado === 'carregando' ? (
          <LoadingBlock rows={6} label="Carregando histórico…" />
        ) : estado === 'erro' ? (
          <ErrorState title="Não foi possível carregar o histórico" onRetry={() => setEstado('dados')} />
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<IconHistory size={28} />}
            title={base.length === 0 ? 'Nenhum lote registrado ainda' : 'Nenhum lote deste processo'}
            description={
              base.length === 0
                ? gestor
                  ? 'Os lotes aparecerão aqui assim que os operadores começarem a registrar.'
                  : 'Seus lotes aparecerão aqui depois do primeiro registro.'
                : 'Escolha outro processo ou limpe o filtro.'
            }
            action={
              base.length === 0 ? (
                <Button icon={<IconPlus size={18} />} onClick={() => navigate('/registro')}>
                  Registrar lote
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <DataTable rows={visiveis} cols={cols} rowKey={(l) => l.id} caption="Histórico de lotes" minWidth={gestor ? 880 : 720} />
            <div className="border-t border-line">
              <Pagination page={pagina_} total={filtrados.length} perPage={POR_PAGINA} onChange={setPagina} />
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
