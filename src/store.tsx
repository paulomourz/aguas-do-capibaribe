import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Context, type ReactNode } from 'react'
import type { ToastData, ViewState } from './components/ui'
import { limitesDoMes, statusDaApi, type Alerta, type AlertaStatus, type Lote, type Perfil, type Processo, type Resumo, type Unidade, type Usuario } from './domain'
import { ANO_ATUAL, MES_ATUAL } from './mock'
import * as api from './services'

/*
 * Estado global da aplicação. Todos os dados passam por src/services:
 * por padrão vão para a API REST; só com VITE_USAR_MOCK=true usam a simulação em memória.
 * Os DTOs da API (ids numéricos, datas ISO) são convertidos para os tipos usados pelas telas.
 */

type Ctx = {
  usuario: Usuario | null
  /** Verificando a sessão salva ao abrir/recarregar a página. */
  restaurando: boolean
  /** Havia sessão salva, mas a API não respondeu: não é sessão expirada. */
  semConexao: boolean
  /** Tenta de novo recuperar a sessão salva (depois de "sem conexão"). */
  tentarConectar: () => void
  /** Carregando os dados após o login. */
  carregando: boolean
  erroCarga: string | null
  recarregar: () => void
  /** Retorna null para usuário/senha incorretos; outros erros são lançados. */
  entrar: (login: string, senha: string) => Promise<Usuario | null>
  sair: () => void
  usuarios: Usuario[]
  criarUsuario: (u: { nome: string; usuario: string; senha: string; perfil: Perfil }) => Promise<Usuario>
  definirAtivo: (id: string, ativo: boolean) => Promise<void>
  redefinirSenha: (id: string, senha: string) => Promise<void>
  atualizarUsuario: (id: string, dados: { nome?: string; senha?: string; senhaAtual?: string }) => Promise<void>
  processos: Processo[]
  salvarProcesso: (p: { id?: string; nome: string; unidade: Unidade; meta: number }) => Promise<Processo>
  lotes: Lote[]
  registrarLote: (l: { processoId: string; pecas: number; litros: number }) => Promise<Lote>
  alertas: Alerta[]
  mudarStatusAlerta: (id: string, s: AlertaStatus) => Promise<void>
  toast: ToastData | null
  notificar: (message: string, tone?: ToastData['tone']) => void
  fecharToast: () => void
  nomeProcesso: (id: string) => string
  nomeUsuario: (id: string) => string
}

// Mantém o mesmo contexto entre recarregamentos do hot reload, evitando provider/consumidor de módulos diferentes.
const g = globalThis as unknown as { __aguasCtx?: Context<Ctx | null> }
const AppCtx = (g.__aguasCtx ??= createContext<Ctx | null>(null))

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp fora do provider')
  return c
}

export const homeDe = (p: Perfil) => (p === 'gestor' ? '/dashboard' : '/registro')

/* ---------- Conversões DTO → tipos das telas ---------- */

const txt = (n: number) => String(n)
const deUsuario = (u: api.UsuarioDTO): Usuario => ({ id: txt(u.id), nome: u.nome, usuario: u.usuario, perfil: u.perfil, ativo: u.ativo })
const deProcesso = (p: api.ProcessoDTO): Processo => ({ id: txt(p.id), nome: p.nome, unidade: p.unidade, meta: Number(p.meta) })
const deLote = (l: api.LoteDTO): Lote => ({
  id: txt(l.id),
  processoId: txt(l.processoId),
  usuarioId: txt(l.usuarioId),
  pecas: l.pecas,
  litros: Number(l.litros),
  esperado: Number(l.esperado),
  desvio: Number(l.desvio),
  status: statusDaApi[l.statusConformidade],
  data: new Date(l.data),
})
const deResumo = (r: api.ResumoDTO): Resumo => ({ processoId: txt(r.processoId), real: Number(r.real), esperado: Number(r.esperado), lotes: Number(r.lotes) })

/** Mensagem e erros por campo de uma falha da API; `mapa` renomeia campos da API para os do formulário. */
export function errosDaApi(e: unknown, mapa: Record<string, string> = {}) {
  if (!(e instanceof api.ApiError)) return { mensagem: 'Erro inesperado. Tente novamente.', campos: {} as Record<string, string> }
  const campos: Record<string, string> = {}
  for (const [k, v] of Object.entries(e.campos)) campos[mapa[k] ?? k] = v
  return { mensagem: e.message, campos }
}

/* ---------- Provider ---------- */

export function AppProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [restaurando, setRestaurando] = useState(() => !!api.obterToken())
  const [carregando, setCarregando] = useState(false)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [semConexao, setSemConexao] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [processos, setProcessos] = useState<Processo[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [alertasDTO, setAlertasDTO] = useState<api.AlertaDTO[]>([])
  const [toast, setToast] = useState<ToastData | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const carga = useRef(0)

  const notificar = useCallback((message: string, tone: ToastData['tone'] = 'sucesso') => {
    const t = { id: Date.now(), message, tone }
    setToast(t)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast((x) => (x?.id === t.id ? null : x)), 5000)
  }, [])

  const limpar = useCallback(() => {
    carga.current++
    setUsuario(null)
    setUsuarios([])
    setProcessos([])
    setLotes([])
    setAlertasDTO([])
    setErroCarga(null)
    setCarregando(false)
  }, [])

  const carregarDados = useCallback(async (u: Usuario) => {
    const minha = ++carga.current
    const gestor = u.perfil === 'gestor'
    setCarregando(true)
    setErroCarga(null)
    try {
      const [ps, ls, as, us] = await Promise.all([
        api.listarProcessos(),
        api.listarLotes(),
        gestor ? api.listarAlertas() : Promise.resolve([]),
        gestor ? api.listarUsuarios() : Promise.resolve(null),
      ])
      if (minha !== carga.current) return
      setProcessos(ps.map(deProcesso))
      setLotes(ls.map(deLote))
      setAlertasDTO(as)
      setUsuarios(us ? us.map(deUsuario) : [u])
    } catch (e) {
      if (minha === carga.current) setErroCarga(errosDaApi(e).mensagem)
    } finally {
      if (minha === carga.current) setCarregando(false)
    }
  }, [])

  // Recupera a sessão salva ao abrir a página. Token recusado (401) = sessão expirada;
  // servidor fora do ar = mantém o token e mostra "sem conexão", para tentar de novo.
  const restaurar = useCallback(
    (vivo: () => boolean = () => true) => {
      if (!api.obterToken()) return
      setRestaurando(true)
      setSemConexao(false)
      api
        .me()
        .then((dto) => {
          if (!vivo()) return
          const u = deUsuario(dto)
          setUsuario(u)
          void carregarDados(u)
        })
        .catch((e) => {
          if (!vivo()) return
          if (e instanceof api.ApiError && e.status === 401) api.limparSessao()
          else setSemConexao(true)
        })
        .finally(() => vivo() && setRestaurando(false))
    },
    [carregarDados],
  )

  useEffect(() => {
    let vivo = true
    restaurar(() => vivo)
    return () => {
      vivo = false
    }
  }, [restaurar])

  // O servidor recusou o token (expirou ou o acesso foi desativado).
  useEffect(() => {
    window.addEventListener(api.EVENTO_SESSAO_EXPIRADA, limpar)
    return () => window.removeEventListener(api.EVENTO_SESSAO_EXPIRADA, limpar)
  }, [limpar])

  const alertas = useMemo<Alerta[]>(() => {
    const porId = new Map(lotes.map((l) => [l.id, l]))
    return alertasDTO.map((a) => ({
      id: txt(a.id),
      processoId: txt(a.processoId),
      lotes: a.loteIds.map((i) => porId.get(txt(i))).filter((l): l is Lote => !!l),
      detectado: new Date(a.detectado),
      status: a.status,
    }))
  }, [alertasDTO, lotes])

  const value: Ctx = {
    usuario,
    restaurando,
    semConexao,
    tentarConectar: () => restaurar(),
    carregando,
    erroCarga,
    recarregar: () => {
      if (usuario) void carregarDados(usuario)
    },
    entrar: async (login, senha) => {
      try {
        const s = await api.login({ usuario: login.trim(), senha })
        const u = deUsuario(s.usuario)
        setUsuario(u)
        void carregarDados(u)
        return u
      } catch (e) {
        if (e instanceof api.ApiError && e.status === 401) return null
        throw e
      }
    },
    sair: () => {
      void api.logout()
      limpar()
    },
    usuarios,
    criarUsuario: async (u) => {
      const novo = deUsuario(await api.criarUsuario(u))
      setUsuarios((us) => [...us, novo])
      return novo
    },
    atualizarUsuario: async (id, dados) => {
      const u = deUsuario(await api.atualizarUsuario(Number(id), dados))
      setUsuarios((us) => us.map((x) => (x.id === id ? u : x)))
      setUsuario((x) => (x && x.id === id ? u : x))
    },
    definirAtivo: async (id, ativo) => {
      const u = deUsuario(await api.definirAtivo(Number(id), ativo))
      setUsuarios((us) => us.map((x) => (x.id === id ? u : x)))
    },
    redefinirSenha: async (id, senha) => {
      await api.redefinirSenha(Number(id), senha)
    },
    processos,
    salvarProcesso: async ({ id, ...dados }) => {
      const p = deProcesso(await api.salvarProcesso({ ...dados, id: id ? Number(id) : undefined }))
      setProcessos((ps) => (ps.some((x) => x.id === p.id) ? ps.map((x) => (x.id === p.id ? p : x)) : [...ps, p]))
      return p
    },
    lotes,
    registrarLote: async ({ processoId, pecas, litros }) => {
      const l = deLote(await api.registrarLote({ processoId: Number(processoId), pecas, litros }, Number(usuario?.id)))
      setLotes((ls) => [l, ...ls])
      // O servidor pode ter aberto ou atualizado um alerta com este lote.
      if (usuario?.perfil === 'gestor') api.listarAlertas().then(setAlertasDTO, () => {})
      return l
    },
    alertas,
    mudarStatusAlerta: async (id, s) => {
      const a = await api.mudarStatusAlerta(Number(id), s)
      setAlertasDTO((as) => as.map((x) => (x.id === a.id ? a : x)))
    },
    toast,
    notificar,
    fecharToast: () => setToast(null),
    nomeProcesso: (id) => processos.find((p) => p.id === id)?.nome ?? id,
    nomeUsuario: (id) => usuarios.find((u) => u.id === id)?.nome ?? '—',
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

/* ---------- Auxiliares das telas ---------- */

/**
 * Estado visual da tela. Carregamento e erro reais têm prioridade sobre o seletor "Estado (protótipo)".
 * "Tentar novamente" (setEstado('dados')) recarrega os dados quando houve erro real.
 */
export function useEstadoTela(extra?: { carregando?: boolean; erro?: boolean; recarregar?: () => void }) {
  const { carregando, erroCarga, recarregar } = useApp()
  const [previa, setPrevia] = useState<ViewState>('dados')
  const estado: ViewState = carregando || extra?.carregando ? 'carregando' : erroCarga || extra?.erro ? 'erro' : previa
  const setEstado = (v: ViewState) => {
    setPrevia(v)
    if (v === 'dados') {
      if (erroCarga) recarregar()
      if (extra?.erro) extra.recarregar?.()
    }
  }
  return [estado, setEstado] as const
}

/** Resumo mensal por processo (Dashboard e Relatórios). */
export function useResumo(mes: number, ano: number) {
  const [r, setR] = useState<{ dados: Resumo[]; carregando: boolean; erro: boolean }>({ dados: [], carregando: true, erro: false })
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    let vivo = true
    setR((x) => ({ ...x, carregando: true, erro: false }))
    api.resumoDoMes(mes, ano).then(
      (dados) => vivo && setR({ dados: dados.map(deResumo), carregando: false, erro: false }),
      () => vivo && setR({ dados: [], carregando: false, erro: true }),
    )
    return () => {
      vivo = false
    }
  }, [mes, ano, versao])
  return { ...r, recarregar: () => setVersao((v) => v + 1) }
}

/** Lotes do mês em America/Recife, para os gráficos por dia. */
export function useLotesDoMes(mes: number, ano: number) {
  const [r, setR] = useState<{ dados: Lote[]; carregando: boolean; erro: boolean }>({ dados: [], carregando: true, erro: false })
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    let vivo = true
    setR((x) => ({ ...x, carregando: true, erro: false }))
    api.listarLotes(limitesDoMes(mes, ano)).then(
      (dados) => vivo && setR({ dados: dados.map(deLote), carregando: false, erro: false }),
      () => vivo && setR({ dados: [], carregando: false, erro: true }),
    )
    return () => {
      vivo = false
    }
  }, [mes, ano, versao])
  return { ...r, recarregar: () => setVersao((v) => v + 1) }
}

/** Mês corrente: no modo simulado, o mês dos dados de exemplo; com a API, o mês atual em America/Recife. */
export function periodoAtual(): { mes: number; ano: number } {
  if (api.USAR_MOCK) return { mes: MES_ATUAL, ano: ANO_ATUAL }
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', year: 'numeric', month: 'numeric' }).formatToParts(new Date())
  const valor = (t: string) => Number(partes.find((p) => p.type === t)?.value)
  return { mes: valor('month'), ano: valor('year') }
}
