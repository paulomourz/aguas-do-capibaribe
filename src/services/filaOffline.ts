import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Id, LoteDTO, ProcessoDTO, UsuarioDTO } from './tipos'

/*
 * Armazenamento local (IndexedDB) para a Wi-Fi da lavanderia que cai e volta.
 *
 * - lotesPendentes: "caixa de saída". Todo lote registrado no site entra aqui ANTES de ir para a API e só
 *   sai depois que a API confirma. Se a aba fechar, o navegador travar ou a conexão cair no meio do envio,
 *   o lote continua guardado e é reenviado com a MESMA chave (Idempotency-Key), então a API não duplica.
 * - cache: última sessão, processos e lotes vistos, para o operador abrir o site e registrar mesmo se a
 *   página for recarregada sem conexão.
 *
 * Fica no aparelho até ser enviado: sobrevive a fechar o navegador, mas não a "limpar dados do site".
 */

export type EstadoPendente =
  /** Esperando conexão (ou a próxima tentativa). */
  | 'pendente'
  /** A API recusou (dado inválido, processo removido…). Não adianta reenviar; o operador decide. */
  | 'recusado'

export type LotePendente = {
  /** UUID gerado no aparelho; vai no cabeçalho Idempotency-Key e nunca muda entre tentativas. */
  chave: string
  usuarioId: Id
  processoId: Id
  pecas: number
  litros: number
  /** Quando o operador confirmou o registro neste aparelho (ISO 8601). */
  criadoEm: string
  estado: EstadoPendente
  tentativas: number
  ultimaTentativa?: string
  /** Mensagem do último erro, para mostrar ao operador. */
  ultimoErro?: string
}

/** Sessão salva sem o token: só um hash dele, para conferir que é a mesma sessão do sessionStorage. */
export type SessaoSalva = { hashToken: string; usuario: UsuarioDTO }

type Cache = {
  sessao: SessaoSalva
  processos: ProcessoDTO[]
  lotes: LoteDTO[]
}

interface Esquema extends DBSchema {
  lotesPendentes: { key: string; value: LotePendente; indexes: { porUsuario: number } }
  cache: { key: string; value: unknown }
}

const NOME_BANCO = 'aguas-offline'
let conexao: Promise<IDBPDatabase<Esquema>> | null = null

function banco() {
  conexao ??= openDB<Esquema>(NOME_BANCO, 1, {
    upgrade(db) {
      const lotes = db.createObjectStore('lotesPendentes', { keyPath: 'chave' })
      lotes.createIndex('porUsuario', 'usuarioId')
      db.createObjectStore('cache')
    },
    // Outra aba abriu uma versão nova do banco: fecha esta conexão para não bloquear a atualização.
    blocking() {
      void conexao?.then((db) => db.close())
      conexao = null
    },
  }).catch((e) => {
    conexao = null
    throw e
  })
  return conexao
}

/** IndexedDB existe neste navegador? (Pode faltar em janela anônima de navegadores antigos.) */
export const temArmazenamentoLocal = () => typeof indexedDB !== 'undefined'

/** Gera a chave do lote. crypto.randomUUID só existe em HTTPS/localhost; fora disso usa getRandomValues. */
export function novaChave(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/* ---------- Lotes pendentes ---------- */

export async function guardarPendente(p: LotePendente): Promise<void> {
  await (await banco()).put('lotesPendentes', p)
}

export async function atualizarPendente(chave: string, mudanca: Partial<Omit<LotePendente, 'chave'>>): Promise<LotePendente | undefined> {
  const db = await banco()
  const tx = db.transaction('lotesPendentes', 'readwrite')
  const atual = await tx.store.get(chave)
  if (!atual) {
    await tx.done
    return undefined
  }
  const novo = { ...atual, ...mudanca }
  await tx.store.put(novo)
  await tx.done
  return novo
}

export async function removerPendente(chave: string): Promise<void> {
  await (await banco()).delete('lotesPendentes', chave)
}

/** Pendentes de um usuário, do mais antigo ao mais novo (a ordem de envio importa para a regra de alerta). */
export async function listarPendentes(usuarioId: Id): Promise<LotePendente[]> {
  const lista = await (await banco()).getAllFromIndex('lotesPendentes', 'porUsuario', usuarioId)
  return lista.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
}

/** Quantos lotes de OUTROS usuários estão guardados neste aparelho (aparecem só como aviso). */
export async function contarPendentesDeOutros(usuarioId: Id): Promise<number> {
  const todos = await (await banco()).getAll('lotesPendentes')
  return todos.filter((p) => p.usuarioId !== usuarioId).length
}

/* ---------- Cache para abrir sem conexão ---------- */

export async function lerCache<K extends keyof Cache>(chave: K): Promise<Cache[K] | undefined> {
  return (await (await banco()).get('cache', chave)) as Cache[K] | undefined
}

export async function salvarCache<K extends keyof Cache>(chave: K, valor: Cache[K]): Promise<void> {
  await (await banco()).put('cache', valor, chave)
}

export async function limparCache(): Promise<void> {
  await (await banco()).clear('cache')
}

/** SHA-256 do token em hexadecimal. Sem crypto.subtle (HTTP fora de localhost), não há sessão offline. */
export async function hashDoToken(token: string): Promise<string | null> {
  if (!crypto.subtle) return null
  const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(dig)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** Só para os testes: fecha e esquece a conexão. */
export async function _fecharBanco() {
  const c = conexao
  conexao = null
  if (c) (await c).close()
}
