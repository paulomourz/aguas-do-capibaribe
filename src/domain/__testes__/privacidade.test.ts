import { describe, expect, it } from 'vitest'
import { DADOS_GUARDADOS, SECOES_AVISO } from '../privacidade'

/* Aviso de privacidade (LGPD, issue #117, RNF27): cada dado diz para quê, por quanto tempo e quem vê. */
describe('aviso de privacidade', () => {
  it('todo dado guardado tem finalidade, prazo e quem vê', () => {
    expect(DADOS_GUARDADOS.length).toBeGreaterThan(0)
    for (const d of DADOS_GUARDADOS) {
      expect(d.dado.trim(), d.dado).not.toBe('')
      expect(d.finalidade.trim(), d.dado).not.toBe('')
      expect(d.prazo.trim(), d.dado).not.toBe('')
      expect(d.quemVe.trim(), d.dado).not.toBe('')
    }
  })

  it('cobre os dados pessoais que o sistema guarda', () => {
    const dados = DADOS_GUARDADOS.map((d) => d.dado).join(' | ')
    for (const dado of ['Nome', 'Usuário (login)', 'Senha', 'Lotes', 'Auditoria', 'Endereço IP', 'aparelho']) {
      expect(dados).toContain(dado)
    }
  })

  it('diz com quem falar e quais são os direitos', () => {
    const titulos = SECOES_AVISO.map((s) => s.titulo)
    expect(titulos).toContain('Com quem falar')
    expect(titulos).toContain('Seus direitos')
  })
})
