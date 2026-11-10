// Teste de carga do registro de lotes (issues #56 e #113). Simula sensores enviando lotes sem pausa.
// Como rodar: docs/tecnico/teste-carga.md. Use só o ambiente descartável, porque lotes não podem ser apagados.
import http from 'k6/http'
import { check } from 'k6'
import { Counter } from 'k6/metrics'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js'

const API = __ENV.API_URL || 'http://backend:8080/api'
const SENHA = open('/segredos/admin').trim()
const JSON_CAB = { 'Content-Type': 'application/json' }

const lotesAceitos = new Counter('lotes_aceitos')

const etapa = (vus, inicio, duracao) => ({ executor: 'constant-vus', vus, startTime: inicio, duration: duracao, gracefulStop: '10s' })

export const options = {
  scenarios: {
    sensores_10: etapa(10, '0s', '30s'),
    sensores_25: etapa(25, '40s', '30s'),
    sensores_50: etapa(50, '80s', '2m'),
    sensores_100: etapa(100, '210s', '2m'),
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    'http_req_duration{scenario:sensores_10}': ['p(95)<200'],
    'http_req_duration{scenario:sensores_25}': ['p(95)<200'],
    'http_req_duration{scenario:sensores_50}': ['p(95)<200'],
    'http_req_duration{scenario:sensores_100}': ['p(95)<200'],
  },
  summaryTrendStats: ['avg', 'p(95)', 'max'],
}

export function setup() {
  const login = http.post(`${API}/auth/login`, JSON.stringify({ usuario: 'capibaribe.admin', senha: SENHA }), { headers: JSON_CAB })
  if (login.status !== 200) throw new Error(`Login recusado: ${login.status}`)
  const token = login.json('token')
  const processos = http.get(`${API}/processos`, { headers: { Authorization: `Bearer ${token}` } }).json()
  if (!processos.length) throw new Error('Nenhum processo cadastrado.')
  return { token, processos }
}

export default function ({ token, processos }) {
  const p = processos[Math.floor(Math.random() * processos.length)]
  const pecas = 10
  const esperado = p.unidade === 'peca' ? p.meta * pecas : p.meta
  // De 20% abaixo a 20% acima da meta, para exercitar também a regra de alerta.
  const litros = Number((esperado * (0.8 + Math.random() * 0.4)).toFixed(2))
  const r = http.post(`${API}/lotes`, JSON.stringify({ processoId: p.id, pecas, litros }), {
    headers: { ...JSON_CAB, Authorization: `Bearer ${token}` },
  })
  if (check(r, { 'lote aceito (201)': (x) => x.status === 201 })) lotesAceitos.add(1)
}

// Depois da carga, lê no Actuator como o pool de conexões (HikariCP) se comportou.
function metrica(token, nome) {
  const r = http.get(`${API}/actuator/metrics/${nome}`, { headers: { Authorization: `Bearer ${token}` } })
  if (r.status !== 200) return {}
  const valores = {}
  for (const m of r.json('measurements')) valores[m.statistic] = m.value
  return valores
}

export function teardown({ token }) {
  const espera = metrica(token, 'hikaricp.connections.acquire')
  const pool = {
    conexoes_maximas: metrica(token, 'hikaricp.connections.max').VALUE,
    pedidos_de_conexao: espera.COUNT,
    espera_media_ms: espera.COUNT ? (espera.TOTAL_TIME / espera.COUNT) * 1000 : 0,
    maior_espera_ms: (espera.MAX || 0) * 1000,
    pedidos_que_esgotaram_o_tempo: metrica(token, 'hikaricp.connections.timeout').COUNT,
  }
  console.log('POOL ' + JSON.stringify(pool))
}

export function handleSummary(dados) {
  const saida = { stdout: textSummary(dados, { indent: ' ', enableColors: false }) }
  if (__ENV.RESUMO) saida[__ENV.RESUMO] = JSON.stringify(dados, null, 2)
  return saida
}
