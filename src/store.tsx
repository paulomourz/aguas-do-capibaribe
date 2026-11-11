import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Context, type ReactNode } from 'react'
import type { ToastData, ViewState } from './components/ui'
import { limitesDoMes, statusDaApi, type Alerta, type AlertaStatus, type Lote, type Perfil, type Processo, type Resumo, type Unidade, type Usuario } from './domain'
import * as api from './services'

/*
 * Estado global da aplicação. Todos os dados passam por src/services, que chama a API REST.
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
  /** Troca o token de API de uma conta de sensor e devolve a chave nova, que não fica guardada no site. */
  rotacionarToken: (id: string) => Promise<string>
  atualizarUsuario: (id: string, dados: { nome?: string; senha?: string; senhaAtual?: string }) => Promise<void>
  processos: Processo[]
  salvarProcesso: (p: { id?: string; nome: string; unidade: Unidade; meta: number }) => Promise<Processo>
  lotes: Lote[]
  /**
   * Guarda o lote no aparelho (IndexedDB) e tenta enviar. Sem conexão, devolve `pendente` e o lote é
   * enviado sozinho quando a conexão voltar. Se a API recusar o lote, lança o erro (como antes).
   */
  registrarLote: (l: { processoId: string; pecas: number; litros: number }) => Promise<ResultadoRegistro>
  /** Lotes deste usuário guardados no aparelho, do mais antigo ao mais novo. */
  pendentes: api.LotePendente[]
  /** Lotes de outras pessoas guardados neste aparelho (enviados quando elas entrarem). */
  pendentesDeOutros: number
  /** Enviando a fila agora. */
  sincronizando: boolean
  /** O último contato com a API funcionou (e o navegador diz que está online). */
  conectado: boolean
  /** Entrou sem conexão, com a sessão e os dados guardados da última vez. */
  modoOffline: boolean
  /** Lotes que estavam na fila e já chegaram à API nesta sessão (chave → lote). */
  enviadosAgora: Record<string, Lote>
  enviarPendentes: () => Promise<void>
  tentarDeNovo: (chave: string) => Promise<void>
  descartarPendente: (chave: string) => Promise<void>
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

export type ResultadoRegistro = { tipo: 'enviado'; lote: Lote } | { tipo: 'pendente'; pendente: api.LotePendente }

/** De quanto em quanto tempo tenta de novo enquanto houver lote na fila ou sessão offline. */
export const INTERVALO_REENVIO_MS = 20_000

/** Avisa as outras abas que a fila mudou. */
const canalFila = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('aguas-fila') : null
const avisarAbas = () => canalFila?.postMessage('mudou')

/** Erros de armazenamento local nunca podem impedir o uso do site com conexão. */
const semFalhar = async <T,>(f: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await f()
  } catch {
    return undefined
  }
}

export const homeDe = (p: Perfil) => (p === 'operador' ? '/registro' : '/dashboard')

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
  const [pendentes, setPendentes] = useState<api.LotePendente[]>([])
  const [pendentesDeOutros, setPendentesDeOutros] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [conectado, setConectado] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [modoOffline, setModoOffline] = useState(false)
  const [enviadosAgora, setEnviadosAgora] = useState<Record<string, Lote>>({})
  const timer = useRef<number | undefined>(undefined)
  const carga = useRef(0)
  const usuarioRef = useRef<Usuario | null>(null)
  usuarioRef.current = usuario
  const modoOfflineRef = useRef(modoOffline)
  modoOfflineRef.current = modoOffline
  const temFilaRef = useRef(false)
  temFilaRef.current = pendentes.some((p) => p.estado === 'pendente')

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
    setPendentes([])
    setPendentesDeOutros(0)
    setModoOffline(false)
    setEnviadosAgora({})
  }, [])

  /** Junta lotes novos à lista sem repetir (um reenvio devolve o mesmo id). */
  const juntarLotes = useCallback((novos: Lote[]) => {
    if (!novos.length) return
    setLotes((ls) => {
      const ids = new Set(novos.map((l) => l.id))
      return [...novos, ...ls.filter((l) => !ids.has(l.id))].sort((a, b) => b.data.getTime() - a.data.getTime())
    })
  }, [])

  /** Guarda sessão (só o hash do token), processos e lotes para abrir o site sem conexão. */
  const salvarParaOffline = useCallback(async (u: api.UsuarioDTO, ps: api.ProcessoDTO[], ls: api.LoteDTO[]) => {
    const token = api.obterToken()
    const hashToken = token ? await api.hashDoToken(token) : null
    if (!hashToken) return
    await api.salvarCache('sessao', { hashToken, usuario: u })
    await api.salvarCache('processos', ps)
    await api.salvarCache('lotes', ls)
  }, [])

  /** Usa os dados guardados se a sessão guardada for a mesma do token atual. */
  const entrarComCache = useCallback(async (): Promise<Usuario | null> => {
    const token = api.obterToken()
    if (!token) return null
    const [hash, sessao, ps, ls] = await Promise.all([
      api.hashDoToken(token),
      api.lerCache('sessao'),
      api.lerCache('processos'),
      api.lerCache('lotes'),
    ])
    if (!hash || !sessao || sessao.hashToken !== hash) return null
    const u = deUsuario(sessao.usuario)
    setUsuario(u)
    setProcessos((ps ?? []).map(deProcesso))
    setLotes((ls ?? []).map(deLote))
    setUsuarios([u])
    setModoOffline(true)
    setConectado(false)
    return u
  }, [])

  const carregarDados = useCallback(
    async (u: Usuario) => {
      const minha = ++carga.current
      const gestor = u.perfil !== 'operador'
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
        setModoOffline(false)
        setConectado(true)
        const dto = { id: Number(u.id), nome: u.nome, usuario: u.usuario, perfil: u.perfil, ativo: u.ativo }
        void semFalhar(() => salvarParaOffline(dto, ps, ls))
      } catch (e) {
        if (minha !== carga.current) return
        // A Wi-Fi caiu entre o login e a carga: segue com os dados guardados, se houver.
        if (e instanceof api.ApiError && e.status === 0) {
          setConectado(false)
          const [ps, ls] = await Promise.all([semFalhar(() => api.lerCache('processos')), semFalhar(() => api.lerCache('lotes'))])
          if (minha === carga.current && ps?.length) {
            setProcessos(ps.map(deProcesso))
            setLotes((ls ?? []).map(deLote))
            setUsuarios([u])
            setModoOffline(true)
            return
          }
        }
        setErroCarga(errosDaApi(e).mensagem)
      } finally {
        if (minha === carga.current) setCarregando(false)
      }
    },
    [salvarParaOffline],
  )

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
        .catch(async (e) => {
          if (!vivo()) return
          if (e instanceof api.ApiError && e.status === 401) {
            api.limparSessao()
            return
          }
          // Sem conexão: abre com a sessão e os dados guardados, para registrar lotes mesmo assim.
          const u = await semFalhar(entrarComCache)
          if (vivo() && !u) setSemConexao(true)
        })
        .finally(() => vivo() && setRestaurando(false))
    },
    [carregarDados, entrarComCache],
  )

  /* ---------- Fila de lotes sem conexão ---------- */

  const atualizarPendentes = useCallback(async () => {
    const u = usuarioRef.current
    if (!u) return
    const [lista, outros] = await Promise.all([
      semFalhar(() => api.listarPendentes(Number(u.id))),
      semFalhar(() => api.contarPendentesDeOutros(Number(u.id))),
    ])
    if (usuarioRef.current?.id !== u.id) return
    setPendentes(lista ?? [])
    setPendentesDeOutros(outros ?? 0)
  }, [])

  /** Saiu do modo offline? Confere a sessão na API e recarrega os dados de verdade. */
  const reconectar = useCallback(async () => {
    const u = usuarioRef.current
    if (!u) return
    try {
      const dto = await api.me()
      const novo = deUsuario(dto)
      setUsuario(novo)
      setConectado(true)
      await carregarDados(novo)
    } catch (e) {
      // 401: o http.ts já limpou a sessão e foi para "sessão expirada". Os lotes continuam guardados.
      if (e instanceof api.ApiError && e.status === 0) setConectado(false)
    }
  }, [carregarDados])

  /**
   * Envia a fila. `chaveSilenciosa`: o lote que o operador acabou de registrar (a tela já mostra o resultado,
   * não precisa de aviso).
   */
  const sincronizar = useCallback(
    async (chaveSilenciosa?: string): Promise<api.ResultadoSincronizacao | null> => {
      const u = usuarioRef.current
      if (!u) return null
      setSincronizando(true)
      try {
        const r = await api.sincronizarPendentes(Number(u.id))
        if (usuarioRef.current?.id !== u.id) return r
        if (r.enviados.length) {
          const novos = r.enviados.map((e) => deLote(e.lote))
          juntarLotes(novos)
          setEnviadosAgora((x) => ({ ...x, ...Object.fromEntries(r.enviados.map((e, i) => [e.chave, novos[i]])) }))
          setConectado(true)
          if (u.perfil !== 'operador') api.listarAlertas().then(setAlertasDTO, () => {})
          const avisar = r.enviados.filter((e) => e.chave !== chaveSilenciosa).length
          if (avisar) notificar(avisar === 1 ? 'Conexão de volta: 1 lote guardado foi enviado.' : `Conexão de volta: ${avisar} lotes guardados foram enviados.`)
        }
        if (r.parouPor === 'semConexao') setConectado(false)
        const recusados = r.recusados.filter((x) => x.pendente.chave !== chaveSilenciosa).length
        if (recusados) notificar(`${recusados === 1 ? '1 lote guardado foi recusado' : `${recusados} lotes guardados foram recusados`} pelo servidor. Veja em Registro de lotes.`, 'erro')
        if (r.enviados.length || r.recusados.length) avisarAbas()
        return r
      } catch {
        return null
      } finally {
        setSincronizando(false)
        await atualizarPendentes()
      }
    },
    [atualizarPendentes, juntarLotes, notificar],
  )

  /** Uma tentativa completa: se estava offline, reconecta primeiro; depois envia a fila. */
  const tentarAgora = useCallback(async () => {
    if (!usuarioRef.current) return
    await sincronizar()
    if (modoOfflineRef.current) await reconectar()
  }, [sincronizar, reconectar])

  // Ao entrar (ou trocar de usuário): mostra e tenta enviar o que ficou guardado.
  useEffect(() => {
    if (!usuario) return
    void atualizarPendentes().then(() => {
      if (temFilaRef.current) void sincronizar()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id])

  // A conexão voltou, a aba voltou para a frente, ou a cada intervalo enquanto houver fila.
  useEffect(() => {
    if (!usuario) return
    const online = () => {
      setConectado(true)
      void tentarAgora()
    }
    const offline = () => setConectado(false)
    const visivel = () => {
      if (document.visibilityState === 'visible' && (temFilaRef.current || modoOfflineRef.current)) void tentarAgora()
    }
    const intervalo = window.setInterval(() => {
      if (temFilaRef.current || modoOfflineRef.current) void tentarAgora()
    }, INTERVALO_REENVIO_MS)
    const outraAba = () => void atualizarPendentes()
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', visivel)
    canalFila?.addEventListener('message', outraAba)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', visivel)
      canalFila?.removeEventListener('message', outraAba)
      window.clearInterval(intervalo)
    }
  }, [usuario, tentarAgora, atualizarPendentes])

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
        if (s.usuario.perfil === 'sensor') {
          void api.logout()
          throw new api.ApiError(403, { codigo: 'ACESSO_NEGADO', mensagem: 'A conta do sensor só envia dados e não entra no site.' })
        }
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
      // Apaga os dados guardados para abrir offline (computador compartilhado). Os lotes pendentes ficam:
      // são enviados quando a mesma pessoa entrar de novo.
      void semFalhar(api.limparCache)
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
    rotacionarToken: async (id) => (await api.rotacionarToken(Number(id))).token,
    processos,
    salvarProcesso: async ({ id, ...dados }) => {
      const p = deProcesso(await api.salvarProcesso({ ...dados, id: id ? Number(id) : undefined }))
      setProcessos((ps) => (ps.some((x) => x.id === p.id) ? ps.map((x) => (x.id === p.id ? p : x)) : [...ps, p]))
      return p
    },
    lotes,
    registrarLote: async ({ processoId, pecas, litros }) => {
      const u = usuarioRef.current
      if (!u) throw new api.ApiError(401, { codigo: 'NAO_AUTENTICADO', mensagem: 'Sessão expirada.' })
      const pendente: api.LotePendente = {
        chave: api.novaChave(),
        usuarioId: Number(u.id),
        processoId: Number(processoId),
        pecas,
        litros,
        criadoEm: new Date().toISOString(),
        estado: 'pendente',
        tentativas: 0,
      }

      // 1) Caixa de saída: grava no aparelho antes de qualquer envio.
      const guardado = (await semFalhar(async () => (await api.guardarPendente(pendente), true))) ?? false
      if (!guardado) {
        // Sem IndexedDB (janela anônima antiga): envia direto, como antes, ainda com a chave.
        const l = deLote(await api.registrarLote({ processoId: pendente.processoId, pecas, litros }, pendente.chave))
        juntarLotes([l])
        if (u.perfil !== 'operador') api.listarAlertas().then(setAlertasDTO, () => {})
        return { tipo: 'enviado', lote: l }
      }
      avisarAbas()

      // 2) Envia pela mesma fila (na ordem, depois dos que já estavam esperando).
      const r = await sincronizar(pendente.chave)
      const enviado = r?.enviados.find((e) => e.chave === pendente.chave)
      if (enviado) return { tipo: 'enviado', lote: deLote(enviado.lote) }

      // 3) Recusado pela API (ex.: processo inválido): sai da fila e o formulário mostra o erro.
      const recusado = r?.recusados.find((x) => x.pendente.chave === pendente.chave)
      if (recusado) {
        await semFalhar(() => api.removerPendente(pendente.chave))
        await atualizarPendentes()
        avisarAbas()
        throw recusado.erro
      }

      // 4) Sem conexão (ou fila parada antes dele): fica guardado e vai sozinho depois.
      const atual = (await semFalhar(() => api.listarPendentes(pendente.usuarioId)))?.find((p) => p.chave === pendente.chave)
      return { tipo: 'pendente', pendente: atual ?? pendente }
    },
    pendentes,
    pendentesDeOutros,
    sincronizando,
    conectado,
    modoOffline,
    enviadosAgora,
    enviarPendentes: tentarAgora,
    tentarDeNovo: async (chave) => {
      await semFalhar(() => api.atualizarPendente(chave, { estado: 'pendente', ultimoErro: undefined }))
      avisarAbas()
      await atualizarPendentes()
      await sincronizar()
    },
    descartarPendente: async (chave) => {
      await semFalhar(() => api.removerPendente(chave))
      avisarAbas()
      await atualizarPendentes()
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

/** Mês corrente em America/Recife. */
export function periodoAtual(): { mes: number; ano: number } {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', year: 'numeric', month: 'numeric' }).formatToParts(new Date())
  const valor = (t: string) => Number(partes.find((p) => p.type === t)?.value)
  return { mes: valor('month'), ano: valor('year') }
}
