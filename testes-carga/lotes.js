// Teste de carga do registro de lotes (issue #56). Simula sensores enviando lotes sem pausa.
// Como rodar: docs/tecnico/teste-carga.md. Use só o ambiente descartável, porque lotes não podem ser apagados.
import http from 'k6/http'
import { check } from 'k6'
import { Counter } from 'k6/metrics'

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
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    'http_req_duration{scenario:sensores_10}': ['p(95)<200'],
    'http_req_duration{scenario:sensores_25}': ['p(95)<200'],
    'http_req_duration{scenario:sensores_50}': ['p(95)<200'],
  },
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
