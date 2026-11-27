import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * usePrecosM3 sem navegador: useState e useEffect são trocados por versões mínimas (o efeito roda na hora),
 * e a API do preço do m³ por uma falsa. Cada "rodar" é uma renderização.
 */

const r = vi.hoisted(() => ({ estados: [] as unknown[], i: 0, efeitos: [] as (() => unknown)[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (inicial: unknown) => {
    const i = r.i++
    if (!(i in r.estados)) r.estados[i] = typeof inicial === 'function' ? inicial() : inicial
    return [r.estados[i], (v: unknown) => (r.estados[i] = typeof v === 'function' ? v(r.estados[i]) : v)]
  },
  useEffect: (efeito: () => unknown) => void r.efeitos.push(efeito),
}))

const api = vi.hoisted(() => ({ listarPrecosM3: vi.fn(), cadastrarPrecoM3: vi.fn() }))
vi.mock('../services', async (original) => ({ ...(await original<typeof import('../services')>()), ...api }))

const { usePrecosM3 } = await import('../store')

const DTO = { id: 7, valor: '12.50', vigencia: '2026-11-01', cadastradoPor: 'Gestora', cadastradoEm: '2026-11-24T12:00:00Z' }

/** Renderiza, roda os efeitos e espera as promessas da API. */
async function rodar() {
  r.i = 0
  r.efeitos = []
  const saida = usePrecosM3()
  r.efeitos.forEach((e) => e())
  await new Promise((ok) => setTimeout(ok))
  r.i = 0
  return { antes: saida, depois: usePrecosM3() }
}

beforeEach(() => {
  r.estados = []
  api.listarPrecosM3.mockReset()
  api.cadastrarPrecoM3.mockReset()
})

describe('usePrecosM3', () => {
  it('começa carregando e converte o histórico da API', async () => {
    api.listarPrecosM3.mockResolvedValue([DTO])
    const { antes, depois } = await rodar()
    expect(antes.carregando).toBe(true)
    expect(depois).toMatchObject({ carregando: false, erro: false })
    expect(depois.dados).toEqual([{ id: '7', valor: 12.5, vigencia: '2026-11-01', cadastradoPor: 'Gestora', cadastradoEm: new Date(DTO.cadastradoEm) }])
  })

  it('falha da API: erro, e o tentar de novo volta a carregar', async () => {
    api.listarPrecosM3.mockRejectedValue(new Error('offline'))
    const { depois } = await rodar()
    expect(depois).toMatchObject({ dados: [], carregando: false, erro: true })

    api.listarPrecosM3.mockResolvedValue([DTO])
    depois.recarregar()
    r.i = 0
    r.efeitos = []
    usePrecosM3()
    r.efeitos.forEach((e) => e())
    r.i = 0
    expect(usePrecosM3()).toMatchObject({ carregando: true, erro: false })
  })

  it('cadastrar devolve o preço salvo e pede o histórico de novo', async () => {
    api.listarPrecosM3.mockResolvedValue([])
    const { depois } = await rodar()
    api.cadastrarPrecoM3.mockResolvedValue(DTO)
    expect(await depois.cadastrar({ valor: 12.5, vigencia: '2026-11-01' })).toMatchObject({ id: '7', valor: 12.5 })
    expect(api.cadastrarPrecoM3).toHaveBeenCalledWith({ valor: 12.5, vigencia: '2026-11-01' })

    api.listarPrecosM3.mockResolvedValue([DTO])
    const { depois: recarregado } = await rodar()
    expect(api.listarPrecosM3).toHaveBeenCalledTimes(2)
    expect(recarregado.dados).toHaveLength(1)
  })

  it('resposta que chega depois de sair da tela é descartada', async () => {
    let responder: (v: unknown) => void = () => {}
    api.listarPrecosM3.mockReturnValue(new Promise((ok) => (responder = ok)))
    r.i = 0
    r.efeitos = []
    usePrecosM3()
    const limpar = r.efeitos.map((e) => e())[0] as () => void
    limpar()
    responder([DTO])
    await new Promise((ok) => setTimeout(ok))
    r.i = 0
    expect(usePrecosM3()).toMatchObject({ dados: [], carregando: true })
  })
})
