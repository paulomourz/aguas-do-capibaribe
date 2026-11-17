// Teste de carga de um turno da lavanderia (issue #165, RNF02): 120 sensores enviando uma leitura a cada 2 segundos,
// com rampa de entrada, platô e dois picos repentinos de lavagem química. Mede o p95, as requisições por segundo e o
// pool de conexões do banco (HikariCP) ao longo do turno, e grava um relatório HTML.
// Como rodar: docs/tecnico/teste-carga.md. Use só o ambiente descartável, porque lotes não podem ser apagados.
import http from 'k6/http'
import exec from 'k6/execution'
import { check, sleep } from 'k6'
import { Counter, Gauge, Rate, Trend } from 'k6/metrics'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js'
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

const API = __ENV.API_URL || 'http://backend:8080/api'
const SENHA_ADMIN = open('/segredos/admin').trim()
const JSON_CAB = { 'Content-Type': 'application/json' }

// Critério da issue: p95 abaixo de 250 ms na carga máxima e nenhuma resposta 5xx.
const META_P95 = Number(__ENV.META_P95_MS || 250)
const SENSORES = 120
const INTERVALO_S = 2 // cada sensor manda uma leitura a cada 2 s
const BASE = SENSORES / INTERVALO_S // 60 leituras por segundo no regime normal
const PICO = BASE * 3 // na lavagem química, cada sensor manda a cada ~0,67 s
// ESCALA_TEMPO encurta o turno para um ensaio rápido (ex.: 0.2); o padrão é o turno completo de ~10 min.
const ESCALA = Number(__ENV.ESCALA_TEMPO || 1)

// O turno, em etapas: [fase, duração em s, leituras por segundo ao fim da etapa].
const TURNO = [
  ['rampa', 60, BASE], //     sensores entram no turno
  ['plato', 180, BASE], //    regime normal
  ['pico', 10, PICO], //      começa a lavagem química (subida repentina)
  ['pico', 60, PICO],
  ['plato', 10, BASE], //     fim da lavagem
  ['plato', 120, BASE],
  ['pico', 10, PICO], //      segunda lavagem química
  ['pico', 60, PICO],
  ['plato', 10, BASE],
  ['plato', 60, BASE],
  ['rampa', 30, 0], //        fim do turno
].map(([fase, s, alvo]) => ({ fase, s: Math.max(1, Math.round(s * ESCALA)), alvo }))
const DURACAO_S = TURNO.reduce((t, e) => t + e.s, 0)
// Leituras previstas no turno (área sob a curva de leituras por segundo: cada etapa vai linear do alvo anterior ao seu).
const PREVISTAS = TURNO.reduce((a, e) => ({ total: a.total + ((a.ant + e.alvo) / 2) * e.s, ant: e.alvo }), { total: 0, ant: 0 }).total
// Leitura que não sai no horário porque os 120 sensores estão esperando resposta. O ESP32 guarda a leitura no buffer
// e reenvia depois, então algumas atrasadas não perdem dado; acima de 1% do turno, a API não acompanhou o ritmo.
const TOLERANCIA_ATRASO = 0.01
const MAX_ATRASADAS = Math.floor(PREVISTAS * TOLERANCIA_ATRASO)
const FASES = ['rampa', 'plato', 'pico']

// Em que fase do turno estamos, pelo tempo desde o início do cenário.
function faseAgora() {
  let t = (Date.now() - exec.scenario.startTime) / 1000
  for (const e of TURNO) {
    if (t < e.s) return e.fase
    t -= e.s
  }
  return 'rampa'
}

const leiturasAceitas = new Counter('leituras_aceitas')
const respostas5xx = new Rate('respostas_5xx')
const poolAtivas = new Trend('pool_conexoes_ativas')
const poolEmEspera = new Trend('pool_pedidos_em_espera')
const poolMaximo = new Gauge('pool_conexoes_maximas')
const poolEsperaMedia = new Gauge('pool_espera_media_ms')
const poolMaiorEspera = new Gauge('pool_maior_espera_ms')
const poolEsgotados = new Gauge('pool_pedidos_esgotados')

const porFase = (metrica, regra) => Object.fromEntries(FASES.map((f) => [`${metrica}{fase:${f}}`, [regra]]))

export const options = {
  scenarios: {
    // Modelo aberto: as leituras chegam no ritmo do turno mesmo se a API demorar. Com no máximo 120 VUs, nunca há
    // mais que 120 sensores esperando resposta ao mesmo tempo; se não der conta, o k6 conta dropped_iterations.
    sensores: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: SENSORES,
      maxVUs: SENSORES,
      stages: TURNO.map((e) => ({ duration: `${e.s}s`, target: e.alvo })),
      gracefulStop: '10s',
      exec: 'sensor',
    },
    // Um leitor do Actuator, a cada 2 s, para ver o pool do banco durante o turno (e não só no fim).
    pool: {
      executor: 'constant-vus',
      vus: 1,
      duration: `${DURACAO_S}s`,
      gracefulStop: '5s',
      exec: 'monitorarPool',
    },
  },
  thresholds: {
    'respostas_5xx': ['rate==0'],
    'http_req_failed{tipo:leitura}': ['rate==0'],
    'http_req_duration{tipo:leitura}': [`p(95)<${META_P95}`],
    ...Object.fromEntries(FASES.map((f) => [`http_req_duration{tipo:leitura,fase:${f}}`, [`p(95)<${META_P95}`]])),
    // Leituras que não saíram no horário por falta de sensor livre: até 1% das previstas (ver TOLERANCIA_ATRASO).
    dropped_iterations: [`count<=${MAX_ATRASADAS}`],
    pool_pedidos_esgotados: ['value==0'],
    // Sem regra de verdade: só para o resumo trazer as métricas separadas por fase.
    ...porFase('leituras_aceitas', 'count>=0'),
    ...porFase('pool_conexoes_ativas', 'max>=0'),
    ...porFase('pool_pedidos_em_espera', 'max>=0'),
  },
  summaryTrendStats: ['avg', 'p(95)', 'max'],
}

function entrar(usuario, senha) {
  const r = http.post(`${API}/auth/login`, JSON.stringify({ usuario, senha }), { headers: JSON_CAB, tags: { tipo: 'preparo' } })
  if (r.status !== 200) throw new Error(`Login de ${usuario} recusado: ${r.status}`)
  return r.json('token')
}

export function setup() {
  const admin = entrar('capibaribe.admin', SENHA_ADMIN)
  const auth = { headers: { Authorization: `Bearer ${admin}` }, tags: { tipo: 'preparo' } }

  const processos = http.get(`${API}/processos`, auth).json()
  if (!processos.length) throw new Error('Nenhum processo cadastrado.')

  // Os sensores usam o caminho do ESP32: token de API da conta de sensor, sem login (ver iot/sketch.ino).
  const sensor = http.get(`${API}/usuarios`, auth).json().find((u) => u.perfil === 'sensor' && u.ativo)
  if (!sensor) throw new Error('Nenhuma conta de sensor ativa (a API cria a sensor.wokwi quando SENSOR_SENHA existe).')
  const rotacao = http.post(`${API}/usuarios/${sensor.id}/token/rotacao`, null, auth)
  if (rotacao.status !== 200) throw new Error(`Rotação do token do sensor recusada: ${rotacao.status}`)

  return { admin, tokenSensor: rotacao.json('token'), processos }
}

export function sensor({ tokenSensor, processos }) {
  const fase = faseAgora()
  // Cada sensor fica numa máquina (processo) fixa, como na fábrica.
  const p = processos[(exec.vu.idInTest - 1) % processos.length]
  const pecas = 10
  const esperado = p.unidade === 'peca' ? p.meta * pecas : p.meta
  // De 20% abaixo a 20% acima da meta; no pico de lavagem química, o consumo sobe e passa mais da meta.
  const fator = fase === 'pico' ? 0.95 + Math.random() * 0.35 : 0.8 + Math.random() * 0.4
  const litros = Number((esperado * fator).toFixed(2))

  const r = http.post(`${API}/lotes`, JSON.stringify({ processoId: p.id, pecas, litros }), {
    headers: { ...JSON_CAB, Authorization: `Bearer ${tokenSensor}`, 'Idempotency-Key': uuidv4() },
    tags: { tipo: 'leitura', fase },
  })
  respostas5xx.add(r.status >= 500, { fase })
  if (check(r, { 'leitura aceita (201)': (x) => x.status === 201 }, { fase })) leiturasAceitas.add(1, { fase })
}

function metrica(token, nome) {
  const r = http.get(`${API}/actuator/metrics/${nome}`, { headers: { Authorization: `Bearer ${token}` }, tags: { tipo: 'monitor' } })
  if (r.status !== 200) return {}
  const valores = {}
  for (const m of r.json('measurements')) valores[m.statistic] = m.value
  return valores
}

export function monitorarPool({ admin }) {
  const fase = faseAgora()
  const ativas = metrica(admin, 'hikaricp.connections.active').VALUE
  const espera = metrica(admin, 'hikaricp.connections.pending').VALUE
  if (ativas !== undefined) poolAtivas.add(ativas, { fase })
  if (espera !== undefined) poolEmEspera.add(espera, { fase })
  sleep(INTERVALO_S)
}

// Depois do turno, o acumulado do pool desde que a API subiu (o ambiente é novo a cada teste).
export function teardown({ admin }) {
  const espera = metrica(admin, 'hikaricp.connections.acquire')
  poolMaximo.add(metrica(admin, 'hikaricp.connections.max').VALUE || 0)
  poolEsperaMedia.add(espera.COUNT ? (espera.TOTAL_TIME / espera.COUNT) * 1000 : 0)
  poolMaiorEspera.add((espera.MAX || 0) * 1000)
  poolEsgotados.add(metrica(admin, 'hikaricp.connections.timeout').COUNT || 0)
}

// ---------- relatório ----------

// Número no formato brasileiro (1.234,5). O k6 (goja) não tem Intl: toLocaleString não aceita 'pt-BR'.
function n(v, casas = 2) {
  if (v === undefined || v === null || Number.isNaN(Number(v))) return '-'
  const [inteiro, dec] = Number(v).toFixed(casas).split('.')
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fracao = (dec || '').replace(/0+$/, '')
  return fracao ? `${milhar},${fracao}` : milhar
}
// Data e hora de Recife (UTC-3, sem horário de verão), também sem Intl.
const agoraRecife = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')
const vals = (d, nome) => (d.metrics[nome] || {}).values || {}
const passou = (d, nome) => {
  const t = (d.metrics[nome] || {}).thresholds
  return t ? Object.values(t).every((x) => x.ok) : null
}
const selo = (ok) => (ok === null ? '' : ok ? '<span class="ok">atingida</span>' : '<span class="falha">não atingida</span>')

function relatorioHtml(d) {
  const leitura = vals(d, 'http_req_duration{tipo:leitura}')
  const duracaoS = d.state.testRunDurationMs / 1000
  const aceitas = vals(d, 'leituras_aceitas').count || 0
  const linhasFase = FASES.map((f) => {
    const t = vals(d, `http_req_duration{tipo:leitura,fase:${f}}`)
    return `<tr><td>${{ rampa: 'Rampa (entrada e saída)', plato: 'Platô (60 leituras/s)', pico: `Pico de lavagem (${PICO} leituras/s)` }[f]}</td>
      <td>${n(vals(d, `leituras_aceitas{fase:${f}}`).count, 0)}</td><td>${n(t.avg)} ms</td><td><b>${n(t['p(95)'])} ms</b></td>
      <td>${n(t.max)} ms</td><td>${n(vals(d, `pool_conexoes_ativas{fase:${f}}`).max, 0)}</td>
      <td>${n(vals(d, `pool_pedidos_em_espera{fase:${f}}`).max, 0)}</td>
      <td>${selo(passou(d, `http_req_duration{tipo:leitura,fase:${f}}`))}</td></tr>`
  }).join('')
  const criterios = [
    [`p95 das leituras abaixo de ${META_P95} ms no pico`, `${n(vals(d, 'http_req_duration{tipo:leitura,fase:pico}')['p(95)'])} ms`, passou(d, 'http_req_duration{tipo:leitura,fase:pico}')],
    [`p95 das leituras abaixo de ${META_P95} ms no turno todo`, `${n(leitura['p(95)'])} ms`, passou(d, 'http_req_duration{tipo:leitura}')],
    ['Nenhuma resposta 5xx', `${n((vals(d, 'respostas_5xx').rate || 0) * 100)}%`, passou(d, 'respostas_5xx')],
    ['Nenhuma leitura recusada', `${n((vals(d, 'http_req_failed{tipo:leitura}').rate || 0) * 100)}%`, passou(d, 'http_req_failed{tipo:leitura}')],
    [`Leituras fora do horário (sem sensor livre) até ${n(TOLERANCIA_ATRASO * 100, 0)}% das ${n(PREVISTAS, 0)} previstas`,
      `${n(vals(d, 'dropped_iterations').count || 0, 0)} (${n(((vals(d, 'dropped_iterations').count || 0) / PREVISTAS) * 100)}%)`,
      passou(d, 'dropped_iterations') === null ? true : passou(d, 'dropped_iterations')],
    ['Nenhum pedido de conexão esgotou o tempo no pool', n(vals(d, 'pool_pedidos_esgotados').value, 0), passou(d, 'pool_pedidos_esgotados')],
  ].map(([c, v, ok]) => `<tr><td>${c}</td><td>${v}</td><td>${selo(ok)}</td></tr>`).join('')

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Turno industrial: teste de carga</title>
<style>
  :root { --fundo: #f7f9fb; --texto: #1d2733; --borda: #d5dde6; --ok: #1b7f3b; --falha: #b42318; }
  body { font: 15px/1.5 system-ui, sans-serif; background: var(--fundo); color: var(--texto); margin: 0; padding: 24px 16px; }
  main { max-width: 960px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; } h2 { font-size: 1.15rem; margin-top: 28px; }
  .sub { color: #5a6878; margin: 0 0 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .card { background: #fff; border: 1px solid var(--borda); border-radius: 8px; padding: 12px 14px; }
  .card b { display: block; font-size: 1.4rem; }
  .tabela { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid var(--borda); }
  th, td { padding: 8px 10px; border-bottom: 1px solid var(--borda); text-align: left; white-space: nowrap; }
  th { background: #eef2f6; font-weight: 600; }
  .ok { color: var(--ok); font-weight: 600; } .falha { color: var(--falha); font-weight: 600; }
</style></head><body><main>
<h1>Turno industrial: teste de carga</h1>
<p class="sub">Issue #165 · ${SENSORES} sensores, uma leitura a cada ${INTERVALO_S} s, com rampa, platô e 2 picos de lavagem química ·
${agoraRecife()} (horário de Recife)</p>
<div class="cards">
  <div class="card">p95 das leituras<b>${n(leitura['p(95)'])} ms</b></div>
  <div class="card">Requisições por segundo<b>${n(aceitas / duracaoS, 1)}</b></div>
  <div class="card">Leituras aceitas<b>${n(aceitas, 0)}</b></div>
  <div class="card">Pool do banco<b>${n(vals(d, 'pool_conexoes_maximas').value, 0)} conexões</b></div>
</div>
<h2>Critérios de aceitação</h2>
<div class="tabela"><table><tr><th>Critério</th><th>Resultado</th><th>Meta</th></tr>${criterios}</table></div>
<h2>Por fase do turno</h2>
<div class="tabela"><table><tr><th>Fase</th><th>Leituras</th><th>Média</th><th>p95</th><th>Maior</th><th>Conexões ativas (máx.)</th><th>Pedidos em espera (máx.)</th><th>p95 &lt; ${META_P95} ms</th></tr>${linhasFase}</table></div>
<h2>Pool de conexões (HikariCP)</h2>
<div class="tabela"><table>
  <tr><th>Indicador</th><th>Valor</th></tr>
  <tr><td>Conexões no pool</td><td>${n(vals(d, 'pool_conexoes_maximas').value, 0)}</td></tr>
  <tr><td>Conexões ativas (média e maior, a cada ${INTERVALO_S} s)</td><td>${n(vals(d, 'pool_conexoes_ativas').avg, 1)} e ${n(vals(d, 'pool_conexoes_ativas').max, 0)}</td></tr>
  <tr><td>Pedidos esperando conexão (maior)</td><td>${n(vals(d, 'pool_pedidos_em_espera').max, 0)}</td></tr>
  <tr><td>Espera média por conexão</td><td>${n(vals(d, 'pool_espera_media_ms').value)} ms</td></tr>
  <tr><td>Maior espera por conexão</td><td>${n(vals(d, 'pool_maior_espera_ms').value, 0)} ms</td></tr>
  <tr><td>Pedidos que esgotaram o tempo</td><td>${n(vals(d, 'pool_pedidos_esgotados').value, 0)}</td></tr>
</table></div>
<p class="sub">Duração: ${n(duracaoS / 60, 1)} min. Média de ${n(leitura.avg)} ms e maior tempo de ${n(leitura.max)} ms nas leituras.</p>
</main></body></html>`
}

export function handleSummary(dados) {
  const pasta = __ENV.PASTA_RESULTADOS || '/resultados'
  return {
    stdout: textSummary(dados, { indent: ' ', enableColors: false }),
    [`${pasta}/turno-industrial.json`]: JSON.stringify(dados, null, 2),
    [`${pasta}/turno-industrial.html`]: relatorioHtml(dados),
  }
}
