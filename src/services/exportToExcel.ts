/* ---------- Relatório gerencial em planilha Excel (.xlsx), gerado no navegador (issue #159, RF18) ---------- */

import ExcelJS from 'exceljs'
import type { Cell, Fill, Font, Row, Worksheet } from 'exceljs'
import { statusMeta, type Status } from '../components/ui'
import { NOME_LAVANDERIA } from '../config'
import { desvioDe, FAIXAS_DE_STATUS, litrosPorPeca, meses, nomeArquivoPlanilha, statusDe, textoDaReferencia, type Lote, type Resumo } from '../domain'

/**
 * Planilha para o gestor e para os órgãos ambientais, com duas abas:
 *  - "Lotes": um lote por linha (código, data, processo, peças, meta, consumo real, diferença, desvio, status e
 *    litros por peça), em ordem cronológica, com a linha de total do período;
 *  - "Resumo por processo": os mesmos totais agrupados por tipo de processo.
 *
 * Os totais, a diferença, o desvio e a pegada hídrica (litros por peça) são fórmulas da planilha, não números
 * copiados: se alguém corrigir um valor na planilha, o resto acompanha. Cada fórmula leva também o resultado já
 * calculado, para quem abre num visualizador que não recalcula.
 *
 * O desvio é um número em formato de porcentagem (5,5% fica 0,055), com formatação condicional nas faixas de status do
 * sistema (FAIXAS_DE_STATUS): verde até 0%, âmbar até 8% e vermelho acima disso. Textos digitados por usuários
 * (nome do processo) entram como texto, que a planilha nunca executa como fórmula.
 */

export type DadosPlanilha = {
  mes: number
  ano: number
  /** Lotes do período (todos os processos). */
  lotes: Lote[]
  /** Resumo do período por processo, o mesmo da tela de Relatórios. */
  resumo: Resumo[]
  nomeProcesso: (id: string) => string
  /** Quem exportou. */
  responsavel?: string
  geradoEm?: Date
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const FUSO = 'America/Recife'

/** Mesmas cores do site (src/index.css), em ARGB. */
const COR = {
  brand: 'FF12344D',
  branco: 'FFFFFFFF',
  ink2: 'FF52606D',
  linha: 'FFE5DFD3',
  zebra: 'FFFBFAF7',
  ok: 'FF14633A',
  okBg: 'FFE3F3E9',
  warn: 'FF7A5200',
  warnBg: 'FFFFF1CC',
  crit: 'FFA3201A',
  critBg: 'FFFBE4E2',
} as const

const CORES_STATUS: Record<Status, { texto: string; fundo: string }> = {
  ok: { texto: COR.ok, fundo: COR.okBg },
  warn: { texto: COR.warn, fundo: COR.warnBg },
  crit: { texto: COR.crit, fundo: COR.critBg },
}

const FMT = {
  litros: '#,##0',
  pecas: '#,##0',
  porPeca: '#,##0.0',
  desvio: '+0.0%;-0.0%;0.0%',
  data: 'dd/mm/yyyy hh:mm',
}

/** Linha do cabeçalho da tabela: o cabeçalho da empresa ocupa as linhas acima. */
const LINHA_CABECALHO = 6

const preenchimento = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

/** Limites de desvio do status, em fração (8% → 0,08). */
const LIMITE_OK = FAIXAS_DE_STATUS.find((f) => f.status === 'ok')!.ate / 100
const LIMITE_ATENCAO = FAIXAS_DE_STATUS.find((f) => f.status === 'warn')!.ate / 100

/**
 * A planilha não tem fuso: guarda a data e a hora "de parede". Converte o instante para o horário da lavanderia
 * (America/Recife, o mesmo do relatório e do CSV) e devolve um Date cujos campos UTC são esse horário, que é o que o
 * ExcelJS grava.
 */
export function dataNaLavanderia(d: Date): Date {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(d)
  const v = (t: Intl.DateTimeFormatPartTypes) => Number(partes.find((p) => p.type === t)?.value)
  return new Date(Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second')))
}

/** Fórmula com o resultado já calculado (o ExcelJS grava os dois). */
const formula = (f: string, resultado: number | string | null) => ({ formula: f, result: resultado ?? '' })

/** Desvio em fração (0,055 = 5,5%), ou vazio sem meta. */
const desvioFracao = (real: number, esperado: number) => (esperado ? desvioDe(real, esperado) / 100 : '')

/** Título, lavanderia, período e emissão, mesclados sobre a largura da tabela. */
function cabecalhoDaEmpresa(ws: Worksheet, colunas: number, titulo: string, periodo: string, emissao: string) {
  const linhas: [string, Partial<Font>, string | undefined][] = [
    [`Águas do Capibaribe · ${titulo}`, { bold: true, size: 14, color: { argb: COR.branco } }, COR.brand],
    [NOME_LAVANDERIA, { bold: true, size: 11 }, undefined],
    [`Período: ${periodo}`, { size: 11 }, undefined],
    [emissao, { size: 10, italic: true, color: { argb: COR.ink2 } }, undefined],
  ]
  linhas.forEach(([texto, fonte, fundo], i) => {
    const n = i + 1
    ws.mergeCells(n, 1, n, colunas)
    const c = ws.getCell(n, 1)
    c.value = texto
    c.font = fonte
    if (fundo) c.fill = preenchimento(fundo)
    c.alignment = { vertical: 'middle' }
  })
  ws.getRow(1).height = 26
}

/** Cabeçalho da tabela: fundo azul da marca, texto branco, filtro e painel congelado embaixo dele. */
function cabecalhoDaTabela(ws: Worksheet, titulos: string[], ultimaLinha: number) {
  const linha = ws.getRow(LINHA_CABECALHO)
  titulos.forEach((t, i) => {
    const c = linha.getCell(i + 1)
    c.value = t
    c.font = { bold: true, color: { argb: COR.branco } }
    c.fill = preenchimento(COR.brand)
    c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', wrapText: true }
  })
  linha.height = 32
  ws.views = [{ state: 'frozen', ySplit: LINHA_CABECALHO }]
  ws.autoFilter = { from: { row: LINHA_CABECALHO, column: 1 }, to: { row: ultimaLinha, column: titulos.length } }
}

/** Fundo de zebra nas linhas pares, menos na coluna de status (que já tem a cor dela). */
function zebrar(r: Row, colunas: number[]) {
  for (const c of colunas) r.getCell(c).fill = preenchimento(COR.zebra)
}

/** Selo de status em texto, com as cores do site. */
function celulaStatus(c: Cell, status: Status) {
  c.value = statusMeta[status].label
  c.font = { bold: true, color: { argb: CORES_STATUS[status].texto } }
  c.fill = preenchimento(CORES_STATUS[status].fundo)
  c.alignment = { horizontal: 'center' }
}

/**
 * Pinta o desvio pela faixa de status. As regras testam ISNUMBER porque, na planilha, texto (como a célula vazia
 * de um lote sem meta) é "maior" que qualquer número e cairia na faixa crítica.
 */
function formatarDesvio(ws: Worksheet, coluna: string, de: number, ate: number) {
  const ref = `${coluna}${de}:${coluna}${ate}`
  const celula = `${coluna}${de}`
  const regra = (expressao: string, status: Status, prioridade: number) => ({
    type: 'expression' as const,
    priority: prioridade,
    formulae: [`AND(ISNUMBER(${celula}),${expressao})`],
    style: { font: { bold: true, color: { argb: CORES_STATUS[status].texto } }, fill: preenchimento(CORES_STATUS[status].fundo) },
  })
  ws.addConditionalFormatting({
    ref,
    rules: [
      regra(`${celula}>${LIMITE_ATENCAO}`, 'crit', 1),
      regra(`${celula}<=${LIMITE_OK}`, 'ok', 2),
      regra(`${celula}>${LIMITE_OK}`, 'warn', 3),
    ],
  })
}

/** Linha de total: negrito, borda em cima e fundo de zebra (menos na coluna de status, que tem a cor dele). */
function estiloDeTotal(ws: Worksheet, n: number, colunas: number, colunaStatus: number) {
  for (let i = 1; i <= colunas; i++) {
    const c = ws.getCell(n, i)
    c.font = { ...c.font, bold: true }
    c.border = { top: { style: 'medium', color: { argb: COR.brand } } }
    if (i !== colunaStatus) c.fill = preenchimento(COR.zebra)
  }
}

function abaLotes(wb: ExcelJS.Workbook, d: DadosPlanilha, periodo: string, emissao: string) {
  const ws = wb.addWorksheet('Lotes', {
    properties: { defaultRowHeight: 18 },
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  const titulos = ['Código do lote', 'Data', 'Processo', 'Peças', 'Meta (L)', 'Consumo real (L)', 'Diferença (L)', 'Desvio (%)', 'Status', 'Água por peça (L)']
  ws.columns = [12, 17, 24, 10, 13, 16, 14, 12, 16, 16].map((width) => ({ width }))

  const lotes = [...d.lotes].sort((a, b) => a.data.getTime() - b.data.getTime() || Number(a.id) - Number(b.id))
  const primeira = LINHA_CABECALHO + 1
  const ultima = LINHA_CABECALHO + lotes.length
  const total = ultima + 1

  cabecalhoDaEmpresa(ws, titulos.length, 'Lotes do período', periodo, emissao)
  cabecalhoDaTabela(ws, titulos, ultima)

  lotes.forEach((l, i) => {
    const n = primeira + i
    const r = ws.getRow(n)
    r.getCell(1).value = l.id
    r.getCell(2).value = dataNaLavanderia(l.data)
    r.getCell(3).value = d.nomeProcesso(l.processoId)
    r.getCell(4).value = l.pecas
    r.getCell(5).value = l.esperado
    r.getCell(6).value = l.litros
    r.getCell(7).value = formula(`F${n}-E${n}`, l.litros - l.esperado)
    r.getCell(8).value = formula(`IF(E${n}=0,"",(F${n}-E${n})/E${n})`, desvioFracao(l.litros, l.esperado))
    celulaStatus(r.getCell(9), l.status)
    r.getCell(10).value = formula(`IF(D${n}=0,"",F${n}/D${n})`, litrosPorPeca(l.litros, l.pecas))
    if (i % 2 === 1) zebrar(r, [1, 2, 3, 4, 5, 6, 7, 8, 10])
  })

  const pecas = lotes.reduce((s, l) => s + l.pecas, 0)
  const esperado = lotes.reduce((s, l) => s + l.esperado, 0)
  const real = lotes.reduce((s, l) => s + l.litros, 0)
  const t = ws.getRow(total)
  t.getCell(1).value = `Total (${lotes.length} lotes)`
  ws.mergeCells(total, 1, total, 3)
  t.getCell(4).value = formula(`SUM(D${primeira}:D${ultima})`, pecas)
  t.getCell(5).value = formula(`SUM(E${primeira}:E${ultima})`, esperado)
  t.getCell(6).value = formula(`SUM(F${primeira}:F${ultima})`, real)
  t.getCell(7).value = formula(`F${total}-E${total}`, real - esperado)
  t.getCell(8).value = formula(`IF(E${total}=0,"",(F${total}-E${total})/E${total})`, desvioFracao(real, esperado))
  celulaStatus(t.getCell(9), statusDe(esperado ? desvioDe(real, esperado) : 0))
  t.getCell(10).value = formula(`IF(D${total}=0,"",F${total}/D${total})`, litrosPorPeca(real, pecas))
  estiloDeTotal(ws, total, titulos.length, 9)

  formatarColunas(ws, primeira, total, { data: 2, pecas: 4, litros: [5, 6, 7], desvio: 8, porPeca: 10 })
  formatarDesvio(ws, 'H', primeira, total)
  notaDaPegada(ws, total + 2, titulos.length)
}

function abaResumo(wb: ExcelJS.Workbook, d: DadosPlanilha, periodo: string, emissao: string) {
  const ws = wb.addWorksheet('Resumo por processo', {
    properties: { defaultRowHeight: 18 },
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  const titulos = ['Processo', 'Lotes', 'Peças', 'Esperado (L)', 'Consumo real (L)', 'Diferença (L)', 'Desvio (%)', 'Status', 'Água por peça (L)']
  ws.columns = [24, 9, 10, 14, 16, 14, 12, 16, 16].map((width) => ({ width }))

  const linhas = [...d.resumo].sort((a, b) => d.nomeProcesso(a.processoId).localeCompare(d.nomeProcesso(b.processoId), 'pt-BR'))
  const primeira = LINHA_CABECALHO + 1
  const ultima = LINHA_CABECALHO + linhas.length
  const total = ultima + 1

  cabecalhoDaEmpresa(ws, titulos.length, 'Consumo por tipo de processo', periodo, emissao)
  cabecalhoDaTabela(ws, titulos, ultima)

  linhas.forEach((p, i) => {
    const n = primeira + i
    const r = ws.getRow(n)
    r.getCell(1).value = d.nomeProcesso(p.processoId)
    r.getCell(2).value = p.lotes
    r.getCell(3).value = p.pecas
    r.getCell(4).value = p.esperado
    r.getCell(5).value = p.real
    r.getCell(6).value = formula(`E${n}-D${n}`, p.real - p.esperado)
    r.getCell(7).value = formula(`IF(D${n}=0,"",(E${n}-D${n})/D${n})`, desvioFracao(p.real, p.esperado))
    celulaStatus(r.getCell(8), statusDe(p.esperado ? desvioDe(p.real, p.esperado) : 0))
    r.getCell(9).value = formula(`IF(C${n}=0,"",E${n}/C${n})`, litrosPorPeca(p.real, p.pecas))
    if (i % 2 === 1) zebrar(r, [1, 2, 3, 4, 5, 6, 7, 9])
  })

  const soma = (k: 'lotes' | 'pecas' | 'esperado' | 'real') => linhas.reduce((s, r) => s + r[k], 0)
  const t = ws.getRow(total)
  t.getCell(1).value = 'Total do período'
  t.getCell(2).value = formula(`SUM(B${primeira}:B${ultima})`, soma('lotes'))
  t.getCell(3).value = formula(`SUM(C${primeira}:C${ultima})`, soma('pecas'))
  t.getCell(4).value = formula(`SUM(D${primeira}:D${ultima})`, soma('esperado'))
  t.getCell(5).value = formula(`SUM(E${primeira}:E${ultima})`, soma('real'))
  t.getCell(6).value = formula(`E${total}-D${total}`, soma('real') - soma('esperado'))
  t.getCell(7).value = formula(`IF(D${total}=0,"",(E${total}-D${total})/D${total})`, desvioFracao(soma('real'), soma('esperado')))
  celulaStatus(t.getCell(8), statusDe(soma('esperado') ? desvioDe(soma('real'), soma('esperado')) : 0))
  t.getCell(9).value = formula(`IF(C${total}=0,"",E${total}/C${total})`, litrosPorPeca(soma('real'), soma('pecas')))
  estiloDeTotal(ws, total, titulos.length, 8)

  formatarColunas(ws, primeira, total, { pecas: 3, litros: [2, 4, 5, 6], desvio: 7, porPeca: 9 })
  formatarDesvio(ws, 'G', primeira, total)
  notaDaPegada(ws, total + 2, titulos.length)
}

/** Formato de número de cada coluna, da primeira linha de dados até o total. */
function formatarColunas(
  ws: Worksheet,
  de: number,
  ate: number,
  colunas: { data?: number; pecas: number; litros: number[]; desvio: number; porPeca: number },
) {
  for (let n = de; n <= ate; n++) {
    const r = ws.getRow(n)
    if (colunas.data) r.getCell(colunas.data).numFmt = FMT.data
    r.getCell(colunas.pecas).numFmt = FMT.pecas
    for (const c of colunas.litros) r.getCell(c).numFmt = FMT.litros
    r.getCell(colunas.desvio).numFmt = FMT.desvio
    r.getCell(colunas.porPeca).numFmt = FMT.porPeca
  }
}

/** Explica a pegada hídrica embaixo da tabela, com a referência usada no site. */
function notaDaPegada(ws: Worksheet, n: number, colunas: number) {
  ws.mergeCells(n, 1, n, colunas)
  const c = ws.getCell(n, 1)
  c.value = `Água por peça (pegada hídrica) = consumo real ÷ peças. ${textoDaReferencia}. Desvio: verde até 0%, âmbar até ${LIMITE_ATENCAO * 100}% e vermelho acima.`
  c.font = { italic: true, size: 9, color: { argb: COR.ink2 } }
  c.alignment = { wrapText: true, vertical: 'top' }
  ws.getRow(n).height = 30
}

/** Monta a planilha completa. Separado do download para poder testar sem navegador. */
export function montarPlanilha(d: DadosPlanilha): ExcelJS.Workbook {
  if (d.lotes.length === 0) throw new Error('Período sem lotes: não há planilha para gerar.')
  const geradoEm = d.geradoEm ?? new Date()
  const periodo = `${meses[d.mes - 1]} de ${d.ano}`
  const emissao = `Gerado em ${horaDeEmissao(geradoEm)}${d.responsavel ? ` por ${d.responsavel}` : ''} · Águas do Capibaribe`

  const wb = new ExcelJS.Workbook()
  wb.creator = d.responsavel ?? 'Águas do Capibaribe'
  wb.company = NOME_LAVANDERIA
  wb.title = `Relatório de consumo de água - ${periodo}`
  wb.subject = 'Consumo de água por lote e por tipo de processo'
  wb.created = geradoEm
  wb.modified = geradoEm
  // Recalcula as fórmulas ao abrir, caso alguém tenha editado a planilha num programa que não recalcula.
  wb.calcProperties.fullCalcOnLoad = true

  abaLotes(wb, d, periodo, emissao)
  abaResumo(wb, d, periodo, emissao)
  return wb
}

const dataEmissao = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' })
const horaEmissao = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "17/11/2026 às 16:05", no horário da lavanderia em qualquer computador. */
export const horaDeEmissao = (d: Date) => `${dataEmissao.format(d)} às ${horaEmissao.format(d)}`

/** Bytes do arquivo .xlsx. */
export async function gerarXlsx(d: DadosPlanilha): Promise<ArrayBuffer> {
  return (await montarPlanilha(d).xlsx.writeBuffer()) as ArrayBuffer
}

/** Gera a planilha e inicia o download no navegador. Devolve o nome do arquivo. */
export async function baixarRelatorioXlsx(d: DadosPlanilha): Promise<string> {
  const nome = nomeArquivoPlanilha(d.mes, d.ano)
  const url = URL.createObjectURL(new Blob([await gerarXlsx(d)], { type: TIPO_XLSX }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return nome
}
