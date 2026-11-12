import { useRef, useState, type FormEvent, type RefObject } from 'react'
import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  StatePreview,
  Select,
  Skeleton,
  StatusBadge,
  TextInput,
  cx,
  statusMeta,
} from '../components/ui'
import { IconArrowLeft, IconClipboard, IconClock, IconDroplet, IconHistory, IconPlus } from '../components/icons'
import { esperadoDe, termoDe, fmtDataHora, fmtL, fmtNum, fmtPct, unidadeCurta, unidadeLabel, type Lote } from '../domain'
import { Link, navigate } from '../router'
import { errosDaApi, useApp, useEstadoTela } from '../store'
import { PainelPendentes, ResultadoPendenteCard } from '../components/FilaOffline'
import DicaGlossario from '../components/DicaGlossario'
import { AvisoLimite, textoEspera, useEsperaLimite } from '../components/LimiteRequisicoes'
import type { LotePendente } from '../services'

type Erros = Partial<Record<'processo' | 'pecas' | 'litros', string>>

/* ---------- O1 Registro de lote (com O2 embutido após o envio) ---------- */

export default function RegistroLote() {
  const { processos, registrarLote, conectado, modoOffline, enviadosAgora } = useApp()
  const [estado, setEstado] = useEstadoTela()
  const [processoId, setProcessoId] = useState('')
  const [pecas, setPecas] = useState('')
  const [litros, setLitros] = useState('')
  const [erros, setErros] = useState<Erros>({})
  const [confirmar, setConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  // 429: passou de 60 lotes por minuto. Novos registros esperam o Retry-After; o que já entrou fica na fila.
  const espera = useEsperaLimite('lotes')
  const [resultado, setResultado] = useState<Lote | null>(null)
  /** Lote que ficou guardado no aparelho; quando a fila o enviar, vira `enviadosAgora[chave]`. */
  const [guardado, setGuardado] = useState<LotePendente | null>(null)
  const loteDoGuardado = guardado ? enviadosAgora[guardado.chave] : undefined
  const temResultado = !!resultado || !!guardado
  const resultadoRef = useRef<HTMLDivElement>(null)

  const processo = processos.find((p) => p.id === processoId)
  const nPecas = Number(pecas)
  const nLitros = Number(String(litros).replace(',', '.'))
  const esperadoPrevio = processo && nPecas > 0 ? esperadoDe(processo, nPecas) : null

  function validar(e: FormEvent) {
    e.preventDefault()
    if (espera > 0) return
    const novo: Erros = {}
    if (!processo) novo.processo = 'Selecione o processo do lote.'
    if (pecas.trim() === '') novo.pecas = 'Informe a quantidade de peças.'
    else if (!(nPecas > 0) || !Number.isInteger(nPecas)) novo.pecas = 'A quantidade de peças deve ser um número inteiro maior que zero.'
    if (String(litros).trim() === '') novo.litros = 'Informe os litros utilizados.'
    else if (!(nLitros > 0)) novo.litros = 'Os litros utilizados devem ser maiores que zero.'
    setErros(novo)
    setFalha(null)
    const primeiro = Object.keys(novo)[0]
    if (primeiro) {
      document.getElementById(primeiro)?.focus()
      return
    }
    setConfirmar(true)
  }

  async function enviar() {
    setEnviando(true)
    try {
      // O esperado e o desvio vêm do servidor (calculados pelo banco).
      const r = await registrarLote({ processoId: processo!.id, pecas: nPecas, litros: Math.round(nLitros) })
      if (r.tipo === 'enviado') {
        setResultado(r.lote)
        setGuardado(null)
      } else {
        setResultado(null)
        setGuardado(r.pendente)
      }
      setPecas('')
      setLitros('')
      requestAnimationFrame(() => {
        resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        resultadoRef.current?.focus({ preventScroll: true })
      })
    } catch (err) {
      const { mensagem, campos } = errosDaApi(err, { processoId: 'processo' })
      setErros(campos)
      setFalha(Object.keys(campos).length ? null : mensagem)
    } finally {
      setEnviando(false)
      setConfirmar(false)
    }
  }

  function novoLote() {
    setResultado(null)
    setGuardado(null)
    requestAnimationFrame(() => document.getElementById('processo')?.focus())
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <StatePreview value={estado} onChange={setEstado} />
      <PageHeader
        title="Registro de lote"
        description="Informe o processo, as peças e os litros usados. O desvio em relação à meta aparece logo após o registro."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Formulário: no mobile/tablet some enquanto o resultado é exibido */}
        <Card as="section" className={cx('p-4 sm:p-8 lg:col-span-5', temResultado && 'hidden lg:block')}>
          {estado === 'carregando' ? (
            <div role="status" className="flex flex-col gap-6">
              <span className="sr-only">Carregando formulário…</span>
              <Skeleton className="h-6 w-40" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
              <Skeleton className="h-16 w-full" />
            </div>
          ) : estado === 'erro' ? (
            <ErrorState title="Não foi possível carregar o formulário" onRetry={() => setEstado('dados')} />
          ) : estado === 'vazio' || processos.length === 0 ? (
            <EmptyState
              icon={<IconClipboard size={28} />}
              title="Nenhum processo disponível"
              description="Ainda não há processos com meta cadastrada. Peça ao gestor para cadastrar os processos da lavanderia."
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">
                  <IconClipboard size={22} />
                </span>
                <h2 className="text-[22px] font-semibold">Novo lote</h2>
              </div>
              <hr className="my-6 border-line" />

              <form onSubmit={validar} noValidate className="flex flex-col gap-6">
                {espera > 0 && (
                  <AvisoLimite segundos={espera} titulo="Muitos lotes em pouco tempo">
                    O sistema aceita até 60 lotes por minuto para cada usuário. Os dados preenchidos ficam no formulário.
                  </AvisoLimite>
                )}
                {falha && espera <= 0 && (
                  <Banner tone="crit" title="Não foi possível registrar o lote">
                    {falha} Os dados preenchidos foram mantidos.
                  </Banner>
                )}

                <Field
                  id="processo"
                  label="Processo"
                  error={erros.processo}
                  hint={
                    processo ? (
                      processo.unidade === 'peca' ? (
                        <>
                          Meta por peça: <strong className="font-semibold text-ink">{fmtNum(processo.meta)} litros por peça</strong>. O consumo esperado é calculado pela quantidade de peças.
                        </>
                      ) : (
                        <>
                          Meta por lote: <strong className="font-semibold text-ink">{fmtNum(processo.meta)} litros por lote</strong>, independente da quantidade de peças.
                        </>
                      )
                    ) : (
                      'Escolha o processo executado na máquina.'
                    )
                  }
                >
                  <Select
                    id="processo"
                    value={processoId}
                    invalid={!!erros.processo}
                    onChange={(e) => {
                      setProcessoId(e.target.value)
                      setErros((x) => ({ ...x, processo: undefined }))
                    }}
                  >
                    <option value="">Selecione o processo</option>
                    {processos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — {fmtNum(p.meta)} {unidadeCurta[p.unidade]}
                      </option>
                    ))}
                  </Select>
                </Field>
                {processo && termoDe(processo.nome) && (
                  <p className="-mt-3 flex items-start gap-1 text-[13px] leading-snug text-ink-2">
                    <DicaGlossario processo={processo.nome} className="-ml-1.5 -mt-1.5 shrink-0" />
                    <span>{termoDe(processo.nome)!.definicao}</span>
                  </p>
                )}

                <div className="grid grid-cols-2 items-start gap-4 sm:gap-6">
                  <Field id="pecas" label="Peças" error={erros.pecas} hint="Quantidade total de peças do lote.">
                    <TextInput
                      id="pecas"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={pecas}
                      invalid={!!erros.pecas}
                      suffix="peças"
                      onChange={(e) => {
                        setPecas(e.target.value)
                        setErros((x) => ({ ...x, pecas: undefined }))
                      }}
                      className="text-lg tabular-nums"
                    />
                  </Field>
                  <Field id="litros" label="Litros utilizados" error={erros.litros} hint="Total de litros usados no lote.">
                    <TextInput
                      id="litros"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      value={litros}
                      invalid={!!erros.litros}
                      suffix="litros"
                      onChange={(e) => {
                        setLitros(e.target.value)
                        setErros((x) => ({ ...x, litros: undefined }))
                      }}
                      className="text-lg tabular-nums"
                    />
                  </Field>
                </div>

                <dl className="flex items-baseline justify-between gap-4 border-t border-line pt-4 text-[15px]" aria-live="polite">
                  <dt className="font-semibold text-ink">Consumo esperado pela meta</dt>
                  <dd className="text-lg font-semibold tabular-nums text-ink">{esperadoPrevio ? fmtL(esperadoPrevio) : '—'}</dd>
                </dl>

                <Button type="submit" size="lg" full loading={enviando} disabled={espera > 0} icon={<IconDroplet size={22} />} className="min-h-16 text-lg">
                  {espera > 0 ? `Aguarde ${textoEspera(espera)}` : 'Registrar lote'}
                </Button>
              </form>
            </>
          )}
        </Card>

        <section aria-label="Resultado do registro" className="lg:col-span-7">
          {resultado || loteDoGuardado ? (
            <ResultadoCard lote={(resultado ?? loteDoGuardado)!} refEl={resultadoRef} onNovo={novoLote} />
          ) : guardado ? (
            <div ref={resultadoRef} tabIndex={-1} className="h-full outline-none">
              <ResultadoPendenteCard pendente={guardado} onNovo={novoLote} />
            </div>
          ) : (
            <Card className="hidden h-full min-h-[360px] flex-col p-6 sm:p-8 lg:flex">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">
                  <IconDroplet size={22} />
                </span>
                <h2 className="text-[22px] font-semibold text-ink">O resultado aparece aqui</h2>
              </div>
              <hr className="my-6 border-line" />
              <p className="max-w-md text-base text-ink-2">
                Depois de registrar, você verá o desvio em relação à meta, o consumo esperado e o real.
              </p>
            </Card>
          )}
        </section>
      </div>

      <PainelPendentes />

      <Modal
        open={confirmar}
        onClose={() => !enviando && setConfirmar(false)}
        size="sm"
        title="Confirmar registro do lote"
        description={
          !conectado || modoOffline
            ? 'Depois de registrado, o lote não pode ser editado. Sem conexão agora: o lote fica guardado neste aparelho e é enviado sozinho quando a conexão voltar.'
            : 'Depois de registrado, o lote não pode ser editado.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmar(false)} disabled={enviando}>
              Voltar e corrigir
            </Button>
            <Button onClick={enviar} loading={enviando} disabled={espera > 0} data-autofocus>
              {enviando ? 'Registrando…' : 'Confirmar registro'}
            </Button>
          </>
        }
      >
        {processo && (
          <dl className="grid grid-cols-2 gap-4">
            <Item label="Processo" value={processo.nome} />
            <Item label="Unidade da meta" value={unidadeLabel[processo.unidade]} />
            <Item label="Peças" value={fmtNum(nPecas)} />
            <Item label="Litros utilizados" value={fmtL(Math.round(nLitros))} />
          </dl>
        )}
      </Modal>
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="text-base font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

/* ---------- Cartão de resultado (O2) ---------- */

const mensagens = {
  ok: 'Consumo dentro da meta do processo.',
  warn: 'Consumo acima da meta. Confira o processo antes do próximo lote.',
  crit: 'Consumo muito acima da meta. Avise o gestor da lavanderia.',
}

export function ResultadoCard({ lote, refEl, onNovo }: { lote: Lote; refEl?: RefObject<HTMLDivElement | null>; onNovo: () => void }) {
  const { nomeProcesso } = useApp()
  const st = lote.status
  const m = statusMeta[st]
  const max = Math.max(lote.esperado, lote.litros)
  const dif = lote.litros - lote.esperado
  return (
    <Card className="rise h-full scroll-mt-40 overflow-hidden">
      <div ref={refEl} tabIndex={-1} className={cx('px-4 py-6 outline-none sm:px-8 sm:py-8', m.bg)} aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={cx('text-base font-semibold', m.text)}>
            Lote <span className="tabular-nums">{lote.id}</span> registrado
          </h2>
          <StatusBadge status={st} size="lg" />
        </div>
        <p className={cx('mt-6 text-[15px] font-medium', m.text)}>Desvio em relação à meta</p>
        <p className={cx('font-display text-[64px] font-bold leading-none tracking-tight tabular-nums sm:text-[80px]', m.text)}>
          {fmtPct(lote.desvio)}
        </p>
        <p className={cx('mt-4 flex items-start gap-2 text-base font-medium', m.text)}>
          <m.Icon size={20} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          {mensagens[st]}
        </p>
      </div>

      <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Dado label="Consumo esperado" value={fmtL(lote.esperado)} grande />
          <Dado label="Consumo real" value={fmtL(lote.litros)} grande />
          <Dado label="Diferença" value={`${dif > 0 ? '+' : dif < 0 ? '−' : ''}${fmtL(Math.abs(dif))}`} grande />
          <Dado label="Processo" value={nomeProcesso(lote.processoId)} />
          <Dado label="Peças" value={fmtNum(lote.pecas)} />
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-[13px] text-ink-2">Data e hora</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-base font-semibold tabular-nums text-ink">
              <IconClock size={16} className="text-ink-2" />
              {fmtDataHora(lote.data)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2" aria-hidden="true">
          {[
            { label: 'Meta', v: lote.esperado, cls: 'border-[1.5px] border-link bg-meta' },
            { label: 'Real', v: lote.litros, cls: 'bg-brand' },
          ].map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-10 text-[13px] font-medium text-ink-2">{b.label}</span>
              <div className="h-4 flex-1 rounded-full bg-track">
                <div className={cx('h-full rounded-full', b.cls)} style={{ width: `${(b.v / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-6 sm:flex-row">
          <Button size="lg" icon={<IconPlus size={20} />} onClick={onNovo} className="sm:flex-1">
            Registrar novo lote
          </Button>
          <Button size="lg" variant="secondary" icon={<IconHistory size={20} />} onClick={() => navigate('/historico')} className="sm:flex-1">
            Ver histórico
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Dado({ label, value, grande }: { label: string; value: string; grande?: boolean }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className={cx('mt-0.5 font-semibold tabular-nums text-ink', grande ? 'font-display text-[22px]' : 'text-base')}>{value}</dd>
    </div>
  )
}

/* ---------- O2 Resultado do lote (frame separado) ---------- */

export function ResultadoLote({ id }: { id: string }) {
  const { lotes, carregando } = useApp()
  const lote = lotes.find((l) => l.id === id)
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Resultado do lote"
        back={
          <Link to="/registro" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-[15px] font-semibold text-link hover:underline">
            <IconArrowLeft size={18} /> Registro de lote
          </Link>
        }
      />
      {lote ? (
        <div className="mx-auto w-full max-w-[720px]">
          <ResultadoCard lote={lote} onNovo={() => navigate('/registro')} />
        </div>
      ) : (
        <Card>
          {carregando ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ErrorState title="Lote não encontrado" description="Este registro não existe ou não está disponível." />
          )}
        </Card>
      )}
    </div>
  )
}
