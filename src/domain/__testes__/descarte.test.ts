import { describe, expect, it } from 'vitest'
import { FORM_DESCARTE_VAZIO, phForaDoLancamento, validarDescarte, type FormDescarte } from '../descarte'

/* Formulário do descarte de efluentes (issue #202): as mesmas faixas da API e da V12, com números no padrão BR. */

const form = (f: Partial<FormDescarte>): FormDescarte => ({ ...FORM_DESCARTE_VAZIO, ...f })
const valido = form({ volumeLitros: '1.250,5', ph: '7,2', turbidezNtu: '40', reutilizadoPercentual: '30' })

describe('validarDescarte', () => {
  it('lê os números no padrão brasileiro e devolve os dados prontos para enviar', () => {
    expect(validarDescarte(valido)).toEqual({
      dados: { volumeLitros: 1250.5, ph: 7.2, turbidezNtu: 40, reutilizadoPercentual: 30 },
      erros: {},
    })
  })

  it('reaproveitamento vazio conta como 0%', () => {
    expect(validarDescarte({ ...valido, reutilizadoPercentual: '  ' }).dados?.reutilizadoPercentual).toBe(0)
  })

  it('aceita as pontas das faixas: pH 0 e 14, turbidez 0, reaproveitado 0 e 100', () => {
    expect(validarDescarte({ ...valido, ph: '0', turbidezNtu: '0', reutilizadoPercentual: '0' }).dados).toBeDefined()
    expect(validarDescarte({ ...valido, ph: '14', reutilizadoPercentual: '100' }).dados).toBeDefined()
  })

  it('campos obrigatórios vazios: uma mensagem para cada um', () => {
    const { dados, erros } = validarDescarte(FORM_DESCARTE_VAZIO)
    expect(dados).toBeUndefined()
    expect(erros).toEqual({
      volumeLitros: 'Informe o volume descartado.',
      ph: 'Informe o pH do efluente.',
      turbidezNtu: 'Informe a turbidez, em NTU.',
    })
  })

  it.each([
    ['volumeLitros', '0', 'O volume descartado deve ser maior que zero.'],
    ['ph', '14,01', 'O pH vai de 0 a 14.'],
    ['reutilizadoPercentual', '100,5', 'O reaproveitamento vai de 0% a 100%.'],
    ['ph', 'neutro', 'Use só números, com vírgula para as casas decimais (ex.: 7,2).'],
    ['turbidezNtu', '-3', 'Use só números, com vírgula para as casas decimais (ex.: 7,2).'],
    ['ph', '7,255', 'Use no máximo 2 casas decimais.'],
  ] as const)('%s = "%s" → %s', (campo, texto, mensagem) => {
    const { dados, erros } = validarDescarte({ ...valido, [campo]: texto })
    expect(dados).toBeUndefined()
    expect(erros[campo]).toBe(mensagem)
  })
})

describe('phForaDoLancamento', () => {
  it('CONAMA 430: fora de 5 a 9', () => {
    expect([4.9, 5, 7, 9, 9.1].map(phForaDoLancamento)).toEqual([true, false, false, false, true])
  })
})
