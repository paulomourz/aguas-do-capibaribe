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
  TextInput,
  type Col,
} from '../components/ui'
import { IconDownload, IconHistory, IconPlus } from '../components/icons'
import {
  filtrando,
  filtrarLotes,
  fmtData,
  fmtHora,
  fmtL,
  fmtNum,
  fmtPct,
  periodoInvalido,
  type FiltroHistorico,
  type Lote,
} from '../domain'
import { navigate } from '../router'
import { baixarCsvLotes } from '../services/historicoCsv'
import { useApp, useEstadoTela } from '../store'

const POR_PAGINA = 8

/** O3 (operador: somente os próprios lotes) e G6 (gestor: todos os lotes, com "Registrado por"). */
export default function Historico() {
  const { usuario, usuarios, lotes, processos, nomeProcesso, nomeUsuario, notificar } = useApp()
  const gestor = usuario?.perfil !== 'operador'
  const [estado, setEstado] = useEstadoTela()
  const [filtro, setFiltro] = useState<FiltroHistorico>({})
  const [pagina, setPagina] = useState(1)
  const { processoId } = filtro

  const mudar = (campo: keyof FiltroHistorico, valor: string) => {
    setFiltro((f) => ({ ...f, [campo]: valor || undefined }))
    setPagina(1)
  }
  const limpar = () => {
    setFiltro({})
    setPagina(1)
  }

  // Issue #107: período (dias de Recife), processo e, para gestor e administrador, quem registrou.
  // O operador continua vendo só os próprios lotes.
  const base = estado === 'vazio' ? [] : gestor ? lotes : lotes.filter((l) => l.usuarioId === usuario?.id)
  const invalido = periodoInvalido(filtro)
  const filtrados = invalido ? [] : filtrarLotes(base, gestor ? filtro : { ...filtro, usuarioId: undefined })
  // Quem já registrou algum lote, em ordem alfabética, para o filtro "Registrado por".
  const quemRegistrou = gestor
    ? [...new Set(lotes.map((l) => l.usuarioId))]
        .map((id) => ({ id, nome: usuarios.find((u) => u.id === id)?.nome ?? nomeUsuario(id) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    : []
  const pagina_ = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / POR_PAGINA)))
  const visiveis = filtrados.slice((pagina_ - 1) * POR_PAGINA, pagina_ * POR_PAGINA)
  const podeExportar = estado === 'dados' && filtrados.length > 0

  /** Exporta todos os lotes do filtro atual (não só a página visível) para auditoria externa. */
  function exportarCsv() {
    try {
      const nome = baixarCsvLotes(filtrados, {
        nomeProcesso,
        // O operador não carrega a lista de usuários; os lotes dele são todos dele.
        nomeUsuario: (id) => (id === usuario?.id ? usuario.nome : nomeUsuario(id)),
        processo: processoId ? nomeProcesso(processoId) : undefined,
      })
      notificar(`${nome} baixado.`)
    } catch (e) {
      console.error(e)
      notificar('Não foi possível gerar o CSV. Tente de novo.', 'erro')
    }
  }

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
    { key: 'status', header: 'Status', mobile: 'badge', render: (l) => <StatusBadge status={l.status} size="sm" /> },
  ]
  if (gestor) cols.push({ key: 'por', header: 'Registrado por', render: (l) => nomeUsuario(l.usuarioId) })

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <StatePreview value={estado} onChange={setEstado} />
      <PageHeader
        title="Histórico de lotes"
        description={gestor ? 'Todos os lotes registrados na lavanderia.' : 'Somente os lotes que você registrou.'}
        actions={
          <Button
            variant="secondary"
            icon={<IconDownload size={20} />}
            onClick={exportarCsv}
            disabled={!podeExportar}
            title={podeExportar ? `Exporta ${filtrados.length} ${filtrados.length === 1 ? 'lote' : 'lotes'} do filtro atual` : undefined}
            className="w-full sm:w-auto"
          >
            Exportar CSV
          </Button>
        }
      />

      <Card as="section" className="overflow-hidden">
        <FilterBar onClear={filtrando(filtro) ? limpar : undefined}>
          <Field id="filtro-de" label="De" className="sm:w-44">
            <TextInput
              id="filtro-de"
              type="date"
              value={filtro.de ?? ''}
              disabled={estado !== 'dados'}
              onChange={(e) => mudar('de', e.target.value)}
            />
          </Field>
          <Field
            id="filtro-ate"
            label="Até"
            className="sm:w-44"
            error={invalido ? 'A data final vem antes da inicial.' : undefined}
          >
            <TextInput
              id="filtro-ate"
              type="date"
              invalid={invalido}
              value={filtro.ate ?? ''}
              disabled={estado !== 'dados'}
              onChange={(e) => mudar('ate', e.target.value)}
            />
          </Field>
          <Field id="filtro-processo" label="Processo" className="sm:w-64">
            <Select
              id="filtro-processo"
              value={processoId ?? ''}
              disabled={estado !== 'dados'}
              onChange={(e) => mudar('processoId', e.target.value)}
            >
              <option value="">Todos os processos</option>
              {processos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Field>
          {gestor && (
            <Field id="filtro-usuario" label="Registrado por" className="sm:w-64">
              <Select
                id="filtro-usuario"
                value={filtro.usuarioId ?? ''}
                disabled={estado !== 'dados'}
                onChange={(e) => mudar('usuarioId', e.target.value)}
              >
                <option value="">Todos</option>
                {quemRegistrou.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </FilterBar>

        {estado === 'carregando' ? (
          <LoadingBlock rows={6} label="Carregando histórico…" />
        ) : estado === 'erro' ? (
          <ErrorState title="Não foi possível carregar o histórico" onRetry={() => setEstado('dados')} />
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<IconHistory size={28} />}
            title={base.length === 0 ? 'Nenhum lote registrado ainda' : 'Nenhum lote neste filtro'}
            description={
              base.length === 0
                ? gestor
                  ? 'Os lotes aparecerão aqui assim que os operadores começarem a registrar.'
                  : 'Seus lotes aparecerão aqui depois do primeiro registro.'
                : invalido
                  ? 'A data final vem antes da inicial. Corrija o período.'
                  : 'Mude o período, o processo ou quem registrou, ou limpe os filtros.'
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
