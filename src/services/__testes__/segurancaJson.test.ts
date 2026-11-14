import { describe, expect, it } from 'vitest'
import type { SegurancaDTO } from '../tipos'
import { OBSERVACAO_SEGURANCA, gerarJsonSeguranca, nomeArquivoSeguranca } from '../segurancaJson'

/* Exportação em JSON dos eventos de segurança do painel do administrador (issue #109). */

const resumo: SegurancaDTO = {
  desde: '2026-11-11T09:00:00Z',
  loginsAceitos: 12,
  loginsRecusados: 7,
  bloqueiosLogin: 3,
  bloqueiosLotes: 0,
  senhasTrocadas: 1,
  senhasRedefinidas: 2,
  bloqueios: [
    { rota: 'login', ip: '200.17.33.***', primeiro: '2026-11-11T12:00:00Z', ultimo: '2026-11-11T12:00:30Z', tentativas: 3 },
  ],
}

describe('gerarJsonSeguranca', () => {
  it('leva a data da exportação, o aviso de contagem em memória e todos os números', () => {
    const json = JSON.parse(gerarJsonSeguranca(resumo, new Date('2026-11-11T15:30:00Z')))
    expect(json.tipo).toBe('eventos-de-seguranca')
    expect(json.geradoEm).toBe('2026-11-11T15:30:00.000Z')
    expect(json.observacao).toBe(OBSERVACAO_SEGURANCA)
    expect(json.desde).toBe(resumo.desde)
    expect(json.loginsRecusados).toBe(7)
    expect(json.bloqueios).toEqual(resumo.bloqueios)
  })

  it('não leva nenhum IP completo nem campo de senha', () => {
    const texto = gerarJsonSeguranca(resumo, new Date())
    expect(texto).not.toMatch(/\d+\.\d+\.\d+\.\d+/)
    expect(texto.toLowerCase()).not.toContain('"senha"')
  })
})

describe('nomeArquivoSeguranca', () => {
  it('usa a data no fuso de Recife, mesmo perto da meia-noite em UTC', () => {
    // 01:30 UTC do dia 12 ainda é dia 11 em Recife (UTC-3).
    expect(nomeArquivoSeguranca(new Date('2026-11-12T01:30:00Z'))).toBe('aguas-do-capibaribe-seguranca-2026-11-11.json')
  })
})
