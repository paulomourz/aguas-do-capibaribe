import { useEffect, type ReactNode } from 'react'
import { Toast } from './components/ui'
import type { AlertaStatus, Perfil } from './domain'
import { navigate, useRoute } from './router'
import { AppProvider, homeDe, periodoAtual, useApp } from './store'
import AppLayout, { type MenuId } from './layouts/AppLayout'
import { AcessoNegado, Login, NaoEncontrada, SemConexao, SessaoExpirada } from './screens/Acesso'
import RegistroLote, { ResultadoLote } from './screens/RegistroLote'
import Historico from './screens/Historico'
import Dashboard from './screens/Dashboard'
import Processos from './screens/Processos'
import { AlertaDetalhe, Alertas } from './screens/Alertas'
import { RelatorioPdf, Relatorios } from './screens/Relatorios'
import { UsuarioNovo, Usuarios } from './screens/Usuarios'
import Configuracoes from './screens/Configuracoes'
import Auditoria from './screens/Auditoria'

type Rota = { titulo: string; perfis: Perfil[]; menu?: MenuId; el: ReactNode }

const TODOS: Perfil[] = ['admin', 'gestor', 'operador']
const GESTOR: Perfil[] = ['admin', 'gestor']
const ADMIN: Perfil[] = ['admin']

function resolver(path: string, q: URLSearchParams, perfil?: Perfil): Rota | null {
  let m: RegExpMatchArray | null
  if (path === '/registro') return { titulo: 'O1 Registro de lote', perfis: TODOS, menu: 'registro', el: <RegistroLote /> }
  if ((m = path.match(/^\/registro\/resultado\/([\w-]+)$/)))
    return { titulo: 'O2 Resultado do lote', perfis: TODOS, menu: 'registro', el: <ResultadoLote id={m[1]} /> }
  if (path === '/historico')
    return { titulo: `${perfil === 'operador' ? 'O3' : 'G6'} Histórico de lotes`, perfis: TODOS, menu: 'historico', el: <Historico /> }
  if (path === '/dashboard') return { titulo: 'G1 Dashboard', perfis: GESTOR, menu: 'dashboard', el: <Dashboard /> }
  if (path === '/processos')
    return { titulo: 'G2 Processos e metas', perfis: GESTOR, menu: 'processos', el: <Processos destaque={q.get('salvo') ?? undefined} /> }
  if (path === '/processos/novo') return { titulo: 'G3 Novo processo', perfis: GESTOR, menu: 'processos', el: <Processos modal="novo" /> }
  if ((m = path.match(/^\/processos\/([\w-]+)\/editar$/)))
    return { titulo: 'G3 Editar processo', perfis: GESTOR, menu: 'processos', el: <Processos modal="editar" editarId={m[1]} /> }
  if (path === '/alertas') {
    const aba = (['aberto', 'analise', 'resolvido'].includes(q.get('aba') ?? '') ? q.get('aba') : 'aberto') as AlertaStatus
    return { titulo: 'G4 Alertas', perfis: GESTOR, menu: 'alertas', el: <Alertas key={aba} aba={aba} /> }
  }
  if ((m = path.match(/^\/alertas\/([\w-]+)$/)))
    return { titulo: 'G5 Detalhe do alerta', perfis: GESTOR, menu: 'alertas', el: <AlertaDetalhe id={m[1]} /> }
  if (path === '/relatorios') {
    const mes = Number(q.get('mes')) || undefined
    const ano = Number(q.get('ano')) || undefined
    return { titulo: 'G7 Relatórios', perfis: GESTOR, menu: 'relatorios', el: <Relatorios mesInicial={mes} anoInicial={ano} /> }
  }
  if (path === '/relatorios/pdf')
    return {
      titulo: 'G8 Pré-visualização do PDF',
      perfis: GESTOR,
      menu: 'relatorios',
      el: <RelatorioPdf mes={Number(q.get('mes')) || periodoAtual().mes} ano={Number(q.get('ano')) || periodoAtual().ano} />,
    }
  if (path === '/usuarios')
    return { titulo: 'G9 Usuários', perfis: ADMIN, menu: 'usuarios', el: <Usuarios destaque={q.get('novo') ?? undefined} /> }
  if (path === '/usuarios/novo') return { titulo: 'G10 Novo usuário', perfis: ADMIN, menu: 'usuarios', el: <UsuarioNovo /> }
  if (path === '/auditoria') return { titulo: 'G11 Auditoria', perfis: ADMIN, menu: 'auditoria', el: <Auditoria /> }
  if (path === '/configuracoes') return { titulo: 'C1 Configurações da conta', perfis: TODOS, el: <Configuracoes /> }
  return null
}

function Roteador() {
  const { path, query } = useRoute()
  const { usuario, restaurando, semConexao, toast, fecharToast } = useApp()

  let titulo = 'Águas do Capibaribe'
  let tela: ReactNode

  if (path === '/') {
    tela = null
  } else if (path === '/login') {
    titulo = 'A1 Login'
    tela = <Login next={query.get('next') ?? undefined} />
  } else if (path === '/sessao-expirada') {
    titulo = 'A2 Faça login para continuar'
    tela = <SessaoExpirada />
  } else {
    const rota = resolver(path, query, usuario?.perfil)
    if (!rota) {
      titulo = 'A4 Página não encontrada'
      tela = <NaoEncontrada />
    } else if (!usuario && semConexao) {
      titulo = 'A5 Sem conexão com o servidor'
      tela = <SemConexao />
    } else if (!usuario) {
      titulo = 'A2 Faça login para continuar'
      tela = <SessaoExpirada next={path + (query.toString() ? `?${query}` : '')} />
    } else if (!rota.perfis.includes(usuario.perfil)) {
      titulo = 'A3 Acesso negado'
      tela = <AcessoNegado />
    } else {
      titulo = rota.titulo
      tela = <AppLayout ativo={rota.menu}>{rota.el}</AppLayout>
    }
  }

  useEffect(() => {
    if (restaurando) return
    if (path === '/') navigate(usuario ? homeDe(usuario.perfil) : '/login', { replace: true })
    else if (path === '/login' && usuario) navigate(homeDe(usuario.perfil), { replace: true })
  }, [path, usuario, restaurando])

  useEffect(() => {
    document.title = `${titulo.replace(/^[AOCG]\d+ /, '')} · Águas do Capibaribe`
  }, [titulo])

  // Enquanto confere a sessão salva, não mostra login nem "sessão expirada".
  if (restaurando) {
    return (
      <p role="status" className="grid min-h-screen place-items-center bg-page text-[15px] text-ink-2">
        Carregando…
      </p>
    )
  }

  return (
    <>
      {tela}
      <Toast toast={toast} onClose={fecharToast} />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Roteador />
    </AppProvider>
  )
}
