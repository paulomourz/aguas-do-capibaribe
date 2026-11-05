import { describe, expect, it } from 'vitest'
import type { Lote } from '../../domain'
import { CABECALHO_CSV, gerarCsvLotes, nomeArquivoCsv, numeroCsv } from '../historicoCsv'

/* CSV do histórico de lotes entregue à auditoria fiscal e ambiental: formato, fuso, ordem e proteção contra fórmula. */

const lote = (p: Partial<Lote>): Lote => ({
  id: '1',
  processoId: '10',
  pecas: 40,
  litros: 520,
  esperado: 480,
  desvio: 8.333,
  status: 'crit',
  data: new Date('2026-11-05T13:04:09.512Z'),
  usuarioId: '7',
  ...p,
})

const ctx = {
  nomeProcesso: (id: string) => ({ '10': 'Estonagem Suave', '11': 'Tingimento; "escuro"', '12': '=HYPERLINK("http://x")' })[id] ?? id,
  nomeUsuario: (id: string) => ({ '7': 'Maria José', '8': '@operador' })[id] ?? '—',
}

const linhas = (csv: string) => csv.replace(/^﻿/, '').split('\r\n').filter(Boolean)

describe('gerarCsvLotes', () => {
  it('começa com BOM, usa ";" e CRLF, e traz o cabeçalho de auditoria', () => {
    const csv = gerarCsvLotes([lote({})], ctx)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(linhas(csv)[0]).toBe(CABECALHO_CSV.join(';'))
  })

  it('formata a linha com hora de Recife, UTC ISO, vírgula decimal e status por extenso', () => {
    expect(linhas(gerarCsvLotes([lote({})], ctx))[1]).toBe(
      '1;05/11/2026;10:04:09;2026-11-05T13:04:09Z;Estonagem Suave;40;520,00;480,00;40,00;8,33;Crítico;Maria José',
    )
  })

  it('lote abaixo da meta sai com sinal "-" comum na diferença e no desvio', () => {
    const l = linhas(gerarCsvLotes([lote({ litros: 450, desvio: -6.25, status: 'ok' })], ctx))[1].split(';')
    expect(l[8]).toBe('-30,00')
    expect(l[9]).toBe('-6,25')
    expect(l[10]).toBe('Dentro da meta')
  })

  it('exporta em ordem cronológica, mesmo que a tela mostre os mais novos primeiro', () => {
    const csv = gerarCsvLotes(
      [lote({ id: '3', data: new Date('2026-11-03T12:00:00Z') }), lote({ id: '1', data: new Date('2026-11-01T12:00:00Z') }), lote({ id: '2', data: new Date('2026-11-01T12:00:00Z') })],
      ctx,
    )
    expect(linhas(csv).slice(1).map((l) => l.split(';')[0])).toEqual(['1', '2', '3'])
  })

  it('põe aspas em texto com ";" ou aspas e neutraliza fórmulas em nomes digitados', () => {
    const csv = gerarCsvLotes([lote({ id: '1', processoId: '11', usuarioId: '8' }), lote({ id: '2', processoId: '12' })], ctx)
    const [, a, b] = linhas(csv)
    expect(a).toContain(';"Tingimento; ""escuro""";')
    expect(a.endsWith(";'@operador")).toBe(true)
    expect(b).toContain(`;"'=HYPERLINK(""http://x"")";`)
  })
})

describe('numeroCsv', () => {
  it('arredonda para 2 casas, sem separador de milhar e sem "-0,00"', () => {
    expect(numeroCsv(12345.678)).toBe('12345,68')
    expect(numeroCsv(-0.004)).toBe('0,00')
    expect(numeroCsv(7)).toBe('7,00')
  })
})

describe('nomeArquivoCsv', () => {
  it('usa a data de Recife e o processo filtrado sem acento', () => {
    // 02:30 UTC do dia 6 ainda é dia 5 em Recife
    expect(nomeArquivoCsv(new Date('2026-11-06T02:30:00Z'))).toBe('aguas-do-capibaribe-lotes-2026-11-05.csv')
    expect(nomeArquivoCsv(new Date('2026-11-06T02:30:00Z'), 'Lavagem Ácida Pesada')).toBe('aguas-do-capibaribe-lotes-2026-11-05-lavagem-acida-pesada.csv')
  })
})
