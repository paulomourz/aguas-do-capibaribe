import { useEffect, useState, type FormEvent } from 'react'
import {
  Banner,
  Button,
  Card,
  ChoiceGroup,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  StatePreview,
  TextInput,
} from '../components/ui'
import { IconEdit, IconPlus, IconTarget } from '../components/icons'
import { fmtNum, unidadeCurta, unidadeLabel, type Processo, type Unidade } from '../domain'
import { navigate } from '../router'
import { errosDaApi, useApp, useEstadoTela } from '../store'

type Erros = Partial<Record<'nome' | 'unidade' | 'meta', string>>

/** G2 lista de processos; G3 cadastro/edição em modal (tela cheia no mobile). */
export default function Processos({ modal, editarId, destaque }: { modal?: 'novo' | 'editar'; editarId?: string; destaque?: string }) {
  const { processos } = useApp()
  const [estado, setEstado] = useEstadoTela()
  const lista = estado === 'vazio' ? [] : processos
  const editando = modal === 'editar' ? processos.find((p) => p.id === editarId) : undefined

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <StatePreview value={estado} onChange={setEstado} />
      <PageHeader
        title="Processos e metas"
        description="A meta de cada processo é a referência para calcular o desvio dos lotes."
        actions={
          <>
            <Button icon={<IconPlus size={20} />} onClick={() => navigate('/processos/novo')}>
              Novo processo
            </Button>
          </>
        }
      />

      <Card as="section" className="overflow-hidden">
        {estado === 'carregando' ? (
          <LoadingBlock rows={3} label="Carregando processos…" />
        ) : estado === 'erro' ? (
          <ErrorState title="Não foi possível carregar os processos" onRetry={() => setEstado('dados')} />
        ) : lista.length === 0 ? (
          <EmptyState
            icon={<IconTarget size={28} />}
            title="Nenhum processo cadastrado"
            description="Cadastre o primeiro processo e sua meta para que os operadores possam registrar lotes."
            action={
              <Button icon={<IconPlus size={20} />} onClick={() => navigate('/processos/novo')}>
                Novo processo
              </Button>
            }
          />
        ) : (
          <DataTable<Processo>
            rows={lista}
            rowKey={(p) => p.id}
            caption="Processos e metas cadastrados"
            minWidth={600}
            highlight={(p) => p.id === destaque || p.id === editarId}
            cols={[
              { key: 'n', header: 'Processo', mobile: 'title', render: (p) => <span className="font-semibold">{p.nome}</span> },
              {
                key: 'm',
                header: 'Valor da meta',
                num: true,
                mobile: 'value',
                render: (p) => (
                  <span className="font-semibold">
                    {fmtNum(p.meta)} <span className="font-normal text-ink-2" aria-hidden="true">{unidadeCurta[p.unidade]}</span>
                    <span className="sr-only">{unidadeLabel[p.unidade]}</span>
                  </span>
                ),
              },
              {
                key: 'a',
                header: 'Ações',
                mobile: 'badge',
                className: 'w-px whitespace-nowrap',
                render: (p) => (
                  <Button variant="text" size="sm" icon={<IconEdit size={18} />} onClick={() => navigate(`/processos/${p.id}/editar`)}>
                    Editar<span className="sr-only"> {p.nome}</span>
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      {modal && <ProcessoForm key={editarId ?? 'novo'} processo={editando} onClose={() => navigate('/processos')} />}
    </div>
  )
}

function ProcessoForm({ processo, onClose }: { processo?: Processo; onClose: () => void }) {
  const { processos, salvarProcesso, notificar } = useApp()
  const [nome, setNome] = useState(processo?.nome ?? '')
  const [unidade, setUnidade] = useState<Unidade | ''>(processo?.unidade ?? '')
  const [meta, setMeta] = useState(processo ? String(processo.meta) : '')
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)
  const [aberto, setAberto] = useState(false)
  useEffect(() => setAberto(true), [])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const novo: Erros = {}
    const n = nome.trim()
    if (!n) novo.nome = 'Informe o nome do processo.'
    else if (processos.some((p) => p.nome.toLowerCase() === n.toLowerCase() && p.id !== processo?.id)) novo.nome = 'Já existe um processo com esse nome.'
    if (!unidade) novo.unidade = 'Escolha a unidade da meta.'
    const v = Number(meta.replace(',', '.'))
    if (meta.trim() === '') novo.meta = 'Informe o valor da meta.'
    else if (Number.isNaN(v)) novo.meta = 'Use apenas números no valor da meta.'
    else if (v <= 0) novo.meta = 'A meta deve ser maior que zero. Valores zero ou negativos não são aceitos.'
    setErros(novo)
    const primeiro = Object.keys(novo)[0]
    if (primeiro) {
      const el = primeiro === 'unidade' ? document.querySelector<HTMLInputElement>('input[name="unidade"]') : document.getElementById(primeiro === 'nome' ? 'p-nome' : 'p-meta')
      el?.focus()
      return
    }
    setSalvando(true)
    try {
      const salvo = await salvarProcesso({ id: processo?.id, nome: n, unidade: unidade as Unidade, meta: v })
      notificar(processo ? `Meta de ${n} atualizada para ${fmtNum(v)} ${unidadeLabel[unidade as Unidade]}.` : `Processo ${n} cadastrado.`)
      navigate(`/processos?salvo=${salvo.id}`)
    } catch (err) {
      const { mensagem, campos } = errosDaApi(err)
      setErros(campos)
      if (!Object.keys(campos).length) notificar(mensagem, 'erro')
      setSalvando(false)
    }
  }

  const temErro = Object.keys(erros).length > 0

  return (
    <Modal
      open={aberto}
      onClose={onClose}
      fullscreenMobile
      title={processo ? `Editar ${processo.nome}` : 'Novo processo'}
      description={processo ? 'A nova meta vale para os próximos lotes registrados.' : 'O processo ficará disponível no registro de lotes.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-processo" loading={salvando}>
            {salvando ? 'Salvando…' : processo ? 'Salvar alterações' : 'Cadastrar processo'}
          </Button>
        </>
      }
    >
      <form id="form-processo" onSubmit={salvar} noValidate className="flex flex-col gap-6">
        {temErro && <Banner tone="crit">Corrija os campos destacados para salvar.</Banner>}
        <Field id="p-nome" label="Nome do processo" error={erros.nome}>
          <TextInput
            id="p-nome"
            value={nome}
            invalid={!!erros.nome}
            onChange={(e) => {
              setNome(e.target.value)
              setErros((x) => ({ ...x, nome: undefined }))
            }}
          />
        </Field>
        <ChoiceGroup<Unidade>
          legend="Unidade da meta"
          name="unidade"
          value={unidade}
          error={erros.unidade}
          onChange={(u) => {
            setUnidade(u)
            setErros((x) => ({ ...x, unidade: undefined }))
          }}
          options={[
            { value: 'lote', label: 'Litros por lote', hint: 'Mesma meta para o lote inteiro' },
            { value: 'peca', label: 'Litros por peça', hint: 'Meta multiplicada pelas peças' },
          ]}
        />
        <Field
          id="p-meta"
          label="Valor da meta"
          error={erros.meta}
          hint={unidade === 'peca' ? 'Litros esperados para cada peça do lote.' : unidade === 'lote' ? 'Litros esperados para o lote inteiro.' : 'Escolha a unidade da meta acima.'}
        >
          <TextInput
            id="p-meta"
            type="number"
            inputMode="decimal"
            value={meta}
            invalid={!!erros.meta}
            suffix={unidade ? unidadeCurta[unidade] : 'litros'}
            onChange={(e) => {
              setMeta(e.target.value)
              setErros((x) => ({ ...x, meta: undefined }))
            }}
            className="tabular-nums"
          />
        </Field>
      </form>
    </Modal>
  )
}
