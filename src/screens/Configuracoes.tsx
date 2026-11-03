import { useState, type FormEvent, type ReactNode } from 'react'
import { Button, Card, Field, PageHeader, PasswordInput, TextInput } from '../components/ui'
import { IconLock, IconUsers } from '../components/icons'
import { perfilLabel } from '../domain'
import { errosDaApi, useApp } from '../store'

function Secao({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <Card as="section" className="p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>
            <h2 className="text-[20px] font-semibold text-ink">{title}</h2>
          </div>
          <p className="mt-3 text-[15px] text-ink-2">{description}</p>
        </div>
        <div className="lg:col-span-8">{children}</div>
      </div>
    </Card>
  )
}

type ErrosSenha = Partial<Record<'atual' | 'nova' | 'confirmacao', string>>

export default function Configuracoes() {
  const { usuario, atualizarUsuario, notificar } = useApp()
  const [nome, setNome] = useState(usuario?.nome ?? '')
  const [erroNome, setErroNome] = useState<string>()
  const [salvandoNome, setSalvandoNome] = useState(false)
  const [semAlteracao, setSemAlteracao] = useState(false)

  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erros, setErros] = useState<ErrosSenha>({})
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  if (!usuario) return null
  const nomeAlterado = nome.trim() !== usuario.nome

  async function salvarNome(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    if (!nome.trim()) {
      setErroNome('Informe o nome completo.')
      document.getElementById('cfg-nome')?.focus()
      return
    }
    if (!nomeAlterado) {
      setSemAlteracao(true)
      return
    }
    setSalvandoNome(true)
    try {
      await atualizarUsuario(usuario.id, { nome: nome.trim() })
      notificar('Dados da conta atualizados.')
    } catch (err) {
      const { mensagem, campos } = errosDaApi(err)
      if (campos.nome) setErroNome(campos.nome)
      else notificar(mensagem, 'erro')
    } finally {
      setSalvandoNome(false)
    }
  }

  async function salvarSenha(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    const n: ErrosSenha = {}
    // A senha atual é conferida pelo servidor.
    if (!atual) n.atual = 'Informe a senha atual.'
    if (!nova) n.nova = 'Crie uma nova senha.'
    else if (nova.length < 8) n.nova = 'A senha precisa ter pelo menos 8 caracteres.'
    else if (nova === atual) n.nova = 'A nova senha precisa ser diferente da atual.'
    if (!confirmacao) n.confirmacao = 'Repita a nova senha.'
    else if (confirmacao !== nova) n.confirmacao = 'As senhas não são iguais.'
    setErros(n)
    const primeiro = Object.keys(n)[0]
    if (primeiro) {
      document.getElementById(`cfg-${primeiro}`)?.focus()
      return
    }
    setSalvandoSenha(true)
    try {
      await atualizarUsuario(usuario.id, { senha: nova, senhaAtual: atual })
      setAtual('')
      setNova('')
      setConfirmacao('')
      notificar('Senha alterada. Use a nova senha no próximo acesso.')
    } catch (err) {
      const { mensagem, campos } = errosDaApi(err, { senhaAtual: 'atual', senha: 'nova' })
      setErros(campos)
      if (campos.atual) document.getElementById('cfg-atual')?.focus()
      else if (campos.nova) document.getElementById('cfg-nova')?.focus()
      else notificar(mensagem, 'erro')
    } finally {
      setSalvandoSenha(false)
    }
  }

  const aria = (id: string, erro?: string, hint = false) => ({
    invalid: !!erro,
    'aria-invalid': !!erro || undefined,
    'aria-describedby': erro ? `${id}-error` : hint ? `${id}-hint` : undefined,
  })

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader title="Configurações" description="Dados da sua conta e segurança de acesso." />

      <Secao
        icon={<IconUsers size={22} />}
        title="Dados da conta"
        description="O nome aparece no cabeçalho e nos registros de lote. Usuário e perfil são definidos pelo administrador."
      >
        <form onSubmit={salvarNome} noValidate className="flex flex-col gap-5">
          <Field id="cfg-nome" label="Nome completo" error={erroNome}>
            <TextInput
              id="cfg-nome"
              autoComplete="name"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                setErroNome(undefined)
                setSemAlteracao(false)
              }}
              {...aria('cfg-nome', erroNome)}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="cfg-usuario" label="Usuário" hint="Definido pelo administrador.">
              <TextInput id="cfg-usuario" value={usuario.usuario} readOnly className="border-line! bg-page! text-ink-2! hover:border-line!" />
            </Field>
            <Field id="cfg-perfil" label="Perfil" hint="Definido pelo administrador.">
              <TextInput id="cfg-perfil" value={perfilLabel[usuario.perfil]} readOnly className="border-line! bg-page! text-ink-2! hover:border-line!" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-4 border-t border-line pt-5">
            <p className="text-[15px] text-ink-2" role="status">
              {semAlteracao ? 'Nenhuma alteração para salvar.' : ''}
            </p>
            <Button type="submit" loading={salvandoNome}>
              Salvar dados
            </Button>
          </div>
        </form>
      </Secao>

      <Secao
        icon={<IconLock size={22} />}
        title="Alterar senha"
        description="Use pelo menos 8 caracteres. Não compartilhe sua senha com outras pessoas da lavanderia."
      >
        <form onSubmit={salvarSenha} noValidate className="flex flex-col gap-5">
          <Field id="cfg-atual" label="Senha atual" error={erros.atual}>
            <PasswordInput
              id="cfg-atual"
              autoComplete="current-password"
              value={atual}
              onChange={(e) => {
                setAtual(e.target.value)
                setErros((x) => ({ ...x, atual: undefined }))
              }}
              {...aria('cfg-atual', erros.atual)}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="cfg-nova" label="Nova senha" error={erros.nova}>
              <PasswordInput
                id="cfg-nova"
                autoComplete="new-password"
                value={nova}
                onChange={(e) => {
                  setNova(e.target.value)
                  setErros((x) => ({ ...x, nova: undefined }))
                }}
                aria-describedby={erros.nova ? 'cfg-nova-error' : 'cfg-senha-regra'}
                invalid={!!erros.nova}
              />
            </Field>
            <Field id="cfg-confirmacao" label="Confirmar nova senha" error={erros.confirmacao}>
              <PasswordInput
                id="cfg-confirmacao"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => {
                  setConfirmacao(e.target.value)
                  setErros((x) => ({ ...x, confirmacao: undefined }))
                }}
                aria-describedby={erros.confirmacao ? 'cfg-confirmacao-error' : 'cfg-senha-regra'}
                invalid={!!erros.confirmacao}
              />
            </Field>
            <p id="cfg-senha-regra" className="-mt-2 text-[13px] leading-snug text-ink-2 sm:col-span-2">
              A nova senha precisa ter pelo menos 8 caracteres e ser diferente da atual.
            </p>
          </div>
          <div className="flex justify-end border-t border-line pt-5">
            <Button type="submit" loading={salvandoSenha}>
              Alterar senha
            </Button>
          </div>
        </form>
      </Secao>
    </div>
  )
}
