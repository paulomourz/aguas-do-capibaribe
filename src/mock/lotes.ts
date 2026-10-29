/* SIMULAÇÃO: será substituído pela API REST. Não levar para produção. */

import type { Alerta, Lote } from '../domain/tipos'
import { processosIniciais } from './processos'
import { desvioDe, esperadoDe, statusDe } from '../domain/regras'

/* ---------- Lotes (setembro de 2026) ---------- */

const dt = (mes: number, dia: number, h: number, m: number) => new Date(2026, mes - 1, dia, h, m)

function criarLote(id: string, processoId: string, pecas: number, litros: number, data: Date, usuarioId: string): Lote {
  const p = processosIniciais.find((x) => x.id === processoId)!
  const esperado = esperadoDe(p, pecas)
  const desvio = desvioDe(litros, esperado)
  return { id, processoId, pecas, litros, esperado, desvio, status: statusDe(desvio), data, usuarioId }
}

// [processo, peças, litros, dia, hora, minuto, usuário] — do mais recente ao mais antigo
const brutos: [string, number, number, number, number, number, string][] = [
  ['amaciamento', 140, 760, 30, 11, 20, 'u2'],
  ['estonagem', 100, 1290, 30, 9, 55, 'u2'],
  ['tingimento', 90, 1980, 30, 8, 10, 'u2'],
  ['amaciamento', 120, 784, 29, 16, 30, 'u1'],
  ['tingimento', 85, 1953, 29, 14, 5, 'u2'],
  ['estonagem', 85, 1010, 29, 10, 20, 'u2'],
  ['tingimento', 95, 1913, 29, 8, 0, 'u2'],
  ['amaciamento', 130, 812, 28, 15, 40, 'u2'],
  ['estonagem', 110, 1300, 28, 13, 10, 'u1'],
  ['tingimento', 80, 1470, 28, 9, 25, 'u2'],
  ['amaciamento', 150, 792, 27, 16, 0, 'u2'],
  ['estonagem', 90, 1145, 27, 11, 35, 'u2'],
  ['tingimento', 100, 1530, 27, 8, 15, 'u2'],
  ['amaciamento', 125, 776, 26, 15, 50, 'u2'],
  ['estonagem', 120, 1406, 26, 10, 5, 'u1'],
  ['tingimento', 90, 1485, 26, 8, 30, 'u2'],
  ['amaciamento', 140, 832, 25, 14, 20, 'u2'],
  ['estonagem', 95, 1197, 25, 9, 40, 'u2'],
  ['tingimento', 85, 1680, 24, 15, 10, 'u2'],
  ['amaciamento', 110, 768, 24, 10, 0, 'u2'],
  ['estonagem', 100, 1188, 23, 14, 45, 'u2'],
  ['tingimento', 95, 1455, 23, 9, 5, 'u1'],
]

export const lotesIniciais: Lote[] = brutos.map(([p, pc, l, d, h, m, u], i) =>
  criarLote(`L-${String(248 - i).padStart(4, '0')}`, p, pc, l, dt(9, d, h, m), u),
)

const porId = (id: string) => lotesIniciais.find((l) => l.id === id)!

export const alertasIniciais: Alerta[] = [
  {
    id: 'A-012',
    processoId: 'tingimento',
    lotes: [porId('L-0242'), porId('L-0244'), porId('L-0246')],
    detectado: dt(9, 30, 8, 11),
    status: 'aberto',
  },
  {
    id: 'A-009',
    processoId: 'estonagem',
    lotes: [
      criarLote('L-0201', 'estonagem', 95, 1220, dt(9, 17, 9, 10), 'u2'),
      criarLote('L-0204', 'estonagem', 100, 1296, dt(9, 17, 14, 30), 'u2'),
      criarLote('L-0207', 'estonagem', 90, 1161, dt(9, 18, 10, 5), 'u2'),
    ],
    detectado: dt(9, 18, 10, 6),
    status: 'analise',
  },
  {
    id: 'A-005',
    processoId: 'amaciamento',
    lotes: [
      criarLote('L-0158', 'amaciamento', 120, 848, dt(9, 3, 8, 40), 'u2'),
      criarLote('L-0161', 'amaciamento', 135, 864, dt(9, 3, 15, 15), 'u2'),
      criarLote('L-0163', 'amaciamento', 110, 840, dt(9, 4, 9, 20), 'u1'),
    ],
    detectado: dt(9, 4, 9, 21),
    status: 'resolvido',
  },
]

