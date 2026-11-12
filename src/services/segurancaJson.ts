import type { SegurancaDTO } from './tipos'

/*
 * Exportação dos eventos de segurança em JSON (issue #109), para guardar como registro de auditoria.
 * Leva a data da exportação e o aviso de que os números contam desde o último início da API.
 * Não há senha nem IP completo: a API já entrega o IP mascarado.
 */

const dataLocal = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Recife',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const OBSERVACAO_SEGURANCA =
  'Contagem em memória desde o último início da API (campo "desde"); os números zeram quando a API reinicia. IPs mascarados (LGPD).'

export function gerarJsonSeguranca(resumo: SegurancaDTO, geradoEm: Date): string {
  const registro = {
    sistema: 'Águas do Capibaribe',
    tipo: 'eventos-de-seguranca',
    geradoEm: geradoEm.toISOString(),
    observacao: OBSERVACAO_SEGURANCA,
    ...resumo,
  }
  return JSON.stringify(registro, null, 2) + '\n'
}

/** aguas-do-capibaribe-seguranca-AAAA-MM-DD.json, com a data da exportação no fuso da lavanderia. */
export function nomeArquivoSeguranca(geradoEm: Date): string {
  const [dia, mes, ano] = dataLocal.format(geradoEm).split('/')
  return `aguas-do-capibaribe-seguranca-${ano}-${mes}-${dia}.json`
}

/** Gera o arquivo e inicia o download no navegador. Devolve o nome do arquivo. */
export function baixarJsonSeguranca(resumo: SegurancaDTO): string {
  const agora = new Date()
  const nome = nomeArquivoSeguranca(agora)
  const url = URL.createObjectURL(new Blob([gerarJsonSeguranca(resumo, agora)], { type: 'application/json;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return nome
}
