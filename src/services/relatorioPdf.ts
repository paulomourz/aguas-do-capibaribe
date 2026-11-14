/* ---------- Relatório mensal em PDF (gerado no navegador) ---------- */

import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import logoUrl from '../assets/logo.png'
import { statusMeta } from '../components/ui'
import { NOME_LAVANDERIA } from '../config'
import { desvioDe, fmtDataHora, fmtL, fmtLitrosPorPeca, fmtNum, fmtPct, litrosPorPeca, meses, nomeArquivoRelatorio, statusDe, type Resumo } from '../domain'

export type DadosRelatorio = {
  mes: number
  ano: number
  linhas: Resumo[]
  nomeProcesso: (id: string) => string
  /** Quem emitiu; assina como responsável técnico. */
  responsavel?: string
  geradoEm?: Date
}

// Mesmas cores do site (src/index.css), em RGB.
const COR = {
  brand: [18, 52, 77],
  ink: [31, 41, 51],
  ink2: [82, 96, 109],
  linha: [229, 223, 211],
  pagina: [247, 244, 238],
  zebra: [251, 250, 247],
  areia: [217, 199, 163],
  terracota: [181, 84, 58],
  ok: [20, 99, 58],
  warn: [122, 82, 0],
  crit: [163, 32, 26],
} as const satisfies Record<string, [number, number, number]>

// As fontes padrão do PDF não têm o sinal "−" (U+2212) nem espaços finos.
const txt = (s: string) => s.replace(/−/g, '-').replace(/[  ]/g, ' ')

const MARGEM = 18
const LARGURA = 210

async function carregarLogo(): Promise<{ dados: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(logoUrl)).blob()
    const dados = await new Promise<string>((ok, falha) => {
      const r = new FileReader()
      r.onload = () => ok(r.result as string)
      r.onerror = falha
      r.readAsDataURL(blob)
    })
    const img = new Image()
    img.src = dados
    await img.decode()
    return { dados, w: img.naturalWidth, h: img.naturalHeight }
  } catch {
    return null // sem logo o relatório continua válido
  }
}

export async function gerarRelatorioPdf(d: DadosRelatorio): Promise<jsPDF> {
  if (d.linhas.length === 0) throw new Error('Período sem lotes: não há relatório para gerar.')

  const geradoEm = d.geradoEm ?? new Date()
  const periodo = `${meses[d.mes - 1]} de ${d.ano}`
  const real = d.linhas.reduce((s, r) => s + r.real, 0)
  const esperado = d.linhas.reduce((s, r) => s + r.esperado, 0)
  const lotes = d.linhas.reduce((s, r) => s + r.lotes, 0)
  const desvioGeral = desvioDe(real, esperado)

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({
    title: `Relatório de consumo de água - ${periodo}`,
    subject: `${NOME_LAVANDERIA} - consumo por tipo de processo`,
    author: d.responsavel ?? 'Águas do Capibaribe',
    creator: 'Águas do Capibaribe',
  })

  // Faixa terracota no topo
  doc.setFillColor(...COR.terracota)
  doc.rect(0, 0, LARGURA, 1.5, 'F')

  // Cabeçalho: marca à esquerda, competência à direita
  const logo = await carregarLogo()
  let xMarca = MARGEM
  if (logo) {
    const h = 14
    const w = (logo.w / logo.h) * h
    doc.addImage(logo.dados, 'PNG', MARGEM, 10, w, h, 'logo', 'FAST')
    xMarca = MARGEM + w + 4
  }
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...COR.brand)
  doc.text('Águas do Capibaribe', xMarca, 16.5)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...COR.ink2)
  doc.text('Gestão de consumo de água por lote', xMarca, 21.5)

  doc.setFontSize(8.5).text('Competência', LARGURA - MARGEM, 14, { align: 'right' })
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...COR.ink)
  doc.text(periodo, LARGURA - MARGEM, 20.5, { align: 'right' })

  doc.setDrawColor(...COR.areia).setLineWidth(0.6)
  doc.line(MARGEM, 29, LARGURA - MARGEM, 29)

  // Identificação
  const ident: [string, string][] = [
    ['Lavanderia', NOME_LAVANDERIA],
    ['Emitido em', txt(fmtDataHora(geradoEm))],
    ['Emitido por', d.responsavel ?? '-'],
  ]
  doc.setFontSize(9.5)
  ident.forEach(([rotulo, valor], i) => {
    const y = 36 + i * 5.5
    doc.setFont('helvetica', 'normal').setTextColor(...COR.ink2).text(`${rotulo}:`, MARGEM, y)
    doc.setFont('helvetica', 'bold').setTextColor(...COR.ink).text(valor, MARGEM + 24, y)
  })

  // Título
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...COR.ink)
  doc.text('Relatório de consumo por tipo de processo', MARGEM, 58)
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...COR.ink2)
  doc.text('Comparação entre o consumo real de água e o total esperado pelas metas dos processos.', MARGEM, 63.5)

  // Indicadores
  const kpis: [string, string][] = [
    ['Total consumido', txt(fmtL(real))],
    ['Total esperado', txt(fmtL(esperado))],
    ['Desvio geral', txt(fmtPct(desvioGeral))],
  ]
  const gap = 4
  const kw = (LARGURA - 2 * MARGEM - 2 * gap) / 3
  kpis.forEach(([rotulo, valor], i) => {
    const x = MARGEM + i * (kw + gap)
    doc.setDrawColor(...COR.linha).setLineWidth(0.3).roundedRect(x, 69, kw, 17, 1.5, 1.5, 'S')
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...COR.ink2).text(rotulo, x + 4, 75)
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...COR.ink).text(valor, x + 4, 82)
  })

  // Tabela por processo
  const statusLinha = d.linhas.map((r) => statusDe(desvioDe(r.real, r.esperado)))
  const corStatus = { ok: COR.ok, warn: COR.warn, crit: COR.crit } as const
  autoTable(doc, {
    startY: 93,
    margin: { left: MARGEM, right: MARGEM, bottom: 22 },
    head: [['Processo', 'Lotes', 'Consumido (L)', 'Esperado (L)', 'L/peça', 'Desvio', 'Situação']],
    body: d.linhas.map((r, i) => [
      d.nomeProcesso(r.processoId),
      fmtNum(r.lotes),
      fmtNum(r.real),
      fmtNum(r.esperado),
      txt(fmtLitrosPorPeca(r.litrosPorPeca)),
      txt(fmtPct(desvioDe(r.real, r.esperado))),
      statusMeta[statusLinha[i]].label,
    ]),
    foot: [['Total', fmtNum(lotes), fmtNum(real), fmtNum(esperado), txt(fmtLitrosPorPeca(litrosPorPeca(real, d.linhas.reduce((s, r) => s + r.pecas, 0)))), txt(fmtPct(desvioGeral)), statusMeta[statusDe(desvioGeral)].label]],
    showFoot: 'lastPage',
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.5, textColor: [...COR.ink], cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 }, lineColor: [...COR.linha] },
    headStyles: { fillColor: [...COR.brand], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { lineWidth: { bottom: 0.2 } },
    alternateRowStyles: { fillColor: [...COR.zebra] },
    footStyles: { fillColor: [...COR.pagina], fontStyle: 'bold', lineWidth: { top: 0.5 }, lineColor: [...COR.ink] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (c) => {
      // columnStyles só vale para o corpo; cabeçalho e total seguem o mesmo alinhamento.
      if (c.column.index >= 1 && c.column.index <= 5 && c.section !== 'body') c.cell.styles.halign = 'right'
      if (c.column.index !== 6) return
      const st = c.section === 'body' ? statusLinha[c.row.index] : c.section === 'foot' ? statusDe(desvioGeral) : null
      if (st) {
        c.cell.styles.textColor = [...corStatus[st]]
        c.cell.styles.fontStyle = 'bold'
      }
    },
  })

  let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...COR.ink2)
  doc.text('Desvio = (consumido - esperado) ÷ esperado. Valores em litros.', MARGEM, y)

  // Assinatura do responsável técnico
  const alturaPagina = doc.internal.pageSize.getHeight()
  if (y + 36 > alturaPagina - 22) {
    doc.addPage()
    y = 20
  }
  const ya = y + 28
  const xa = LARGURA - MARGEM - 75
  doc.setDrawColor(...COR.ink).setLineWidth(0.3).line(xa, ya, LARGURA - MARGEM, ya)
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...COR.ink)
  doc.text(d.responsavel ?? '', xa + 37.5, ya + 5, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...COR.ink2)
  doc.text('Responsável técnico', xa + 37.5, ya + 9.5, { align: 'center' })

  // Rodapé em todas as páginas
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setDrawColor(...COR.linha).setLineWidth(0.3).line(MARGEM, alturaPagina - 15, LARGURA - MARGEM, alturaPagina - 15)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...COR.ink2)
    doc.text(`Águas do Capibaribe · ${NOME_LAVANDERIA} · ${periodo}`, MARGEM, alturaPagina - 10)
    doc.text(`Página ${p} de ${total}`, LARGURA - MARGEM, alturaPagina - 10, { align: 'right' })
  }

  return doc
}

/** Gera o PDF e inicia o download no navegador. Devolve o nome do arquivo. */
export async function baixarRelatorioPdf(d: DadosRelatorio): Promise<string> {
  const doc = await gerarRelatorioPdf(d)
  const nome = nomeArquivoRelatorio(d.mes, d.ano)
  doc.save(nome)
  return nome
}
