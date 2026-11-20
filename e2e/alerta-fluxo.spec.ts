import { expect, test, type BrowserContext, type Page, type Route, type TestInfo } from '@playwright/test'

/*
 * Fluxo de alerta de ponta a ponta, com vídeo e screenshot de cada passo (ficam em test-results/).
 *
 * Correspondência com a atividade, segundo as regras atuais do sistema:
 *  - "seleção de linha fabril": escolha do processo executado na máquina (linhas de lavagem são o RF31, adiado);
 *  - "injeção de leitura excedente": 3 lotes seguidos de Tingimento acima de +8% (críticos), que abrem o alerta;
 *  - "Reconhecer Alerta": alertas são do gestor (o operador recebe 403), então o operador registra os lotes e o
 *    gestor marca o alerta como resolvido ("Marcar como resolvido" → "Confirmar resolução");
 *  - "log de auditoria": o sistema não tem auditoria de alertas; o teste confere que a mudança para resolvido foi
 *    enviada e gravada pela API, com data e hora e quem a fez.
 *
 * A API é simulada aqui mesmo, com o contrato da real para estas rotas.
 */

test.use({ video: 'on' })

const PROCESSOS = [
  { id: 1, nome: 'Amaciamento', unidade: 'lote', meta: 800 },
  { id: 3, nome: 'Tingimento', unidade: 'lote', meta: 1500 },
]
const USUARIOS = {
  'operador.teste': { id: 3, nome: 'Operadora Teste', usuario: 'operador.teste', perfil: 'operador', ativo: true },
  'gestor.teste': { id: 2, nome: 'Gestora Teste', usuario: 'gestor.teste', perfil: 'gestor', ativo: true },
} as const
type Usuario = (typeof USUARIOS)[keyof typeof USUARIOS]

type LoteFalso = {
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
type AlertaFalso = { id: number; processoId: number; loteIds: number[]; detectado: string; status: string }
type Estado = {
  lotes: LoteFalso[]
  alertas: AlertaFalso[]
  /** Mudanças de status gravadas pela API (PATCH /alertas/{id}/status). */
  mudancas: { alertaId: number; status: string; usuario: string; data: string }[]
  logado: Usuario | null
}

const json = (route: Route, status: number, corpo: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) })

function conformidade(desvio: number) {
  if (desvio <= 0) return 'DENTRO_DA_META'
  if (desvio <= 8) return 'ATENCAO'
  return 'CRITICO'
}

function registrarLote(route: Route, estado: Estado, usuario: Usuario) {
  const corpo = route.request().postDataJSON() as { processoId: number; pecas: number; litros: number }
  const p = PROCESSOS.find((x) => x.id === corpo.processoId)
  if (!p) return json(route, 404, { codigo: 'NAO_ENCONTRADO', mensagem: 'Processo não encontrado.' })
  const esperado = p.unidade === 'peca' ? p.meta * corpo.pecas : p.meta
  const desvio = Math.round(((corpo.litros - esperado) / esperado) * 10000) / 100
  const lote = {
    id: estado.lotes.length + 1,
    ...corpo,
    esperado,
    desvio,
    statusConformidade: conformidade(desvio),
    data: new Date().toISOString(),
    usuarioId: usuario.id,
  }
  estado.lotes.push(lote)
  // Regra de alerta da API: 3 lotes seguidos do mesmo processo acima da meta.
  const doProcesso = estado.lotes.filter((l) => l.processoId === lote.processoId).slice(-3)
  if (doProcesso.length === 3 && doProcesso.every((l) => l.desvio > 0)) {
    estado.alertas.push({
      id: estado.alertas.length + 1,
      processoId: lote.processoId,
      loteIds: doProcesso.map((l) => l.id),
      detectado: new Date().toISOString(),
      status: 'aberto',
    })
  }
  return json(route, 201, lote)
}

function rotaDeAlertas(route: Route, estado: Estado, usuario: Usuario, caminho: string) {
  if (usuario.perfil === 'operador') return json(route, 403, { codigo: 'ACESSO_NEGADO', mensagem: 'Acesso negado.' })
  const metodo = route.request().method()
  if (caminho === '/alertas' && metodo === 'GET') return json(route, 200, estado.alertas)
  const mudar = /^\/alertas\/(\d+)\/status$/.exec(caminho)
  const alerta = mudar ? estado.alertas.find((a) => a.id === Number(mudar[1])) : undefined
  if (!alerta || metodo !== 'PATCH') return json(route, 404, { codigo: 'NAO_ENCONTRADO', mensagem: 'Alerta não encontrado.' })
  const { status } = route.request().postDataJSON() as { status: string }
  alerta.status = status
  estado.mudancas.push({ alertaId: alerta.id, status, usuario: usuario.usuario, data: new Date().toISOString() })
  return json(route, 200, alerta)
}

function entrarNaApi(route: Route, estado: Estado) {
  const { usuario } = route.request().postDataJSON() as { usuario: keyof typeof USUARIOS }
  estado.logado = USUARIOS[usuario]
  return json(route, 200, { token: `token-${usuario}`, usuario: estado.logado })
}

async function instalarApi(context: BrowserContext) {
  const estado: Estado = { lotes: [], alertas: [], mudancas: [], logado: null }

  await context.route('**/api/**', async (route) => {
    const req = route.request()
    const caminho = new URL(req.url()).pathname.replace(/^\/api/, '')
    const leitura = req.method() === 'GET'

    if (caminho === '/auth/login') return entrarNaApi(route, estado)
    if (caminho === '/processos') return json(route, 200, PROCESSOS)
    if (caminho === '/usuarios') return json(route, 200, Object.values(USUARIOS))
    const usuario = estado.logado
    if (!usuario) return json(route, 401, { codigo: 'NAO_AUTENTICADO', mensagem: 'Faça login.' })
    if (caminho === '/auth/me') return json(route, 200, usuario)
    if (caminho === '/lotes') return leitura ? json(route, 200, [...estado.lotes].reverse()) : registrarLote(route, estado, usuario)
    if (caminho.startsWith('/alertas')) return rotaDeAlertas(route, estado, usuario, caminho)
    return json(route, 404, { codigo: 'NAO_ENCONTRADO', mensagem: 'Recurso não encontrado.' })
  })

  return estado
}

async function capturar(page: Page, testInfo: TestInfo, nome: string) {
  await page.screenshot({ path: testInfo.outputPath(`${nome}.png`), animations: 'disabled' })
}

async function entrar(page: Page, usuario: string) {
  await page.goto('/')
  await page.locator('#usuario').fill(usuario)
  await page.locator('#senha').fill('qualquer-senha')
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('lote acima de +8% abre o alerta, o gestor resolve e o card passa para Resolvido', async ({ page, context }, testInfo) => {
  const api = await instalarApi(context)

  await test.step('1. Login do operador', async () => {
    await entrar(page, 'operador.teste')
    await expect(page.getByRole('heading', { name: 'Registro de lote' })).toBeVisible()
    await capturar(page, testInfo, '01-operador-logado')
  })

  await test.step('2. Seleção do processo e injeção de 3 leituras acima de +8%', async () => {
    for (const [i, litros] of [1650, 1680, 1700].entries()) {
      if (i > 0) await page.getByRole('button', { name: 'Registrar novo lote' }).click()
      await page.locator('#processo').selectOption('3')
      await page.locator('#pecas').fill('60')
      await page.locator('#litros').fill(String(litros))
      if (i === 0) await capturar(page, testInfo, '02-processo-e-leitura')
      await page.getByRole('button', { name: 'Registrar lote' }).click()
      await page.getByRole('button', { name: 'Confirmar registro' }).click()
      await expect(page.getByRole('heading', { name: `Lote ${i + 1} registrado` })).toBeVisible()
    }
    await capturar(page, testInfo, '03-terceiro-lote-critico')
    expect(api.lotes.map((l) => l.statusConformidade)).toEqual(['CRITICO', 'CRITICO', 'CRITICO'])
    expect(api.lotes.every((l) => l.desvio > 8)).toBe(true)
    expect(api.alertas).toHaveLength(1)
  })

  await test.step('3. Gestor abre o alerta', async () => {
    await page.getByRole('button', { name: /Operadora Teste/ }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await entrar(page, 'gestor.teste')
    await page.getByRole('link', { name: 'Alertas' }).first().click()
    const card = page.getByRole('tabpanel', { name: 'Abertos' }).getByRole('article')
    await expect(card).toHaveCount(1)
    await expect(card.getByRole('heading', { name: 'Tingimento' })).toBeVisible()
    await expect(card.getByText('Aberto', { exact: true })).toBeVisible()
    await capturar(page, testInfo, '04-alerta-aberto')
    await card.getByRole('link', { name: /Ver detalhe/ }).click()
    await expect(page.getByRole('heading', { name: 'Tingimento · 3 lotes acima da meta' })).toBeVisible()
    await capturar(page, testInfo, '05-detalhe-do-alerta')
  })

  await test.step('4. Gestor reconhece o alerta e confirma a resolução', async () => {
    await page.getByRole('button', { name: 'Marcar como resolvido' }).click()
    const modal = page.getByRole('dialog', { name: 'Marcar alerta como resolvido?' })
    await expect(modal).toBeVisible()
    await capturar(page, testInfo, '06-modal-de-confirmacao')
    await modal.getByRole('button', { name: 'Confirmar resolução' }).click()
  })

  await test.step('5. Card em Resolvido e mudança gravada na API', async () => {
    const card = page.getByRole('tabpanel', { name: 'Resolvidos' }).getByRole('article')
    await expect(card).toHaveCount(1)
    await expect(card.getByText('Resolvido', { exact: true })).toBeVisible()
    await expect(card.getByText('Alerta 1', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: /Abertos/ }).click()
    await expect(page.getByText('Nenhum alerta aberto')).toBeVisible()
    await page.getByRole('tab', { name: /Resolvidos/ }).click()
    await expect(card).toHaveCount(1)
    await capturar(page, testInfo, '07-card-resolvido')

    expect(api.alertas[0].status).toBe('resolvido')
    expect(api.mudancas).toHaveLength(1)
    expect(api.mudancas[0]).toMatchObject({ alertaId: 1, status: 'resolvido', usuario: 'gestor.teste' })
    expect(Number.isNaN(Date.parse(api.mudancas[0].data))).toBe(false)
  })
})
