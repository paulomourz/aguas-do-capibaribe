import type { BrowserContext, Route } from '@playwright/test'

/**
 * API falsa com o mesmo contrato da real para o que o operador usa (login, me, processos, lotes),
 * incluindo a Idempotency-Key do POST /lotes (201 na 1ª vez, 200 com o mesmo lote nas seguintes).
 *
 * `rede` simula a Wi-Fi da lavanderia:
 *  - 'ok'            responde normalmente
 *  - 'fora'          a requisição nem chega (como sem Wi-Fi)
 *  - 'perdeResposta' a API grava o lote, mas a resposta se perde no caminho (o pior caso para duplicar)
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
const PROCESSOS = [
  { id: 1, nome: 'Amaciamento', unidade: 'lote', meta: 800 },
  { id: 2, nome: 'Estonagem', unidade: 'peca', meta: 12 },
]

export async function instalarApiFalsa(context: BrowserContext) {
  const estado = {
    rede: 'ok' as Rede,
    lotes: [] as Lote[],
    porChave: new Map<string, Lote>(),
    /** Todo POST /lotes que chegou ao servidor, com a chave usada. */
    postsRecebidos: [] as (string | null)[],
  }

  const json = (route: Route, status: number, corpo: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) })

  await context.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const caminho = url.pathname.replace(/^\/api/, '')

    if (estado.rede === 'fora') return route.abort('internetdisconnected')

    if (caminho === '/auth/login' && req.method() === 'POST') return json(route, 200, { token: 'token-de-teste', usuario: OPERADOR })
    if (caminho === '/auth/me') return json(route, 200, OPERADOR)
    if (caminho === '/processos') return json(route, 200, PROCESSOS)
    if (caminho === '/lotes' && req.method() === 'GET') return json(route, 200, [...estado.lotes].reverse())

    if (caminho === '/lotes' && req.method() === 'POST') {
      const chave = req.headers()['idempotency-key'] ?? null
      estado.postsRecebidos.push(chave)
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
