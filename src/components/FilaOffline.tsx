import { useState } from 'react'
import { Banner, Button, Card, Modal, cx } from './ui'
import { IconAlertTriangle, IconClock, IconCloudOff, IconInbox, IconRefresh, IconTrash } from './icons'
import { esperadoDe, fmtDataHora, fmtL, fmtNum } from '../domain'
import { navigate } from '../router'
import { useApp } from '../store'
import type { LotePendente } from '../services'
import { textoEspera, useEsperaLimite } from './LimiteRequisicoes'

/*
 * O que o operador vê da fila de lotes sem conexão:
 * - IndicadorConexao: no cabeçalho, em todas as telas (sem conexão / enviando / N aguardando / N recusados).
 * - AvisoOffline: faixa no topo do conteúdo quando o site abriu com os dados guardados.
 * - ResultadoPendenteCard: no lugar do resultado, quando o lote acabou de ficar guardado.
 * - PainelPendentes: lista dos lotes guardados, com "Enviar agora", "Tentar de novo" e "Descartar".
 */

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`)

function irParaPendentes() {
  navigate('/registro')
  // Espera a tela montar para rolar até a lista.
  window.setTimeout(() => {
    const el = document.getElementById('pendentes')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el?.focus({ preventScroll: true })
  }, 50)
}

export function IndicadorConexao() {
  const { pendentes, conectado, modoOffline, sincronizando } = useApp()
  const espera = useEsperaLimite('lotes')
  const esperando = pendentes.filter((p) => p.estado === 'pendente').length
  const recusados = pendentes.length - esperando
  const offline = !conectado || modoOffline

  if (!offline && !esperando && !recusados && !sincronizando) return null

  let texto: string
  let tom: 'warn' | 'crit' | 'info'
  if (recusados && !esperando) {
    texto = plural(recusados, 'lote recusado', 'lotes recusados')
    tom = 'crit'
  } else if (sincronizando && esperando) {
    texto = `Enviando ${plural(esperando, 'lote', 'lotes')}…`
    tom = 'info'
  } else if (espera > 0 && esperando) {
    // Sem contador: o indicador é aria-live e anunciaria a cada segundo.
    texto = `Limite por minuto · ${plural(esperando, 'lote aguardando', 'lotes aguardando')}`
    tom = 'warn'
  } else if (offline) {
    texto = esperando ? `Sem conexão · ${plural(esperando, 'lote guardado', 'lotes guardados')}` : 'Sem conexão'
    tom = 'warn'
  } else {
    texto = plural(esperando, 'lote aguardando envio', 'lotes aguardando envio')
    tom = 'warn'
  }

  const Icone = offline ? IconCloudOff : tom === 'crit' ? IconAlertTriangle : sincronizando ? IconRefresh : IconClock
  return (
    <button
      type="button"
      onClick={irParaPendentes}
      aria-live="polite"
      data-testid="indicador-conexao"
      className={cx(
        'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold sm:gap-2',
        tom === 'warn' && 'bg-warn-bg text-warn',
        tom === 'crit' && 'bg-crit-bg text-crit',
        tom === 'info' && 'bg-brand-soft text-brand',
      )}
    >
      <Icone size={18} strokeWidth={2.2} className={cx('shrink-0', sincronizando && !offline && 'animate-spin')} />
      {/* No celular só o número; o texto completo fica para leitores de tela. */}
      <span className="sr-only sm:not-sr-only">{texto}</span>
      {(esperando || recusados) > 0 && (
        <span aria-hidden="true" className="tabular-nums sm:hidden">
          {esperando || recusados}
        </span>
      )}
    </button>
  )
}

export function AvisoOffline() {
  const { modoOffline, enviarPendentes, sincronizando } = useApp()
  if (!modoOffline) return null
  return (
    <div className="mb-6">
      <Banner tone="warn" title="Sem conexão com o servidor">
        <p>
          Você pode continuar registrando lotes: eles ficam guardados neste aparelho e são enviados sozinhos quando a conexão voltar. Os
          números na tela são da última vez que o site falou com o servidor.
        </p>
        <Button variant="text" size="sm" className="-ml-2 mt-1" icon={<IconRefresh size={18} />} loading={sincronizando} onClick={() => void enviarPendentes()}>
          Tentar conectar agora
        </Button>
      </Banner>
    </div>
  )
}

/** Mostrado logo depois do registro quando o lote ficou na fila. */
export function ResultadoPendenteCard({ pendente, onNovo }: { pendente: LotePendente; onNovo: () => void }) {
  const { processos, nomeProcesso } = useApp()
  const espera = useEsperaLimite('lotes')
  const processo = processos.find((p) => p.id === String(pendente.processoId))
  const esperado = processo ? esperadoDe(processo, pendente.pecas) : null
  return (
    <Card className="rise h-full overflow-hidden">
      <div tabIndex={-1} className="bg-warn-bg px-4 py-6 text-warn outline-none sm:px-8 sm:py-8" aria-live="polite" data-testid="resultado-pendente">
        <div className="flex items-center gap-3">
          {espera > 0 ? <IconClock size={28} strokeWidth={2.2} className="shrink-0" /> : <IconCloudOff size={28} strokeWidth={2.2} className="shrink-0" />}
          <h2 className="text-[22px] font-semibold">Lote guardado neste aparelho</h2>
        </div>
        {espera > 0 ? (
          <p className="mt-4 max-w-prose text-base font-medium">
            O servidor pediu uma pausa: foram muitos lotes em pouco tempo. O lote não se perdeu e será enviado sozinho em{' '}
            <span className="tabular-nums">{textoEspera(espera)}</span>, sem duplicar.
          </p>
        ) : (
          <p className="mt-4 max-w-prose text-base font-medium">
            A conexão com o servidor falhou, mas o lote não se perdeu. Ele será enviado sozinho quando a conexão voltar, sem duplicar. Pode
            continuar registrando os próximos.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Dado label="Processo" value={nomeProcesso(String(pendente.processoId))} />
          <Dado label="Peças" value={fmtNum(pendente.pecas)} />
          <Dado label="Litros utilizados" value={fmtL(pendente.litros)} />
          <Dado label="Esperado pela meta (prévia)" value={esperado ? fmtL(esperado) : '—'} />
          <Dado label="Registrado neste aparelho" value={fmtDataHora(new Date(pendente.criadoEm))} />
        </dl>
        <p className="text-[15px] text-ink-2">
          O desvio oficial e o status aparecem quando o servidor receber o lote. No histórico, o lote fica com a hora em que chegou ao servidor.
        </p>
        <div className="flex flex-col gap-2 border-t border-line pt-6 sm:flex-row">
          <Button size="lg" onClick={onNovo} className="sm:flex-1">
            Registrar novo lote
          </Button>
          <Button size="lg" variant="secondary" icon={<IconInbox size={20} />} onClick={irParaPendentes} className="sm:flex-1">
            Ver lotes guardados
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Dado({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

/** Lista dos lotes guardados no aparelho, na Registro de lotes. */
export function PainelPendentes() {
  const { pendentes, pendentesDeOutros, sincronizando, conectado, modoOffline, enviarPendentes, tentarDeNovo, descartarPendente, nomeProcesso } = useApp()
  const [descartar, setDescartar] = useState<LotePendente | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const espera = useEsperaLimite('lotes')

  if (!pendentes.length && !pendentesDeOutros) return null
  const esperando = pendentes.filter((p) => p.estado === 'pendente').length
  const offline = !conectado || modoOffline

  return (
    <Card as="section" className="p-4 sm:p-8">
      <div id="pendentes" tabIndex={-1} aria-labelledby="pendentes-titulo" className="scroll-mt-40 outline-none" data-testid="painel-pendentes">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-warn-bg text-warn">
              <IconInbox size={22} />
            </span>
            <div>
              <h2 id="pendentes-titulo" className="text-[22px] font-semibold">
                Guardados neste aparelho
              </h2>
              <p className="text-[15px] text-ink-2" aria-live="polite">
                {pendentes.length === 0
                  ? 'Nenhum lote seu esperando envio.'
                  : sincronizando
                    ? 'Enviando ao servidor…'
                    : esperando && espera > 0
                      ? `${plural(esperando, 'lote aguardando', 'lotes aguardando')} envio. Limite de lotes por minuto atingido: o envio volta sozinho em ${textoEspera(espera)}.`
                    : esperando
                      ? `${plural(esperando, 'lote aguardando', 'lotes aguardando')} envio${offline ? ' · sem conexão agora' : ''}. O envio é automático.`
                      : 'Os lotes abaixo foram recusados pelo servidor.'}
              </p>
            </div>
          </div>
          {esperando > 0 && (
            <Button variant="secondary" icon={<IconRefresh size={20} />} loading={sincronizando} disabled={espera > 0} onClick={() => void enviarPendentes()}>
              {espera > 0 ? `Aguarde ${textoEspera(espera)}` : 'Enviar agora'}
            </Button>
          )}
        </div>

        {pendentes.length > 0 && (
          <ul className="mt-6 flex flex-col divide-y divide-line border-y border-line">
            {pendentes.map((p) => (
              <li key={p.chave} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4" data-testid="pendente">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {nomeProcesso(String(p.processoId))} · {fmtNum(p.pecas)} peças · {fmtL(p.litros)}
                  </p>
                  <p className="text-[14px] text-ink-2">
                    Registrado em {fmtDataHora(new Date(p.criadoEm))}
                    {p.tentativas > 0 && ` · ${plural(p.tentativas, 'tentativa', 'tentativas')}`}
                  </p>
                  {p.estado === 'recusado' && p.ultimoErro && <p className="mt-1 text-[14px] font-medium text-crit">Recusado: {p.ultimoErro}</p>}
                </div>
                {p.estado === 'pendente' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-bg px-3 py-1 text-[13px] font-semibold text-warn">
                    <IconClock size={14} /> Aguardando envio
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-crit-bg px-3 py-1 text-[13px] font-semibold text-crit">
                      <IconAlertTriangle size={14} /> Recusado
                    </span>
                    <Button
                      size="sm"
                      variant="text"
                      icon={<IconRefresh size={18} />}
                      disabled={ocupado || espera > 0}
                      onClick={async () => {
                        setOcupado(true)
                        await tentarDeNovo(p.chave)
                        setOcupado(false)
                      }}
                    >
                      Tentar de novo
                    </Button>
                    <Button size="sm" variant="text" icon={<IconTrash size={18} />} onClick={() => setDescartar(p)}>
                      Descartar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-[14px] text-ink-2">
          Os lotes ficam guardados mesmo se o navegador for fechado. Não use “limpar dados de navegação” enquanto houver lote aqui.
          {pendentesDeOutros > 0 &&
            ` Há também ${plural(pendentesDeOutros, 'lote de outra pessoa', 'lotes de outras pessoas')} neste aparelho; ${pendentesDeOutros === 1 ? 'ele será enviado' : 'serão enviados'} quando ela entrar.`}
        </p>
      </div>

      <Modal
        open={!!descartar}
        onClose={() => !ocupado && setDescartar(null)}
        size="sm"
        title="Descartar este lote?"
        description="Ele será apagado deste aparelho e não irá para o servidor. Se ainda quiser registrá-lo, faça um novo registro com os dados corretos."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDescartar(null)} disabled={ocupado}>
              Manter
            </Button>
            <Button
              loading={ocupado}
              data-autofocus
              onClick={async () => {
                if (!descartar) return
                setOcupado(true)
                await descartarPendente(descartar.chave)
                setOcupado(false)
                setDescartar(null)
              }}
            >
              Descartar lote
            </Button>
          </>
        }
      >
        {descartar && (
          <p className="text-[15px] text-ink">
            {nomeProcesso(String(descartar.processoId))} · {fmtNum(descartar.pecas)} peças · {fmtL(descartar.litros)}
          </p>
        )}
      </Modal>
    </Card>
  )
}
