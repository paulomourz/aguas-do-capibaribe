/*
 * Limite de requisições da API (RNF19): passando de 5 logins por minuto por IP, ou de 60 lotes por minuto por
 * usuário, a API responde 429 (LIMITE_EXCEDIDO) com o cabeçalho Retry-After em segundos.
 *
 * Aqui fica até quando cada ação está bloqueada. O http.ts registra o bloqueio ao receber o 429 e recusa novos
 * disparos da mesma ação até o prazo acabar, sem ir à rede; as telas leem o tempo restante para a contagem regressiva.
 */

export type EscopoLimite = 'login' | 'lotes'

/** Usado quando não dá para ler o Retry-After: a janela do limite na API é de um minuto. */
export const ESPERA_PADRAO_S = 60

/** Ação limitada pela API para esta requisição (os mesmos casos do FiltroDeLimite do backend). */
export function escopoDaRota(caminho: string, metodo = 'GET'): EscopoLimite | null {
  if (metodo.toUpperCase() !== 'POST') return null
  if (caminho === '/auth/login') return 'login'
  if (caminho === '/lotes') return 'lotes'
  return null
}

/** Segundos do Retry-After: número de segundos ou data HTTP. Ausente ou inválido dá null. */
export function lerRetryAfter(valor: string | null | undefined, agora = Date.now()): number | null {
  const v = valor?.trim()
  if (!v) return null
  if (/^\d+$/.test(v)) return Number(v)
  // Número negativo ou quebrado não é Retry-After válido (e Date.parse leria '-3' como um ano).
  if (/^[-+.\d]+$/.test(v)) return null
  const data = Date.parse(v)
  if (Number.isNaN(data)) return null
  return Math.max(0, Math.ceil((data - agora) / 1000))
}

const CHAVE = 'ac-limite'
const bloqueios = new Map<EscopoLimite, number>()
const ouvintes = new Set<() => void>()

// Recarregar a página não zera a espera (a API continua recusando até o prazo).
try {
  const salvo = JSON.parse(sessionStorage.getItem(CHAVE) ?? '{}') as Partial<Record<EscopoLimite, number>>
  for (const [k, ate] of Object.entries(salvo)) if (typeof ate === 'number' && ate > Date.now()) bloqueios.set(k as EscopoLimite, ate)
} catch {
  /* sem sessionStorage (testes, janela restrita): só em memória */
}

function salvar() {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(Object.fromEntries(bloqueios)))
  } catch {
    /* idem */
  }
}

function avisar() {
  for (const f of ouvintes) f()
}

/** Bloqueia a ação por `segundos` a partir de agora. Só estende: um prazo mais curto não encurta um mais longo. */
export function registrarBloqueio(escopo: EscopoLimite, segundos: number, agora = Date.now()) {
  const ate = agora + Math.max(1, segundos) * 1000
  if ((bloqueios.get(escopo) ?? 0) >= ate) return
  bloqueios.set(escopo, ate)
  salvar()
  avisar()
}

/** Segundos que faltam para liberar a ação (0 = liberada). */
export function segundosRestantes(escopo: EscopoLimite, agora = Date.now()): number {
  const ate = bloqueios.get(escopo)
  if (!ate) return 0
  if (ate <= agora) {
    bloqueios.delete(escopo)
    salvar()
    return 0
  }
  return Math.ceil((ate - agora) / 1000)
}

export const estaBloqueado = (escopo: EscopoLimite, agora = Date.now()) => segundosRestantes(escopo, agora) > 0

/** Avisa quando um bloqueio novo começa (o fim é percebido pela contagem). */
export function assinarLimite(f: () => void): () => void {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}

/** Só para testes. */
export function _limparBloqueios() {
  bloqueios.clear()
  salvar()
  avisar()
}
