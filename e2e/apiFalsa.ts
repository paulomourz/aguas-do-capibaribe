import type { BrowserContext, Route } from '@playwright/test'

/**
 * API falsa com o mesmo contrato da real para o que o operador usa (login, me, processos, lotes),
 * incluindo a Idempotency-Key do POST /lotes (201 na 1ª vez, 200 com o mesmo lote nas seguintes).
 *
 * `rede` simula a Wi-Fi da lavanderia:
 *  - 'ok'            responde normalmente
 *  - 'fora'          a requisição nem chega (como sem Wi-Fi)
 *  - 'perdeResposta' a API grava o lote, mas a resposta se perde no caminho (o pior caso para duplicar)
 *
 * `limite` simula o RNF19: com segundos definidos para 'login' ou 'lotes', o POST responde 429 (LIMITE_EXCEDIDO)
 * com o cabeçalho Retry-After, como o FiltroDeLimite da API real.
 */
export type Rede = 'ok' | 'fora' | 'perdeResposta'

type Lote = {
  id: number
  processoId: number
  pecas: number
  litros: number
  esperado: number
  desvio: number
  statusConformidade: string
  data: string
  usuarioId: number
}

const OPERADOR = { id: 3, nome: 'Operadora Teste', usuario: 'operador.teste', perfil: 'operador', ativo: true }
const GESTOR = { id: 2, nome: 'Gestora Teste', usuario: 'gestor.teste', perfil: 'gestor', ativo: true }
const PROCESSOS = [
  { id: 1, nome: 'Amaciamento', unidade: 'lote', meta: 800 },
  { id: 2, nome: 'Estonagem', unidade: 'peca', meta: 12 },
]
/** Resumo do mês para as telas do gestor (Dashboard e Relatórios), no formato do GET /relatorios/resumo. */
const RESUMO = [
  { processoId: 1, real: 7600, esperado: 8000, lotes: 10, pecas: 1200, litrosPorPeca: 6.33 },
  { processoId: 2, real: 13500, esperado: 12000, lotes: 9, pecas: 1000, litrosPorPeca: 13.5 },
]

/**
 * `perfil: 'gestor'` faz o login devolver uma gestora e libera as rotas das telas dela (resumo, alertas e usuários),
 * usadas na auditoria de acessibilidade (e2e/acessibilidade.spec.ts).
 */
export async function instalarApiFalsa(context: BrowserContext, opcoes: { perfil?: 'operador' | 'gestor' } = {}) {
  const pessoa = opcoes.perfil === 'gestor' ? GESTOR : OPERADOR
  const estado = {
    rede: 'ok' as Rede,
    lotes: [] as Lote[],
    porChave: new Map<string, Lote>(),
    /** Todo POST /lotes que chegou ao servidor, com a chave usada. */
    postsRecebidos: [] as (string | null)[],
    limite: {} as { login?: number; lotes?: number },
    /** Quantos POST /auth/login chegaram ao servidor. */
    loginsRecebidos: 0,
  }

  const json = (route: Route, status: number, corpo: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) })
  const limiteExcedido = (route: Route, segundos: number) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      headers: { 'Retry-After': String(segundos) },
      body: JSON.stringify({ codigo: 'LIMITE_EXCEDIDO', mensagem: `Muitas tentativas. Aguarde ${segundos} segundos e tente de novo.` }),
    })

  await context.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const caminho = url.pathname.replace(/^\/api/, '')

    if (estado.rede === 'fora') return route.abort('internetdisconnected')

    if (caminho === '/auth/login' && req.method() === 'POST') {
      estado.loginsRecebidos++
      if (estado.limite.login) return limiteExcedido(route, estado.limite.login)
    }
    if (caminho === '/auth/login' && req.method() === 'POST') return json(route, 200, { token: 'token-de-teste', usuario: pessoa })
    if (caminho === '/auth/me') return json(route, 200, pessoa)
    if (caminho === '/processos') return json(route, 200, PROCESSOS)
    if (pessoa === GESTOR) {
      if (caminho === '/relatorios/resumo') return json(route, 200, RESUMO)
      if (caminho === '/alertas') return json(route, 200, [])
      if (caminho === '/usuarios') return json(route, 200, [GESTOR, OPERADOR])
    }
    if (caminho === '/lotes' && req.method() === 'GET') return json(route, 200, [...estado.lotes].reverse())

    if (caminho === '/lotes' && req.method() === 'POST') {
      const chave = req.headers()['idempotency-key'] ?? null
      estado.postsRecebidos.push(chave)
      if (estado.limite.lotes) return limiteExcedido(route, estado.limite.lotes)
      const corpo = req.postDataJSON() as { processoId: number; pecas: number; litros: number }
      let lote = chave ? estado.porChave.get(chave) : undefined
      const repetido = !!lote
      if (!lote) {
        const p = PROCESSOS.find((x) => x.id === corpo.processoId)!
        const esperado = p.unidade === 'peca' ? p.meta * corpo.pecas : p.meta
        const desvio = Math.round(((corpo.litros - esperado) / esperado) * 10000) / 100
        lote = {
          id: estado.lotes.length + 1,
          ...corpo,
          esperado,
          desvio,
          statusConformidade: desvio <= 0 ? 'DENTRO_DA_META' : desvio <= 8 ? 'ATENCAO' : 'CRITICO',
          data: new Date().toISOString(),
          usuarioId: OPERADOR.id,
        }
        estado.lotes.push(lote)
        if (chave) estado.porChave.set(chave, lote)
      }
      if (estado.rede === 'perdeResposta') return route.abort('connectionreset')
      return json(route, repetido ? 200 : 201, lote)
    }

    return json(route, 404, { codigo: 'NAO_ENCONTRADO', mensagem: 'Recurso não encontrado.' })
  })

  return estado
}
