import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NOME_LAVANDERIA } from '../../config'
import { nomeArquivoPlanilha, type Lote, type Resumo } from '../../domain'
import { baixarRelatorioXlsx, dataNaLavanderia, gerarXlsx, horaDeEmissao, montarPlanilha, TIPO_XLSX, type DadosPlanilha } from '../exportToExcel'

/*
 * Planilha Excel do relatório (issue #159). O teste gera o .xlsx de verdade, lê de volta com o próprio ExcelJS e
 * confere o que o gestor vai ver ao abrir: cabeçalho da empresa, colunas, datas no horário da lavanderia, fórmulas de
 * soma e de pegada hídrica, cores de status e a formatação condicional do desvio.
 */

const PROCESSOS: Record<string, string> = { '1': 'Estonagem', '2': 'Amaciamento', '3': '=HYPERLINK("http://x")' }

function lote(id: string, processoId: string, iso: string, pecas: number, esperado: number, litros: number, status: Lote['status']): Lote {
  return { id, processoId, pecas, litros, esperado, desvio: esperado ? ((litros - esperado) / esperado) * 100 : 0, status, data: new Date(iso), usuarioId: '2' }
}

// Fora de ordem de propósito: a planilha sai em ordem cronológica.
const LOTES: Lote[] = [
  lote('12', '1', '2026-11-10T18:00:00Z', 100, 1200, 1350, 'crit'),
  lote('10', '2', '2026-11-05T13:04:09Z', 200, 800, 760, 'ok'),
  lote('11', '1', '2026-11-08T12:00:00Z', 50, 600, 630, 'warn'),
]

const RESUMO: Resumo[] = [
  { processoId: '1', real: 1980, esperado: 1800, lotes: 2, pecas: 150, litrosPorPeca: 13.2 },
  { processoId: '2', real: 760, esperado: 800, lotes: 1, pecas: 200, litrosPorPeca: 3.8 },
]

const DADOS: DadosPlanilha = {
  mes: 11,
  ano: 2026,
  lotes: LOTES,
  resumo: RESUMO,
  nomeProcesso: (id) => PROCESSOS[id] ?? id,
  responsavel: 'Gestora Teste',
  geradoEm: new Date('2026-11-17T19:05:00Z'),
}

/** Gera o arquivo e abre de novo, como o Excel faria. */
async function abrir(d: DadosPlanilha = DADOS) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await gerarXlsx(d))
  return wb
}

type ComFormula = { formula: string; result: unknown }
const formulaDe = (c: ExcelJS.Cell) => (c.value as ComFormula).formula
const resultadoDe = (c: ExcelJS.Cell) => (c.value as ComFormula).result
/** Resultado vazio: o ExcelJS grava "" e, ao ler de volta, devolve undefined; na planilha a célula aparece vazia. */
const vazio = (c: ExcelJS.Cell) => resultadoDe(c) ?? ''
const fundoDe = (c: ExcelJS.Cell) => (c.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb

describe('dataNaLavanderia e horaDeEmissao', () => {
  it('guarda a data e a hora de Recife (UTC-3), que é o que a planilha mostra', () => {
    expect(dataNaLavanderia(new Date('2026-11-05T13:04:09Z')).toISOString()).toBe('2026-11-05T10:04:09.000Z')
  })

  it('vira o dia quando o lote é de madrugada em UTC', () => {
    expect(dataNaLavanderia(new Date('2026-11-01T02:30:00Z')).toISOString()).toBe('2026-10-31T23:30:00.000Z')
  })

  it('escreve a emissão no horário da lavanderia', () => {
    expect(horaDeEmissao(new Date('2026-11-17T19:05:00Z'))).toBe('17/11/2026 às 16:05')
  })
})

describe('nomeArquivoPlanilha', () => {
  it('segue o padrão do PDF, com a extensão .xlsx', () => {
    expect(nomeArquivoPlanilha(3, 2026)).toBe('aguas-do-capibaribe-relatorio-2026-03.xlsx')
  })
})

describe('montarPlanilha', () => {
  it('recusa período sem lotes', () => {
    expect(() => montarPlanilha({ ...DADOS, lotes: [] })).toThrow('Período sem lotes')
  })

  it('preenche as propriedades do arquivo e pede para recalcular ao abrir', () => {
    const wb = montarPlanilha(DADOS)
    expect(wb.title).toBe('Relatório de consumo de água - Novembro de 2026')
    expect(wb.creator).toBe('Gestora Teste')
    expect(wb.company).toBe(NOME_LAVANDERIA)
    expect(wb.calcProperties.fullCalcOnLoad).toBe(true)
  })

  it('sem responsável, assina como Águas do Capibaribe e não cita ninguém na emissão', () => {
    const wb = montarPlanilha({ ...DADOS, responsavel: undefined, geradoEm: undefined })
    expect(wb.creator).toBe('Águas do Capibaribe')
    expect(String(wb.getWorksheet('Lotes')!.getCell('A4').value)).not.toContain(' por ')
  })
})

describe('aba Lotes', () => {
  it('tem o cabeçalho da empresa: título, lavanderia, período e emissão', async () => {
    const ws = (await abrir()).getWorksheet('Lotes')!
    expect(ws.getCell('A1').value).toBe('Águas do Capibaribe · Lotes do período')
    expect(fundoDe(ws.getCell('A1'))).toBe('FF12344D')
    expect(ws.getCell('A2').value).toBe(NOME_LAVANDERIA)
    expect(ws.getCell('A3').value).toBe('Período: Novembro de 2026')
    expect(ws.getCell('A4').value).toBe('Gerado em 17/11/2026 às 16:05 por Gestora Teste · Águas do Capibaribe')
  })

  it('tem as colunas pedidas na issue, com filtro e cabeçalho congelado', async () => {
    const ws = (await abrir()).getWorksheet('Lotes')!
    const titulos = (ws.getRow(6).values as unknown[]).slice(1)
    expect(titulos).toEqual(['Código do lote', 'Data', 'Processo', 'Peças', 'Meta (L)', 'Consumo real (L)', 'Diferença (L)', 'Desvio (%)', 'Status', 'Água por peça (L)'])
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 6 })
    expect(ws.autoFilter).toBeTruthy()
  })

  it('lista os lotes em ordem cronológica, com a data como data de verdade no horário de Recife', async () => {
    const ws = (await abrir()).getWorksheet('Lotes')!
    expect([7, 8, 9].map((n) => ws.getCell(`A${n}`).value)).toEqual(['10', '11', '12'])
    const data = ws.getCell('B7')
    expect(data.value).toBeInstanceOf(Date)
    expect((data.value as Date).toISOString()).toBe('2026-11-05T10:04:09.000Z')
    expect(data.numFmt).toBe('dd/mm/yyyy hh:mm')
    expect(ws.getCell('C7').value).toBe('Amaciamento')
    expect([ws.getCell('D7').value, ws.getCell('E7').value, ws.getCell('F7').value]).toEqual([200, 800, 760])
  })

  it('calcula diferença, desvio e água por peça com fórmulas, guardando o resultado', async () => {
    const ws = (await abrir()).getWorksheet('Lotes')!
    expect(formulaDe(ws.getCell('G7'))).toBe('F7-E7')
    expect(resultadoDe(ws.getCell('G7'))).toBe(-40)
    expect(formulaDe(ws.getCell('H7'))).toBe('IF(E7=0,"",(F7-E7)/E7)')
    expect(resultadoDe(ws.getCell('H7'))).toBeCloseTo(-0.05)
    expect(ws.getCell('H7').numFmt).toBe('+0.0%;-0.0%;0.0%')
    expect(formulaDe(ws.getCell('J7'))).toBe('IF(D7=0,"",F7/D7)')
    expect(resultadoDe(ws.getCell('J7'))).toBeCloseTo(3.8)
  })

  it('soma o volume no total e calcula a pegada hídrica do período', async () => {
    const ws = (await abrir()).getWorksheet('Lotes')!
    expect(ws.getCell('A10').value).toBe('Total (3 lotes)')
    expect(formulaDe(ws.getCell('D10'))).toBe('SUM(D7:D9)')
    expect(resultadoDe(ws.getCell('D10'))).toBe(350)
    expect(formulaDe(ws.getCell('E10'))).toBe('SUM(E7:E9)')
    expect(resultadoDe(ws.getCell('E10'))).toBe(2600)
    expect(formulaDe(ws.getCell('F10'))).toBe('SUM(F7:F9)')
    expect(resultadoDe(ws.getCell('F10'))).toBe(2740)
    expect(formulaDe(ws.getCell('J10'))).toBe('IF(D10=0,"",F10/D10)')
    expect(resultadoDe(ws.getCell('J10'))).toBeCloseTo(2740 / 350)
    expect(ws.getCell('D10').font.bold).toBe(true)
  })

  it('mostra o status de cada lote com o rótulo e as cores do site', async () => {
    const ws = (await abrir()).getWorksheet('Lotes')!
    expect([7, 8, 9].map((n) => ws.getCell(`I${n}`).value)).toEqual(['Dentro da meta', 'Atenção', 'Crítico'])
    expect(fundoDe(ws.getCell('I7'))).toBe('FFE3F3E9')
    expect(fundoDe(ws.getCell('I8'))).toBe('FFFFF1CC')
    expect(fundoDe(ws.getCell('I9'))).toBe('FFFBE4E2')
    // Total: 2.740 L contra 2.600 L esperados = +5,4%, em atenção.
    expect(ws.getCell('I10').value).toBe('Atenção')
  })

  it('pinta o desvio pelas faixas de status: vermelho acima de 8%, verde até 0% e âmbar no meio', async () => {
    const ws = (await abrir()).getWorksheet('Lotes')!
    const cf = (ws as unknown as { conditionalFormattings: { ref: string; rules: { formulae: string[]; style: { fill: ExcelJS.FillPattern } }[] }[] }).conditionalFormattings
    expect(cf).toHaveLength(1)
    expect(cf[0].ref).toBe('H7:H10')
    const regras = cf[0].rules.map((r) => [r.formulae[0], r.style.fill.fgColor?.argb ?? (r.style.fill as unknown as { bgColor?: { argb: string } }).bgColor?.argb])
    expect(regras).toEqual([
      ['AND(ISNUMBER(H7),H7>0.08)', 'FFFBE4E2'],
      ['AND(ISNUMBER(H7),H7<=0)', 'FFE3F3E9'],
      ['AND(ISNUMBER(H7),H7>0)', 'FFFFF1CC'],
    ])
  })

  it('guarda nome de processo que parece fórmula como texto, sem executar', async () => {
    const ws = (await abrir({ ...DADOS, lotes: [lote('1', '3', '2026-11-05T13:00:00Z', 10, 100, 100, 'ok')], resumo: [] })).getWorksheet('Lotes')!
    expect(ws.getCell('C7').value).toBe('=HYPERLINK("http://x")')
    expect(ws.getCell('C7').type).toBe(ExcelJS.ValueType.String)
  })

  it('lote sem meta ou sem peças deixa o desvio e a água por peça vazios', async () => {
    const ws = (await abrir({ ...DADOS, lotes: [lote('1', '1', '2026-11-05T13:00:00Z', 0, 0, 100, 'crit')], resumo: [] })).getWorksheet('Lotes')!
    expect(formulaDe(ws.getCell('H7'))).toBe('IF(E7=0,"",(F7-E7)/E7)')
    expect(vazio(ws.getCell('H7'))).toBe('')
    expect(vazio(ws.getCell('J7'))).toBe('')
    expect(vazio(ws.getCell('H8'))).toBe('')
  })
})

describe('aba Resumo por processo', () => {
  it('tem um processo por linha, em ordem alfabética, com fórmulas e o total do período', async () => {
    const ws = (await abrir()).getWorksheet('Resumo por processo')!
    expect(ws.getCell('A1').value).toBe('Águas do Capibaribe · Consumo por tipo de processo')
    expect((ws.getRow(6).values as unknown[]).slice(1)).toEqual([
      'Processo',
      'Lotes',
      'Peças',
      'Esperado (L)',
      'Consumo real (L)',
      'Diferença (L)',
      'Desvio (%)',
      'Status',
      'Água por peça (L)',
    ])
    expect([ws.getCell('A7').value, ws.getCell('A8').value]).toEqual(['Amaciamento', 'Estonagem'])
    expect(ws.getCell('H8').value).toBe('Crítico')
    expect(formulaDe(ws.getCell('E9'))).toBe('SUM(E7:E8)')
    expect(resultadoDe(ws.getCell('E9'))).toBe(2740)
    expect(formulaDe(ws.getCell('I9'))).toBe('IF(C9=0,"",E9/C9)')
    expect(resultadoDe(ws.getCell('I9'))).toBeCloseTo(2740 / 350)
    expect(ws.getCell('H9').value).toBe('Atenção')
  })

  it('processo sem meta fica com o desvio vazio e status dentro da meta', async () => {
    const ws = (await abrir({ ...DADOS, resumo: [{ processoId: '1', real: 0, esperado: 0, lotes: 1, pecas: 0, litrosPorPeca: null }] })).getWorksheet('Resumo por processo')!
    expect(vazio(ws.getCell('G7'))).toBe('')
    expect(ws.getCell('H7').value).toBe('Dentro da meta')
    expect(ws.getCell('H8').value).toBe('Dentro da meta')
  })
})

describe('baixarRelatorioXlsx', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('gera o arquivo com o tipo do Excel e baixa com o nome do relatório', async () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
    const criado: Blob[] = []
    vi.stubGlobal('URL', { createObjectURL: (b: Blob) => (criado.push(b), 'blob:planilha'), revokeObjectURL: vi.fn() })
    vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn() } })

    const nome = await baixarRelatorioXlsx(DADOS)

    expect(nome).toBe('aguas-do-capibaribe-relatorio-2026-11.xlsx')
    expect(link.download).toBe(nome)
    expect(link.href).toBe('blob:planilha')
    expect(link.click).toHaveBeenCalledOnce()
    expect(criado[0].type).toBe(TIPO_XLSX)
    expect(criado[0].size).toBeGreaterThan(1000)
  })
})
