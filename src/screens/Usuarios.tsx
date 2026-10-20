import { useState, type FormEvent } from 'react'
import {
  Banner,
  Button,
  Card,
  ChoiceGroup,
  DataTable,
  DiamondDivider,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  PasswordInput,
  StatePreview,
  TextInput,
  cx,
} from '../components/ui'
import { IconArrowLeft, IconInfo, IconLock, IconUserCheck, IconUserOff, IconUserPlus, IconUsers } from '../components/icons'
import { perfilLabel, type Perfil, type Usuario } from '../domain'
import { Link, navigate } from '../router'
import { errosDaApi, useApp, useEstadoTela } from '../store'

function PerfilTag({ p }: { p: Perfil }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-2.5 py-1 text-[13px] font-semibold',
        p === 'gestor' ? 'bg-brand text-white' : 'bg-brand-soft text-brand',
      )}
    >
      {perfilLabel[p]}
    </span>
  )
}

function SituacaoTag({ ativo }: { ativo: boolean }) {
  const Icon = ativo ? IconUserCheck : IconUserOff
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-semibold',
        ativo ? 'bg-brand-soft text-brand' : 'bg-neutral-bg text-neutral-ink',
      )}
    >
      <Icon size={16} strokeWidth={2.2} />
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}

/* ---------- G9 Usuários (lista) ---------- */

export function Usuarios({ destaque }: { destaque?: string }) {
  const { usuarios, usuario, definirAtivo, notificar } = useApp()
  const [estado, setEstado] = useEstadoTela()
  const [desativar, setDesativar] = useState<Usuario | null>(null)
  const [reativar, setReativar] = useState<Usuario | null>(null)
  const [novaSenha, setNovaSenha] = useState<Usuario | null>(null)
  const [alterando, setAlterando] = useState(false)
  const lista = estado === 'vazio' ? [] : usuarios

  async function mudarAcesso(u: Usuario, ativo: boolean) {
    setAlterando(true)
    try {
      await definirAtivo(u.id, ativo)
      notificar(`Acesso de ${u.nome} ${ativo ? 'reativado' : 'desativado'}.`)
    } catch (err) {
      notificar(errosDaApi(err).mensagem, 'erro')
    } finally {
      setAlterando(false)
      setDesativar(null)
      setReativar(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <StatePreview value={estado} onChange={setEstado} />
      <PageHeader
        title="Usuários"
        description="Somente o gestor cria acessos. Não existe cadastro público."
        actions={
          <>
            <Button icon={<IconUserPlus size={20} />} onClick={() => navigate('/usuarios/novo')}>
              Novo usuário
            </Button>
          </>
        }
      />
      <Card as="section" className="overflow-hidden">
        {estado === 'carregando' ? (
          <LoadingBlock rows={3} label="Carregando usuários…" />
        ) : estado === 'erro' ? (
          <ErrorState title="Não foi possível carregar os usuários" onRetry={() => setEstado('dados')} />
        ) : lista.length === 0 ? (
          <EmptyState
            icon={<IconUsers size={28} />}
            title="Nenhum usuário cadastrado"
            description="Crie os acessos dos operadores e gestores da lavanderia."
            action={
              <Button icon={<IconUserPlus size={20} />} onClick={() => navigate('/usuarios/novo')}>
                Novo usuário
              </Button>
            }
          />
        ) : (
          <DataTable<Usuario>
            rows={lista}
            rowKey={(u) => u.id}
            caption="Usuários cadastrados"
            minWidth={680}
            highlight={(u) => u.id === destaque}
            cols={[
              {
                key: 'n',
                header: 'Nome',
                mobile: 'title',
                render: (u) => (
                  <span className="font-semibold">
                    {u.nome}
                    {u.id === usuario?.id && <span className="ml-2 text-[13px] font-normal text-ink-2">(você)</span>}
                  </span>
                ),
              },
              { key: 'u', header: 'Usuário', mobile: 'subtitle', render: (u) => <span className="tabular-nums">{u.usuario}</span> },
              { key: 'p', header: 'Perfil', mobile: 'field', render: (u) => <PerfilTag p={u.perfil} /> },
              { key: 's', header: 'Situação', mobile: 'field', render: (u) => <SituacaoTag ativo={u.ativo} /> },
              {
                key: 'a',
                header: 'Ações',
                mobile: 'badge',
                className: 'w-px whitespace-nowrap',
                render: (u) =>
                  u.id === usuario?.id ? (
                    <span className="text-[13px] text-ink-2">Sessão atual</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1">
                      <Button variant="text" size="sm" icon={<IconLock size={18} />} onClick={() => setNovaSenha(u)}>
                        Redefinir senha<span className="sr-only"> de {u.nome}</span>
                      </Button>
                      {u.ativo ? (
                        <Button variant="text" size="sm" icon={<IconUserOff size={18} />} onClick={() => setDesativar(u)}>
                          Desativar acesso<span className="sr-only"> de {u.nome}</span>
                        </Button>
                      ) : (
                        <Button variant="text" size="sm" icon={<IconUserCheck size={18} />} onClick={() => setReativar(u)}>
                          Reativar acesso<span className="sr-only"> de {u.nome}</span>
                        </Button>
                      )}
                    </span>
                  ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={!!desativar}
        onClose={() => setDesativar(null)}
        size="sm"
        title="Desativar acesso?"
        description={desativar ? `${desativar.nome} não poderá mais entrar no sistema. Os lotes já registrados por esse usuário são mantidos.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDesativar(null)}>
              Cancelar
            </Button>
            <Button loading={alterando} onClick={() => desativar && mudarAcesso(desativar, false)}>
              Desativar acesso
            </Button>
          </>
        }
      />

      <Modal
        open={!!reativar}
        onClose={() => setReativar(null)}
        size="sm"
        title="Reativar acesso?"
        description={reativar ? `${reativar.nome} poderá entrar no sistema novamente com o mesmo usuário e senha.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReativar(null)}>
              Cancelar
            </Button>
            <Button loading={alterando} onClick={() => reativar && mudarAcesso(reativar, true)}>
              Reativar acesso
            </Button>
          </>
        }
      />

      {novaSenha && <RedefinirSenha key={novaSenha.id} pessoa={novaSenha} onClose={() => setNovaSenha(null)} />}
    </div>
  )
}

/* ---------- Redefinir a senha de outra pessoa ---------- */

function RedefinirSenha({ pessoa, onClose }: { pessoa: Usuario; onClose: () => void }) {
  const { redefinirSenha, notificar } = useApp()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erros, setErros] = useState<Partial<Record<'senha' | 'confirmacao', string>>>({})
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const n: typeof erros = {}
    if (!senha) n.senha = 'Crie a nova senha.'
    else if (senha.length < 8) n.senha = 'A senha precisa ter pelo menos 8 caracteres.'
    if (!confirmacao) n.confirmacao = 'Repita a senha.'
    else if (confirmacao !== senha) n.confirmacao = 'As senhas não são iguais.'
    setErros(n)
    if (Object.keys(n).length) return
    setSalvando(true)
    try {
      await redefinirSenha(pessoa.id, senha)
      notificar(`Senha de ${pessoa.nome} redefinida. Entregue a nova senha à pessoa.`)
      onClose()
    } catch (err) {
      const { mensagem, campos } = errosDaApi(err)
      setErros(campos)
      if (!Object.keys(campos).length) notificar(mensagem, 'erro')
      setSalvando(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !salvando && onClose()}
      size="sm"
      title={`Redefinir senha de ${pessoa.nome}`}
      description="Use quando a pessoa esqueceu a senha. A senha antiga deixa de valer na hora."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-nova-senha" loading={salvando} icon={<IconLock size={18} />}>
            Redefinir senha
          </Button>
        </>
      }
    >
      <form id="form-nova-senha" onSubmit={salvar} noValidate className="flex flex-col gap-5">
        <Field id="ns-senha" label="Nova senha" error={erros.senha} hint="Mínimo de 8 caracteres.">
          <PasswordInput id="ns-senha" value={senha} autoComplete="new-password" invalid={!!erros.senha} onChange={(e) => { setSenha(e.target.value); setErros((x) => ({ ...x, senha: undefined })) }} />
        </Field>
        <Field id="ns-confirmacao" label="Confirmação da nova senha" error={erros.confirmacao}>
          <PasswordInput id="ns-confirmacao" value={confirmacao} autoComplete="new-password" invalid={!!erros.confirmacao} onChange={(e) => { setConfirmacao(e.target.value); setErros((x) => ({ ...x, confirmacao: undefined })) }} />
        </Field>
      </form>
    </Modal>
  )
}

/* ---------- G10 Cadastro de usuário ---------- */

type Erros = Partial<Record<'nome' | 'usuario' | 'senha' | 'confirmacao' | 'perfil', string>>

export function UsuarioNovo() {
  const { usuarios, criarUsuario, notificar } = useApp()
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [perfil, setPerfil] = useState<Perfil | ''>('')
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)

  const limpar = (k: keyof Erros) => setErros((x) => ({ ...x, [k]: undefined }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const n: Erros = {}
    if (!nome.trim()) n.nome = 'Informe o nome completo.'
    const l = login.trim().toLowerCase()
    if (!l) n.usuario = 'Informe o nome de usuário.'
    else if (!/^[a-z0-9._-]+$/.test(l)) n.usuario = 'Use apenas letras sem acento, números, ponto, hífen ou sublinhado.'
    else if (l.length < 3) n.usuario = 'O usuário precisa ter pelo menos 3 caracteres.'
    else if (usuarios.some((u) => u.usuario === l)) n.usuario = 'Este usuário já existe. Escolha outro.'
    if (!senha) n.senha = 'Crie uma senha.'
    else if (senha.length < 8) n.senha = 'A senha precisa ter pelo menos 8 caracteres.'
    if (!confirmacao) n.confirmacao = 'Repita a senha.'
    else if (confirmacao !== senha) n.confirmacao = 'As senhas não são iguais.'
    if (!perfil) n.perfil = 'Escolha o perfil de acesso.'
    setErros(n)
    const primeiro = Object.keys(n)[0]
    if (primeiro) {
      const el =
        primeiro === 'perfil'
          ? document.querySelector<HTMLInputElement>('input[name="perfil"]')
          : document.getElementById(`u-${primeiro}`)
      el?.focus()
      return
    }
    setSalvando(true)
    try {
      const u = await criarUsuario({ nome: nome.trim(), usuario: l, senha, perfil: perfil as Perfil })
      notificar(`Usuário ${u.nome} criado como ${perfilLabel[u.perfil]}.`)
      navigate(`/usuarios?novo=${u.id}`)
    } catch (err) {
      const { mensagem, campos } = errosDaApi(err)
      setErros(campos)
      if (!Object.keys(campos).length) notificar(mensagem, 'erro')
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Novo usuário"
        description="O acesso fica disponível assim que for salvo. Entregue o usuário e a senha à pessoa."
        back={
          <Link to="/usuarios" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-[15px] font-semibold text-link hover:underline">
            <IconArrowLeft size={18} /> Usuários
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card as="section" className="p-4 sm:p-8 lg:col-span-8">
          <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
            {Object.keys(erros).length > 0 && <Banner tone="crit">Corrija os campos destacados para criar o usuário.</Banner>}

            <div className="grid gap-6 sm:grid-cols-2">
              <Field id="u-nome" label="Nome completo" error={erros.nome}>
                <TextInput id="u-nome" value={nome} autoComplete="off" invalid={!!erros.nome} onChange={(e) => { setNome(e.target.value); limpar('nome') }} />
              </Field>
              <Field id="u-usuario" label="Usuário" error={erros.usuario} hint="Usado para entrar no sistema. Ex.: operador02">
                <TextInput id="u-usuario" value={login} autoComplete="off" autoCapitalize="none" invalid={!!erros.usuario} onChange={(e) => { setLogin(e.target.value); limpar('usuario') }} />
              </Field>
              <Field id="u-senha" label="Senha" error={erros.senha} hint="Mínimo de 8 caracteres.">
                <PasswordInput id="u-senha" value={senha} autoComplete="new-password" invalid={!!erros.senha} onChange={(e) => { setSenha(e.target.value); limpar('senha') }} />
              </Field>
              <Field id="u-confirmacao" label="Confirmação de senha" error={erros.confirmacao}>
                <PasswordInput id="u-confirmacao" value={confirmacao} autoComplete="new-password" invalid={!!erros.confirmacao} onChange={(e) => { setConfirmacao(e.target.value); limpar('confirmacao') }} />
              </Field>
            </div>

            <ChoiceGroup<Perfil>
              legend="Perfil de acesso"
              name="perfil"
              value={perfil}
              error={erros.perfil}
              onChange={(p) => { setPerfil(p); limpar('perfil') }}
              options={[
                { value: 'operador', label: 'Operador', hint: 'Registra lotes e vê o próprio histórico' },
                { value: 'gestor', label: 'Gestor', hint: 'Acesso completo, inclusive usuários e metas' },
              ]}
            />

            <DiamondDivider tone="areia" opacity={0.9} />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => navigate('/usuarios')} disabled={salvando}>
                Cancelar
              </Button>
              <Button type="submit" loading={salvando} icon={<IconUserPlus size={20} />}>
                {salvando ? 'Criando…' : 'Criar usuário'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="h-fit p-6 lg:col-span-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <IconInfo size={20} />
            </span>
            <div>
              <h2 className="text-[18px] font-semibold">Quem pode criar acessos?</h2>
              <p className="mt-2 text-[15px] text-ink-2">
                Somente gestores cadastram usuários. Não há autocadastro: cada operador recebe o acesso diretamente do gestor.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
