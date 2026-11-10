import { useId, useState, type FormEvent, type ReactNode } from 'react'
import SeletorTema from '../components/SeletorTema'
import { Banner, Button, Card, DiamondDivider, DiamondIllustration, Field, Logo, PasswordInput, TextInput } from '../components/ui'
import { IconCloudOff, IconCompass, IconLock, IconRefresh } from '../components/icons'
import { Link, navigate } from '../router'
import { errosDaApi, homeDe, useApp } from '../store'
import waveReference from '../assets/wave-minimal-reference.jpg'
import AppLayout, { Footer } from '../layouts/AppLayout'
import logoUrl from '../assets/logo.png'

/* ---------- A1 Login ---------- */

function WavePattern({ cor = 'var(--color-areia)', opacidade = 0.12 }: { cor?: string; opacidade?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const filterId = `waveColor${uid}`

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-[58%] w-full"
      style={{ maskImage: 'linear-gradient(to bottom, transparent, #000 22%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 22%)' }}
      viewBox="0 0 736 491"
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <filter id={filterId} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                   -0.8 -0.8 -0.8 0 1.9"
            result="waveMask"
          />
          <feFlood style={{ floodColor: cor }} floodOpacity={opacidade} result="waveColor" />
          <feComposite in="waveColor" in2="waveMask" operator="in" />
        </filter>
      </defs>
      <image href={waveReference} width="736" height="491" filter={`url(#${filterId})`} />
    </svg>
  )
}

export function Login({ next }: { next?: string }) {
  const { entrar } = useApp()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(false)
    setFalha(null)
    setCarregando(true)
    try {
      const u = await entrar(usuario, senha)
      if (!u) {
        setErro(true)
        setSenha("")
        return
      }
      const destino = next && (u.perfil !== 'operador' || ['/registro', '/historico'].some((p) => next.startsWith(p))) ? next : homeDe(u.perfil)
      navigate(destino, { replace: true })
    } catch (err) {
      setFalha(errosDaApi(err).mensagem)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page lg:flex-row">
      {/* Painel de marca */}
      <section className="on-dark relative hidden overflow-hidden bg-brand text-white lg:flex lg:w-[46%] lg:flex-col">
        <WavePattern />
        <div className="relative flex flex-1 flex-col justify-between px-14 pt-14 pb-20">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-logo-bg ring-2 ring-areia/60">
              <img src={logoUrl} alt="" className="h-[44px] w-[44px] object-contain" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[21px] font-bold tracking-tight text-white">Águas do Capibaribe</span>
              <span className="block text-[13px] text-areia">Gestão de água por lote</span>
            </span>
          </div>
          <div className="max-w-md">
            <p className="text-[15px] font-semibold tracking-[0.01em] text-areia">Lavanderias industriais de jeans</p>
            <h1 className="mt-4 text-[44px] font-bold leading-[1.18] tracking-tight">
              Cada lote com a água que ele precisa. Nem uma gota a mais.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-on-dark-muted">
              Registre o consumo no chão de fábrica e veja na hora o desvio em relação à meta de cada processo.
            </p>
          </div>
          <div>
            <p className="text-sm text-on-dark-muted">Feito para o Agreste Pernambucano · Toritama, Caruaru e Santa Cruz do Capibaribe</p>
          </div>
        </div>
      </section>

      {/* Formulário */}
      <section className="relative flex flex-1 flex-col overflow-hidden bg-sertao">
        <div className="absolute right-3 top-3 z-10">
          <SeletorTema />
        </div>
        <div className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[400px]">
            <div className="mb-10 lg:hidden">
              <Logo />
            </div>
            <h2 className="text-[34px] font-bold leading-tight tracking-tight text-ink">Acesse sua lavanderia</h2>
            <p className="mt-2 text-[16px] text-ink-2">Use o usuário e a senha criados pelo administrador.</p>

            <form onSubmit={enviar} noValidate className="mt-8 flex flex-col gap-5">
              {erro && <Banner tone="crit" title="Não foi possível entrar">Usuário ou senha incorretos. Confira os dados e tente novamente.</Banner>}
              {falha && <Banner tone="crit" title="Não foi possível entrar">{falha}</Banner>}

              <Field id="usuario" label="Usuário">
                <TextInput
                  id="usuario"
                  name="usuario"
                  autoComplete="username"
                  autoCapitalize="none"
                  value={usuario}
                  invalid={erro}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                />
              </Field>

              <Field id="senha" label="Senha">
                <PasswordInput
                  id="senha"
                  name="senha"
                  autoComplete="current-password"
                  value={senha}
                  invalid={erro}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </Field>

              <Button type="submit" size="lg" full loading={carregando} className="mt-2">
                {carregando ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>

            <p className="mt-6 text-[14px] text-ink-2">Esqueceu a senha? Peça ao administrador para redefinir.</p>
            <p className="mt-3 text-[14px] text-ink-2">
              <Link to="/privacidade" className="font-semibold text-brand underline underline-offset-2">
                Aviso de privacidade
              </Link>
              : quais dados guardamos, para quê e por quanto tempo.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ---------- Tela pública (A2 / A4 sem sessão) ---------- */

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="on-dark bg-brand">
        <div className="h-1 bg-terracota" />
        <div className="flex h-16 items-center px-4 sm:px-6 lg:h-[72px] lg:px-8">
          <Logo inverted />
        </div>
      </header>
      <main id="conteudo" className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>
      <Footer />
    </div>
  )
}

function Aviso({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action: ReactNode
}) {
  return (
    <Card className="w-full max-w-[480px] p-8 text-center sm:p-10">
      <div className="flex justify-center">
        <DiamondIllustration size={120}>{icon}</DiamondIllustration>
      </div>
      <h1 className="mt-6 text-[28px] font-bold tracking-tight text-ink">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-base text-ink-2">{text}</p>
      <div className="mt-8">{action}</div>
      <DiamondDivider tone="areia" opacity={1} className="mx-auto mt-8 max-w-[200px]" />
    </Card>
  )
}

/* ---------- A2 Sessão expirada / acesso restrito ---------- */

export function SessaoExpirada({ next }: { next?: string }) {
  return (
    <PublicShell>
      <Aviso
        icon={<IconLock size={30} />}
        title="Faça login para continuar"
        text="Sua sessão expirou ou você ainda não entrou no sistema. Entre novamente para acessar esta tela."
        action={
          <Button size="lg" full onClick={() => navigate(next ? `/login?next=${encodeURIComponent(next)}` : '/login')}>
            Ir para o login
          </Button>
        }
      />
    </PublicShell>
  )
}

/* ---------- A5 Servidor fora do ar (havia sessão salva) ---------- */

export function SemConexao() {
  const { tentarConectar } = useApp()
  return (
    <PublicShell>
      <Aviso
        icon={<IconCloudOff size={30} />}
        title="Não foi possível conectar ao servidor."
        text="O sistema não respondeu. Sua sessão continua salva: confira se a API está no ar e tente de novo. Se o problema continuar, avise o responsável pelo sistema."
        action={
          <Button size="lg" full icon={<IconRefresh size={20} />} onClick={tentarConectar}>
            Tentar novamente
          </Button>
        }
      />
    </PublicShell>
  )
}

/* ---------- A3 Acesso negado ---------- */

export function AcessoNegado() {
  const { usuario } = useApp()
  if (!usuario) return null
  return (
    <AppLayout>
      <div className="flex justify-center py-8">
        <Aviso
          icon={<IconLock size={30} />}
          title="Acesso negado"
          text="Seu perfil não tem permissão para abrir esta tela. Se precisar desse acesso, fale com o administrador da lavanderia."
          action={
            <Button size="lg" full onClick={() => navigate(homeDe(usuario.perfil))}>
              Voltar para a tela inicial
            </Button>
          }
        />
      </div>
    </AppLayout>
  )
}

/* ---------- A4 Página não encontrada ---------- */

export function NaoEncontrada() {
  const { usuario } = useApp()
  const conteudo = (
    <Aviso
      icon={<IconCompass size={30} />}
      title="Página não encontrada"
      text="O endereço pode estar incorreto ou a página não existe mais."
      action={
        <Button size="lg" full onClick={() => navigate(usuario ? homeDe(usuario.perfil) : '/login')}>
          {usuario ? 'Ir para a tela inicial' : 'Ir para o login'}
        </Button>
      }
    />
  )
  if (!usuario) return <PublicShell>{conteudo}</PublicShell>
  return (
    <AppLayout>
      <div className="flex justify-center py-8">{conteudo}</div>
    </AppLayout>
  )
}
