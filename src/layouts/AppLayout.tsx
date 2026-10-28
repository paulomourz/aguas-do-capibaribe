import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AvisoModoSimulado, cx } from '../components/ui'
import logoUrl from '../assets/logo.png'
import pacote from '../../package.json'
import {
  IconBell,
  IconCalendar,
  IconChevronDown,
  IconClipboard,
  IconDashboard,
  IconHistory,
  IconLogout,
  IconSettings,
  IconReport,
  IconTarget,
  IconUsers,
} from '../components/icons'
import { Link, navigate } from '../router'
import { homeDe, periodoAtual, useApp } from '../store'
import { meses, perfilLabel, type Perfil } from '../domain'

export type MenuId = 'dashboard' | 'registro' | 'historico' | 'processos' | 'alertas' | 'relatorios' | 'usuarios'

export type MenuGrupo = 'Acompanhamento' | 'Lotes' | 'Cadastros'

export const menu: { id: MenuId; label: string; to: string; Icon: typeof IconDashboard; perfis: Perfil[]; grupo: MenuGrupo }[] = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard', Icon: IconDashboard, perfis: ['gestor'], grupo: 'Acompanhamento' },
  { id: 'alertas', label: 'Alertas', to: '/alertas', Icon: IconBell, perfis: ['gestor'], grupo: 'Acompanhamento' },
  { id: 'relatorios', label: 'Relatórios', to: '/relatorios', Icon: IconReport, perfis: ['gestor'], grupo: 'Acompanhamento' },
  { id: 'registro', label: 'Registro de lotes', to: '/registro', Icon: IconClipboard, perfis: ['gestor', 'operador'], grupo: 'Lotes' },
  { id: 'historico', label: 'Histórico de lotes', to: '/historico', Icon: IconHistory, perfis: ['gestor', 'operador'], grupo: 'Lotes' },
  { id: 'processos', label: 'Processos e metas', to: '/processos', Icon: IconTarget, perfis: ['gestor'], grupo: 'Cadastros' },
  { id: 'usuarios', label: 'Usuários', to: '/usuarios', Icon: IconUsers, perfis: ['gestor'], grupo: 'Cadastros' },
]
const grupos: MenuGrupo[] = ['Acompanhamento', 'Lotes', 'Cadastros']

export default function AppLayout({ ativo, children }: { ativo?: MenuId; children: ReactNode }) {
  const { usuario, sair, alertas } = useApp()
  if (!usuario) return null
  const itens = menu.filter((m) => m.perfis.includes(usuario.perfil))
  const abertos = alertas.filter((a) => a.status !== 'resolvido').length
  const periodo = periodoAtual()

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <a
        href="#conteudo"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('conteudo')?.focus()
        }}
        className="sr-only z-[70] rounded-md bg-white px-4 py-3 font-semibold text-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>

      <AvisoModoSimulado />
      <header className="on-dark sticky top-0 z-30 bg-brand text-white">
        <NuvensDoTopo />
        <div className="relative flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:h-[68px] lg:px-8">
          <Link to={homeDe(usuario.perfil)} className="flex items-center gap-3 rounded-lg" aria-label="Águas do Capibaribe, ir para a tela inicial">
            <span aria-hidden="true" className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-sertao ring-2 ring-areia/60">
              <img src={logoUrl} alt="" className="h-[44px] w-[44px] object-contain" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[21px] font-bold tracking-tight text-white">Águas do Capibaribe</span>
              <span className="hidden text-[13px] text-areia sm:block">Gestão de água por lote</span>
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <div className="hidden items-center gap-5 md:flex">
              <div className="flex items-center gap-2.5 leading-tight">
                <IconCalendar size={18} className="text-areia" />
                <span>
                  <span className="block text-[12px] text-areia">Mês de referência</span>
                  <span className="block text-[15px] font-semibold text-white">
                    {meses[periodo.mes - 1]} de {periodo.ano}
                  </span>
                </span>
              </div>
              <span aria-hidden="true" className="h-8 w-px bg-white/15" />
            </div>
            <UserMenu nome={usuario.nome} perfil={perfilLabel[usuario.perfil]} perfilId={usuario.perfil} onSair={() => { sair(); navigate('/login') }} />
          </div>
        </div>

        <nav aria-label="Menu principal" className="relative lg:hidden">
          <ul className="no-scrollbar flex gap-1 overflow-x-auto px-2 pb-2 sm:px-4">
            {itens.map(({ id, label, to, Icon }) => {
              const sel = ativo === id
              return (
                <li key={id} className="shrink-0">
                  <Link
                    to={to}
                    aria-current={sel ? 'page' : undefined}
                    className={cx(
                      'flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-[15px] font-medium transition-colors',
                      sel ? 'bg-white text-brand' : 'text-on-dark hover:bg-brand-hover hover:text-white',
                    )}
                  >
                    <Icon size={18} />
                    {label}
                    {id === 'alertas' && abertos > 0 && <Contador n={abertos} />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-[264px] shrink-0 border-r border-areia/60 bg-sertao lg:block">
          <nav aria-label="Menu principal" className="sticky top-[68px] no-scrollbar flex h-[calc(100vh-68px)] flex-col overflow-y-auto pt-4">
            <div className="flex shrink-0 flex-col gap-5 px-4 pb-3">
              {grupos.map((g) => {
                const doGrupo = itens.filter((i) => i.grupo === g)
                if (!doGrupo.length) return null
                const tituloId = `menu-grupo-${g.toLowerCase()}`
                return (
                  <div key={g}>
                    <p id={tituloId} className="flex items-center gap-2 px-3 pb-2 text-[13px] font-semibold text-couro">
                      <span aria-hidden="true" className="h-[7px] w-[7px] rotate-45 bg-terracota" />
                      {g}
                    </p>
                    <ul aria-labelledby={tituloId} className="flex flex-col gap-1">
                      {doGrupo.map(({ id, label, to, Icon }) => {
                        const sel = ativo === id
                        return (
                          <li key={id}>
                            <Link
                              to={to}
                              aria-current={sel ? 'page' : undefined}
                              className={cx(
                                'flex min-h-11 w-full items-center rounded-lg pr-3 text-[15px] font-medium transition-colors',
                                sel ? 'font-semibold' : 'text-ink-2 hover:bg-white/70 hover:text-ink',
                              )}
                            >
                              <span
                                className={cx(
                                  'inline-flex items-center gap-3 rounded-lg px-3 py-2',
                                  sel && 'bg-brand text-white shadow-sm',
                                )}
                              >
                                <Icon size={20} />
                                <span>{label}</span>
                              </span>
                              {id === 'alertas' && abertos > 0 && (
                                <span className="ml-auto">
                                  <Contador n={abertos} />
                                </span>
                              )}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
            <div className="mt-auto flex min-h-[48px] shrink flex-col justify-end overflow-hidden">
              <Sertao />
            </div>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-[1176px] flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            {children}
          </main>
          <div className="lg:hidden">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="px-4 pt-8 pb-10 sm:px-6 lg:px-10">
      <hr className="mb-6 border-line" />
      <div className="flex flex-col gap-1 text-[13px] text-ink-2 sm:flex-row sm:items-center sm:justify-between">
        <span>Águas do Capibaribe · Gestão de consumo de água por lote</span>
        <span>Versão {pacote.version}</span>
      </div>
    </footer>
  )
}

/** Nuvens estilizadas no céu do topo: base reta, bem translúcidas. */
const nuvens = [
  { x: 330, y: 22, s: 0.9, o: 0.1 },
  { x: 500, y: 40, s: 0.6, o: 0.07 },
  { x: 640, y: 12, s: 1.3, o: 0.12 },
  { x: 610, y: 34, s: 0.7, o: 0.06 },
  { x: 780, y: 38, s: 0.8, o: 0.08 },
  { x: 880, y: 10, s: 1.1, o: 0.1 },
]

function NuvensDoTopo() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 68" preserveAspectRatio="xMidYMid slice">
      {nuvens.map((n, i) => (
        <path
          key={i}
          transform={`translate(${n.x} ${n.y}) scale(${n.s})`}
          d="M0 22 a10 10 0 0 1 10 -10 a15 15 0 0 1 28 -5 a12 12 0 0 1 21 7 a9 9 0 0 1 9 8 Z"
          fill="#fff"
          fillOpacity={n.o}
        />
      ))}
    </svg>
  )
}

/** Xilogravura do pé da barra: chapada e serrotes do Nordeste sobre o rio Capibaribe. */
function Sertao() {
  return (
    <svg aria-hidden="true" viewBox="0 44 264 76" className="block w-full shrink-0">
      {/* chapada ao fundo: topo reto e escarpas */}
      <path
        d="M0 72 L14 72 L24 61 L118 59 L128 67 L148 67 L159 56 L232 55 L242 64 L264 64 V120 H0 Z"
        fill="var(--color-areia)"
        fillOpacity=".5"
      />
      {/* camadas de arenito da chapada */}
      <path
        d="M30 65 H112 M38 70 H104 M165 60 H226 M172 65 H220"
        stroke="var(--color-sertao)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* serrotes de granito na frente */}
      <path
        d="M0 90 C8 80 22 80 30 86 C40 66 62 66 72 84 C80 78 90 78 96 86 C108 70 128 70 138 84 C150 58 176 58 186 82 C194 76 204 76 210 86 C222 70 244 70 252 84 L264 82 V120 H0 Z"
        fill="var(--color-areia)"
      />
      {/* talhos de xilogravura acompanhando a pedra */}
      <path
        d="M44 75 C50 70 56 70 61 75 M112 79 C117 75 123 75 127 79 M160 69 C167 64 174 64 180 70 M163 76 C168 72 173 72 177 76 M227 78 C232 74 238 74 242 78"
        fill="none"
        stroke="var(--color-sertao)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* rio */}
      <path d="M0 98 Q11 92 22 98 T44 98 T66 98 T88 98 T110 98 T132 98 T154 98 T176 98 T198 98 T220 98 T242 98 T264 98 V120 H0 Z" fill="var(--color-brand)" />
      <path
        d="M14 106 q6 -3 12 0 t12 0 M70 111 q6 -3 12 0 t12 0 M124 105 q6 -3 12 0 t12 0 M178 110 q6 -3 12 0 t12 0 M226 105 q6 -3 12 0 t12 0"
        fill="none"
        stroke="var(--color-water-meta)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Contador({ n }: { n: number }) {
  return (
    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-crit-bg px-1.5 text-[13px] font-semibold text-crit tabular-nums">
      {n}
      <span className="sr-only"> alertas ativos</span>
    </span>
  )
}

/** Avatar desenhado por perfil: gestor de gravata, operador de capacete. */
function Avatar({ perfil }: { perfil: Perfil }) {
  return (
    <svg viewBox="0 0 40 40" className="block h-full w-full">
      <path d="M7 41 C7 31 13 26.5 20 26.5 C27 26.5 33 31 33 41 Z" fill="var(--color-areia)" />
      <circle cx="20" cy="17.5" r="6.5" fill="var(--color-areia)" />
      {perfil === 'gestor' ? (
        <>
          <path d="M15.5 27.4 L20 31.5 L24.5 27.4" fill="none" stroke="var(--color-brand)" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M20 31 L18.4 33.2 L20 39.5 L21.6 33.2 Z" fill="var(--color-terracota)" />
        </>
      ) : (
        <>
          <path d="M12.8 16.2 C12.8 10.6 16.2 8 20 8 C23.8 8 27.2 10.6 27.2 16.2 Z" fill="var(--color-terracota)" />
          <path d="M11 16.2 H29" stroke="var(--color-terracota)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M20 8.6 V12.4" stroke="var(--color-sertao)" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M14 33 H18" stroke="var(--color-brand)" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

function UserMenu({ nome, perfil, perfilId, onSair }: { nome: string; perfil: string; perfilId: Perfil; onSair: () => void }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const click = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', click)
      document.removeEventListener('keydown', key)
    }
  }, [aberto])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className="flex min-h-11 items-center gap-3 rounded-lg py-1 pl-1 pr-2 hover:bg-brand-hover"
      >
        <span aria-hidden="true" className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand-hover ring-2 ring-areia/50">
          <Avatar perfil={perfilId} />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[15px] font-semibold">{nome}</span>
          <span className="block text-[13px] text-areia">{perfil}</span>
        </span>
        <span className="sr-only sm:hidden">Menu do usuário {nome}</span>
        <IconChevronDown size={18} />
      </button>
      {aberto && (
        <div role="menu" className="rise absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden rounded-[8px] border border-line bg-white text-ink shadow-xl">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[15px] font-semibold">{nome}</p>
            <p className="text-[13px] text-ink-2">Perfil: {perfil}</p>
          </div>
          <div className="p-2">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setAberto(false)
                navigate('/configuracoes')
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-medium text-ink hover:bg-brand-soft hover:text-brand focus-visible:outline-link"
            >
              <IconSettings size={20} /> Configurações
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={onSair}
              className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-medium text-ink hover:bg-brand-soft hover:text-brand focus-visible:outline-link"
            >
              <IconLogout size={20} /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
