/* ---------- Histórico de lotes em CSV (auditoria fiscal e ambiental externa) ---------- */

import type { Status } from '../components/ui'
import type { Lote } from '../domain'

/**
 * Formato pensado para o auditor abrir direto no Excel/LibreOffice em pt-BR e para ferramentas lerem sem ajuste:
 * - UTF-8 com BOM (acentos certos no Excel), separador ";" e quebra de linha CRLF (RFC 4180);
 * - números com vírgula decimal, 2 casas e sem separador de milhar; sinal "-" comum (nunca o "−" da tela);
 * - data e hora no fuso da lavanderia (America/Recife, o mesmo dos relatórios) e também em UTC ISO 8601,
 *   que não depende de fuso nem de horário de verão;
 * - linhas em ordem cronológica, com todos os lotes filtrados (não só a página visível);
 * - textos digitados por usuários (processo, nome) protegidos contra fórmula ao abrir na planilha.
 */

export const FUSO_AUDITORIA = 'America/Recife'
const SEP = ';'
const FIM = '\r\n'
const BOM = '﻿'

/** Mesmos rótulos do selo de status da tela (statusMeta em components/ui). */
const STATUS_ROTULO: Record<Status, string> = { ok: 'Dentro da meta', warn: 'Atenção', crit: 'Crítico' }

export const CABECALHO_CSV = [
  'ID do lote',
  'Data',
  'Hora',
  'Data e hora (UTC)',
  'Processo',
  'Peças',
  'Consumo real (L)',
  'Consumo esperado (L)',
  'Diferença (L)',
  'Desvio (%)',
  'Status',
  'Registrado por',
] as const

export type ContextoCsv = {
  nomeProcesso: (id: string) => string
  nomeUsuario: (id: string) => string
}

/** 1234.5 → "1234,50"; -0.004 → "0,00". */
export function numeroCsv(n: number, casas = 2): string {
  const s = (Math.round(n * 10 ** casas) / 10 ** casas).toFixed(casas)
  return (s.startsWith('-') && Number(s) === 0 ? s.slice(1) : s).replace('.', ',')
}

/** Aspas quando o valor tem separador, aspas ou quebra de linha (RFC 4180). */
function campo(v: string): string {
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/**
 * Texto livre: se começar com =, +, -, @, tab ou CR, a planilha executaria como fórmula (CSV injection, OWASP).
 * Um apóstrofo na frente faz a planilha mostrar o texto como está.
 */
function texto(v: string): string {
  return campo(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v)
}

const dataLocal = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_AUDITORIA, day: '2-digit', month: '2-digit', year: 'numeric' })
const horaLocal = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_AUDITORIA,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** ISO 8601 em UTC sem milissegundos: 2026-11-05T13:04:09Z. */
const utc = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

export function linhaCsv(l: Lote, ctx: ContextoCsv): string {
  return [
    campo(l.id),
    dataLocal.format(l.data),
    horaLocal.format(l.data),
    utc(l.data),
    texto(ctx.nomeProcesso(l.processoId)),
    String(l.pecas),
    numeroCsv(l.litros),
    numeroCsv(l.esperado),
    numeroCsv(l.litros - l.esperado),
    numeroCsv(l.desvio),
    STATUS_ROTULO[l.status],
    texto(ctx.nomeUsuario(l.usuarioId)),
  ].join(SEP)
}

/** Conteúdo completo do arquivo, com BOM, cabeçalho e uma linha por lote em ordem cronológica. */
export function gerarCsvLotes(lotes: Lote[], ctx: ContextoCsv): string {
  const ordenados = [...lotes].sort((a, b) => a.data.getTime() - b.data.getTime() || Number(a.id) - Number(b.id))
  const linhas = [CABECALHO_CSV.join(SEP), ...ordenados.map((l) => linhaCsv(l, ctx))]
  return BOM + linhas.join(FIM) + FIM
}

/** "Estonagem Suave" → "estonagem-suave". */
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** aguas-do-capibaribe-lotes-AAAA-MM-DD[-processo].csv, com a data da exportação no fuso da lavanderia. */
export function nomeArquivoCsv(geradoEm: Date, processo?: string): string {
  const [dia, mes, ano] = dataLocal.format(geradoEm).split('/')
  const sufixo = processo ? `-${slug(processo)}` : ''
  return `aguas-do-capibaribe-lotes-${ano}-${mes}-${dia}${sufixo}.csv`
}

/** Gera o arquivo e inicia o download no navegador. Devolve o nome do arquivo. */
export function baixarCsvLotes(lotes: Lote[], ctx: ContextoCsv & { processo?: string }): string {
  if (lotes.length === 0) throw new Error('Nenhum lote para exportar.')
  const nome = nomeArquivoCsv(new Date(), ctx.processo)
  const url = URL.createObjectURL(new Blob([gerarCsvLotes(lotes, ctx)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return nome
}
