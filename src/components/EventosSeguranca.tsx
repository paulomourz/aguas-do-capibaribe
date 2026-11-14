import { useEffect, useState } from "react"
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  KpiCard,
  LoadingBlock,
  Select,
  type Col,
} from "./ui"
import { IconDownload, IconLock, IconRefresh } from "./icons"
import { fmtData, fmtHora } from "../domain"
import * as api from "../services"

/** Filtro do painel: o que mostrar. */
export type TipoEvento = "todos" | "logins" | "bloqueios" | "senhas"

const TIPOS: Record<TipoEvento, string> = {
  todos: "Todos os eventos",
  logins: "Tentativas de login",
  bloqueios: "Bloqueios por limite",
  senhas: "Trocas de senha",
}

const ROTAS: Record<api.RotaBloqueio, string> = {
  login: "Login",
  lotes: "Registro de lotes",
}

const dataHora = (iso: string) => (
  <span className="whitespace-nowrap tabular-nums">
    {fmtData(new Date(iso))}{" "}
    <span className="text-ink-2">{fmtHora(new Date(iso))}</span>
  </span>
)

const n = (v: number) => v.toLocaleString("pt-BR")

/**
 * Eventos de segurança (issue #109), só para o administrador: logins aceitos e recusados, bloqueios pelo limite de
 * requisições e trocas de senha. A API conta em memória desde o último início, sem guardar senha, e manda o IP
 * mascarado. As redefinições de senha feitas pelo administrador também ficam na aba de ações, com quem fez.
 */
export default function EventosSeguranca() {
  const [tipo, setTipo] = useState<TipoEvento>("todos")
  const [versao, setVersao] = useState(0)
  const [r, setR] = useState<{
    dados: api.SegurancaDTO | null
    carregando: boolean
    erro: boolean
  }>({ dados: null, carregando: true, erro: false })
  const [aviso, setAviso] = useState("")

  useEffect(() => {
    let vivo = true
    setR((x) => ({ ...x, carregando: true, erro: false }))
    api.buscarEventosSeguranca().then(
      (dados) => vivo && setR({ dados, carregando: false, erro: false }),
      () => vivo && setR({ dados: null, carregando: false, erro: true }),
    )
    return () => {
      vivo = false
    }
  }, [versao])

  const exportar = () => {
    if (!r.dados) return
    setAviso(`Arquivo ${api.baixarJsonSeguranca(r.dados)} gerado.`)
  }

  const cols: Col<api.BloqueioDTO>[] = [
    {
      key: "ip",
      header: "IP (mascarado)",
      mobile: "title",
      render: (b) => <span className="font-semibold tabular-nums">{b.ip}</span>,
    },
    { key: "rota", header: "Onde", mobile: "subtitle", render: (b) => ROTAS[b.rota] },
    {
      key: "tentativas",
      header: "Tentativas bloqueadas",
      num: true,
      mobile: "value",
      render: (b) => <span className="tabular-nums">{n(b.tentativas)}</span>,
    },
    { key: "primeiro", header: "Primeiro bloqueio", render: (b) => dataHora(b.primeiro) },
    { key: "ultimo", header: "Último bloqueio", render: (b) => dataHora(b.ultimo) },
  ]

  const mostra = (t: TipoEvento) => tipo === "todos" || tipo === t
  const d = r.dados

  return (
    <Card as="section" className="overflow-hidden">
      <FilterBar onClear={tipo !== "todos" ? () => setTipo("todos") : undefined}>
        <Field id="seguranca-tipo" label="Eventos" className="sm:w-60">
          <Select
            id="seguranca-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoEvento)}
          >
            {(Object.keys(TIPOS) as TipoEvento[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            variant="secondary"
            icon={<IconRefresh size={18} />}
            onClick={() => setVersao((v) => v + 1)}
          >
            Atualizar
          </Button>
          <Button
            variant="secondary"
            icon={<IconDownload size={18} />}
            disabled={!d}
            onClick={exportar}
          >
            Exportar JSON
          </Button>
        </div>
      </FilterBar>

      {r.carregando ? (
        <LoadingBlock rows={4} label="Carregando eventos de segurança…" />
      ) : r.erro || !d ? (
        <ErrorState
          title="Não foi possível carregar os eventos de segurança"
          onRetry={() => setVersao((v) => v + 1)}
        />
      ) : (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <p className="text-[15px] text-ink-2">
            Contados desde {fmtData(new Date(d.desde))} às {fmtHora(new Date(d.desde))}, quando a API foi
            iniciada pela última vez. Os números zeram a cada reinício. Nenhuma senha é guardada, e o IP aparece
            mascarado.
          </p>
          {aviso && (
            <p role="status" className="text-[15px] font-medium text-ink">
              {aviso}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mostra("logins") && (
              <>
                <KpiCard label="Logins aceitos" value={n(d.loginsAceitos)} />
                <KpiCard
                  label="Logins recusados"
                  value={n(d.loginsRecusados)}
                  footer="Usuário inexistente, senha errada ou acesso desativado."
                />
              </>
            )}
            {mostra("bloqueios") && (
              <KpiCard
                label="Bloqueios por limite"
                value={n(d.bloqueiosLogin + d.bloqueiosLotes)}
                footer={`Login: ${n(d.bloqueiosLogin)} · Registro de lotes: ${n(d.bloqueiosLotes)}`}
              />
            )}
            {mostra("senhas") && (
              <>
                <KpiCard label="Senhas trocadas pelo próprio usuário" value={n(d.senhasTrocadas)} />
                <KpiCard
                  label="Senhas redefinidas pelo administrador"
                  value={n(d.senhasRedefinidas)}
                  footer="Quem redefiniu aparece na aba Ações nas contas."
                />
              </>
            )}
          </div>

          {mostra("bloqueios") &&
            (d.bloqueios.length === 0 ? (
              <EmptyState
                icon={<IconLock size={28} />}
                title="Nenhum bloqueio por limite"
                description="Quando alguém passar do limite de tentativas de login ou de registros de lote por minuto, o IP aparece aqui."
              />
            ) : (
              <DataTable
                rows={d.bloqueios}
                cols={cols}
                rowKey={(b) => `${b.rota}|${b.ip}`}
                caption="Bloqueios por limite de requisições"
                minWidth={760}
              />
            ))}
        </div>
      )}
    </Card>
  )
}
