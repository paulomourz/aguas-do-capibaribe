import { describe, expect, it } from 'vitest'
import { GLOSSARIO, nomeSugerido, normalizar, termoDe } from '../glossario'

describe('glossário têxtil', () => {
  it('tem os quatro processos padrão do sistema', () => {
    expect(GLOSSARIO.map((t) => t.nome)).toEqual(['Estonagem', 'Amaciamento', 'Alvejamento', 'Tingimento'])
  })

  it('não repete um sinônimo em dois termos', () => {
    const todos = GLOSSARIO.flatMap((t) => [t.nome, ...t.sinonimos].map(normalizar))
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('normaliza maiúsculas, acentos e espaços', () => {
    expect(normalizar('  Alvejaménto ')).toBe('alvejamento')
    expect(normalizar('Stone-Wash')).toBe('stone wash')
  })

  it('acha o termo pelo nome ou pelo sinônimo', () => {
    expect(termoDe('ESTONAGEM')?.nome).toBe('Estonagem')
    expect(termoDe('stone wash')?.nome).toBe('Estonagem')
    expect(termoDe('Branqueamento')?.nome).toBe('Alvejamento')
    expect(termoDe('Lavagem enzimática')).toBeUndefined()
    expect(termoDe('   ')).toBeUndefined()
  })

  it('sugere o nome padrão só quando o nome digitado foge do padrão', () => {
    expect(nomeSugerido('estonagem')).toBe('Estonagem')
    expect(nomeSugerido('Softener')).toBe('Amaciamento')
    expect(nomeSugerido('Estonagem')).toBeUndefined()
    expect(nomeSugerido(' Estonagem ')).toBeUndefined()
    expect(nomeSugerido('Desengomagem')).toBeUndefined()
  })
})
