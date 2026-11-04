import { useEffect, useState } from "react"
import {
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select,
  TextInput,
  type Col,
} from "../components/ui"
import { IconSearchCheck } from "../components/icons"
import { fmtData, fmtHora } from "../domain"
import * as api from "../services"

const POR_PAGINA = 20

const ROTULOS: Record<api.AcaoAuditoria, string> = {
  CRIACAO_USUARIO: "Criou o usuário",
  REDEFINICAO_SENHA: "Redefiniu a senha",
  DESATIVACAO_USUARIO: "Desativou o acesso",
  REATIVACAO_USUARIO: "Reativou o acesso",
}

const nomeDe = (p: api.PessoaDTO) => (
  <>
    {p.nome ?? "Usuário removido"}{" "}
    {p.usuario && <span className="text-ink-2">· {p.usuario}</span>}
  </>
)

/** Dia escolhido no filtro, em America/Recife (UTC-3), o fuso usado pelo sistema. */
const inicioDoDia = (dia: string) => (dia ? `${dia}T00:00:00-03:00` : undefined)
const fimDoDia = (dia: string) =>
  dia ? `${dia}T23:59:59.999-03:00` : undefined

/** G11: ações de administradores e gestores sobre a conta de outra pessoa. Os registros não podem ser alterados nem apagados. */
export default function Auditoria() {
  const [de, setDe] = useState("")
  const [ate, setAte] = useState("")
  const [acao, setAcao] = useState<api.AcaoAuditoria | "">("")
  const [pagina, setPagina] = useState(1)
  const [versao, setVersao] = useState(0)
  const [r, setR] = useState<{
    dados: api.PaginaAuditoriaDTO | null
    carregando: boolean
    erro: boolean
  }>({ dados: null, carregando: true, erro: false })

  useEffect(() => {
    let vivo = true
    setR((x) => ({ ...x, carregando: true, erro: false }))
    api
      .listarAuditoria({
        inicio: inicioDoDia(de),
        fim: fimDoDia(ate),
        acao: acao || undefined,
        pagina: pagina - 1,
        tamanho: POR_PAGINA,
      })
      .then(
        (dados) => vivo && setR({ dados, carregando: false, erro: false }),
        () => vivo && setR({ dados: null, carregando: false, erro: true }),
      )
    return () => {
      vivo = false
    }
  }, [de, ate, acao, pagina, versao])

  const filtrando = Boolean(de || ate || acao)
  const limpar = () => {
    setDe("")
    setAte("")
    setAcao("")
    setPagina(1)
  }
  const periodoInvalido = Boolean(de && ate && de > ate)

  const cols: Col<api.RegistroAuditoriaDTO>[] = [
    {
      key: "data",
      header: "Data e hora",
      mobile: "subtitle",
      render: (a) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtData(new Date(a.data))}{" "}
          <span className="text-ink-2">{fmtHora(new Date(a.data))}</span>
        </span>
      ),
    },
    {
      key: "acao",
      header: "Ação",
      mobile: "title",
      render: (a) => <span className="font-semibold">{ROTULOS[a.acao]}</span>,
    },
    { key: "gestor", header: "Feita por", render: (a) => nomeDe(a.gestor) },
    {
      key: "afetado",
      header: "Usuário afetado",
      render: (a) => nomeDe(a.usuarioAfetado),
    },
  ]

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Auditoria"
        description="Ações sobre as contas de outras pessoas. Estes registros não podem ser alterados nem apagados."
      />

      <Card as="section" className="overflow-hidden">
        <FilterBar onClear={filtrando ? limpar : undefined}>
          <Field id="auditoria-de" label="De" className="sm:w-44">
            <TextInput
              id="auditoria-de"
              type="date"
              value={de}
              onChange={(e) => {
                setDe(e.target.value)
                setPagina(1)
              }}
            />
          </Field>
          <Field
            id="auditoria-ate"
            label="Até"
            className="sm:w-44"
            error={
              periodoInvalido ? "A data final vem antes da inicial." : undefined
            }
          >
            <TextInput
              id="auditoria-ate"
              type="date"
              invalid={periodoInvalido}
              value={ate}
              onChange={(e) => {
                setAte(e.target.value)
                setPagina(1)
              }}
            />
          </Field>
          <Field id="auditoria-acao" label="Ação" className="sm:w-60">
            <Select
              id="auditoria-acao"
              value={acao}
              onChange={(e) => {
                setAcao(e.target.value as api.AcaoAuditoria | "")
                setPagina(1)
              }}
            >
              <option value="">Todas as ações</option>
              {(Object.keys(ROTULOS) as api.AcaoAuditoria[]).map((a) => (
                <option key={a} value={a}>
                  {ROTULOS[a]}
                </option>
              ))}
            </Select>
          </Field>
        </FilterBar>

        {r.carregando ? (
          <LoadingBlock rows={6} label="Carregando auditoria…" />
        ) : r.erro || !r.dados ? (
          <ErrorState
            title="Não foi possível carregar a auditoria"
            onRetry={() => setVersao((v) => v + 1)}
          />
        ) : r.dados.itens.length === 0 ? (
          <EmptyState
            icon={<IconSearchCheck size={28} />}
            title={
              filtrando
                ? "Nenhum registro neste filtro"
                : "Nenhuma ação registrada ainda"
            }
            description={
              filtrando
                ? "Mude o período ou a ação, ou limpe os filtros."
                : "As ações sobre outras contas aparecerão aqui."
            }
          />
        ) : (
          <>
            <DataTable
              rows={r.dados.itens}
              cols={cols}
              rowKey={(a) => String(a.id)}
              caption="Registros de auditoria"
              minWidth={760}
            />
            <div className="border-t border-line">
              <Pagination
                page={pagina}
                total={r.dados.total}
                perPage={POR_PAGINA}
                onChange={setPagina}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
