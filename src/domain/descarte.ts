import type { NovoDescarteDTO } from '../services/tipos'
import { lerNumeroBR } from './formatacao'

/** Campos do formulário de descarte, como o operador digitou (padrão brasileiro: "7,2"). */
export type FormDescarte = { volumeLitros: string; ph: string; turbidezNtu: string; reutilizadoPercentual: string }
export type ErrosDescarte = Partial<Record<keyof FormDescarte, string>>

export const FORM_DESCARTE_VAZIO: FormDescarte = { volumeLitros: '', ph: '', turbidezNtu: '', reutilizadoPercentual: '' }

/** Até 2 casas decimais, como as colunas numeric(…, 2) da V12. */
const duasCasas = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6

/**
 * Confere o formulário com as mesmas faixas da API e da V12 (issue #202): volume maior que 0, pH de 0 a 14,
 * turbidez de pelo menos 0 e reaproveitado de 0 a 100 (opcional; vazio = 0). Devolve os dados prontos para enviar
 * ou os erros de cada campo, em português, para aparecerem junto ao campo.
 */
export function validarDescarte(f: FormDescarte): { dados?: NovoDescarteDTO; erros: ErrosDescarte } {
  const erros: ErrosDescarte = {}
  const numero = (campo: keyof FormDescarte, vazio: string, min: number, max: number, faixa: string, minimoExclusivo = false) => {
    const texto = f[campo].trim()
    if (!texto) {
      erros[campo] = vazio
      return Number.NaN
    }
    const n = lerNumeroBR(texto)
    if (Number.isNaN(n)) erros[campo] = 'Use só números, com vírgula para as casas decimais (ex.: 7,2).'
    else if ((minimoExclusivo ? n <= min : n < min) || n > max) erros[campo] = faixa
    else if (!duasCasas(n)) erros[campo] = 'Use no máximo 2 casas decimais.'
    return n
  }

  const volumeLitros = numero('volumeLitros', 'Informe o volume descartado.', 0, 9_999_999_999.99,
    'O volume descartado deve ser maior que zero.', true)
  const ph = numero('ph', 'Informe o pH do efluente.', 0, 14, 'O pH vai de 0 a 14.')
  const turbidezNtu = numero('turbidezNtu', 'Informe a turbidez, em NTU.', 0, 99_999_999.99, 'A turbidez não pode ser negativa.')
  const semReuso = !f.reutilizadoPercentual.trim()
  const reutilizadoPercentual = semReuso ? 0 : numero('reutilizadoPercentual', '', 0, 100, 'O reaproveitamento vai de 0% a 100%.')

  if (Object.keys(erros).length) return { erros }
  return { dados: { volumeLitros, ph, turbidezNtu, reutilizadoPercentual }, erros }
}

/** pH de lançamento de efluentes da Resolução CONAMA 430/2011 (art. 16): entre 5 e 9. Só informativo na tela. */
export const phForaDoLancamento = (ph: number) => ph < 5 || ph > 9
