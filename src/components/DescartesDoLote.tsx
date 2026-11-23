import { useEffect, useState, type FormEvent } from 'react'
import { Banner, Button, EmptyState, ErrorState, Field, LoadingBlock, Modal, TextInput } from './ui'
import { IconDroplet, IconPlus } from './icons'
import {
  FORM_DESCARTE_VAZIO,
  fmtData,
  fmtHora,
  phForaDoLancamento,
  type ErrosDescarte,
  type FormDescarte,
} from '../domain'
import { listarDescartes, salvarDescarte } from '../services/descartes'
import type { DescarteDTO, Id } from '../services/tipos'
import { useApp } from '../store'

const dec = (n: number, casas = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })

/** Uma linha da lista: data, volume, pH, turbidez e reaproveitamento (issue #202). */
export function LinhaDescarte({ d }: Readonly<{ d: DescarteDTO }>) {
  const quando = new Date(d.data)
  return (
    <li className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0">
      <span className="text-[13px] text-ink-2 tabular-nums">
        {fmtData(quando)} às {fmtHora(quando)}
      </span>
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-[15px] tabular-nums text-ink">
        <span>
          <span className="text-ink-2">Volume</span> {dec(d.volumeLitros)} L
        </span>
        <span>
          <span className="text-ink-2">pH</span> {dec(d.ph)}
          {phForaDoLancamento(d.ph) && <span className="ml-1 font-semibold text-crit">(fora de 5 a 9)</span>}
        </span>
        <span>
          <span className="text-ink-2">Turbidez</span> {dec(d.turbidezNtu)} NTU
        </span>
        <span>
          <span className="text-ink-2">Reaproveitado</span> {dec(d.reutilizadoPercentual)}%
        </span>
      </span>
    </li>
  )
}

type Estado = 'carregando' | 'erro' | 'pronto'

/**
 * Descarte de efluentes de um lote (issue #202): lista os descartes e registra um novo. O descarte não pode ser
 * alterado nem excluído depois (auditoria ambiental), então o formulário avisa isso antes de salvar.
 */
export default function DescartesDoLote({ loteId, titulo, onClose }: Readonly<{ loteId: Id; titulo: string; onClose: () => void }>) {
  const { notificar } = useApp()
  const [estado, setEstado] = useState<Estado>('carregando')
  const [lista, setLista] = useState<DescarteDTO[]>([])
  const [registrando, setRegistrando] = useState(false)
  const [form, setForm] = useState<FormDescarte>(FORM_DESCARTE_VAZIO)
  const [erros, setErros] = useState<ErrosDescarte>({})
  const [salvando, setSalvando] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let vivo = true
    setEstado('carregando')
    listarDescartes(loteId)
      .then((d) => {
        if (!vivo) return
        setLista(d)
        setEstado('pronto')
      })
      .catch(() => vivo && setEstado('erro'))
    return () => {
      vivo = false
    }
  }, [loteId, tentativa])

  const mudar = (campo: keyof FormDescarte, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const r = await salvarDescarte(loteId, form)
    setSalvando(false)
    if (r.ok) {
      setLista((l) => [r.gravado, ...l])
      setForm(FORM_DESCARTE_VAZIO)
      setRegistrando(false)
      notificar('Descarte registrado.')
      return
    }
    setErros(r.erros)
    if (r.mensagem) notificar(r.mensagem, 'erro')
  }

  const temErro = Object.values(erros).some(Boolean)
  const campo = (id: keyof FormDescarte, label: string, hint: string, sufixo: string, opcional = false) => (
    <Field id={`descarte-${id}`} label={label} hint={hint} error={erros[id]} optional={opcional}>
      <TextInput
        id={`descarte-${id}`}
        inputMode="decimal"
        autoComplete="off"
        suffix={sufixo}
        invalid={!!erros[id]}
        value={form[id]}
        onChange={(ev) => mudar(id, ev.target.value)}
      />
    </Field>
  )

  let conteudo
  if (registrando) {
    conteudo = (
      <form id="form-descarte" noValidate onSubmit={salvar} className="flex flex-col gap-5">
        {temErro && <Banner tone="crit">Corrija os campos destacados para salvar.</Banner>}
        {campo('volumeLitros', 'Volume descartado', 'Litros de efluente deste descarte.', 'litros')}
        {campo('ph', 'pH', 'De 0 a 14. Para lançamento, a CONAMA 430 pede de 5 a 9.', 'pH')}
        {campo('turbidezNtu', 'Turbidez', 'Em NTU, do medidor de turbidez.', 'NTU')}
        {campo('reutilizadoPercentual', 'Água reaproveitada', 'De 0 a 100%. Vazio conta como 0%.', '%', true)}
        <p className="text-[13px] text-ink-2">Depois de salvo, o descarte não pode ser alterado nem excluído.</p>
      </form>
    )
  } else if (estado === 'carregando') {
    conteudo = <LoadingBlock rows={3} label="Carregando descartes…" />
  } else if (estado === 'erro') {
    conteudo = <ErrorState title="Não foi possível carregar os descartes" onRetry={() => setTentativa((t) => t + 1)} />
  } else if (lista.length === 0) {
    conteudo = (
      <EmptyState
        icon={<IconDroplet size={28} />}
        title="Nenhum descarte registrado"
        description="Registre o volume, o pH, a turbidez e quanto da água foi reaproveitado."
      />
    )
  } else {
    conteudo = (
      <ul aria-label="Descartes do lote">
        {lista.map((d) => (
          <LinhaDescarte key={d.id} d={d} />
        ))}
      </ul>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Descarte de efluentes"
      description={titulo}
      footer={
        registrando ? (
          <>
            <Button variant="secondary" onClick={() => setRegistrando(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" form="form-descarte" loading={salvando} data-autofocus>
              Salvar descarte
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
            {estado === 'pronto' && (
              <Button icon={<IconPlus size={18} />} onClick={() => setRegistrando(true)}>
                Registrar descarte
              </Button>
            )}
          </>
        )
      }
    >
      {conteudo}
    </Modal>
  )
}
