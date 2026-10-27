/**
 * Exibe o seletor "Estado (protótipo)" nas telas com dados.
 * Desligue (false) quando o protótipo virar produto.
 */
export const MOSTRAR_SELETOR_DE_ESTADOS = false

/** Lavanderia que aparece no cabeçalho do relatório em PDF (VITE_NOME_LAVANDERIA no .env.local). */
export const NOME_LAVANDERIA = import.meta.env.VITE_NOME_LAVANDERIA?.trim() || 'Lavanderia não informada'
