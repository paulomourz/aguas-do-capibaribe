import { validarDescarte, type ErrosDescarte, type FormDescarte } from '../domain/descarte'
import { ApiError, requisicao } from './http'
import type { DescarteDTO, Id, NovoDescarteDTO } from './tipos'

/** Descartes de efluentes do lote, do mais recente ao mais antigo (issue #201). */
export async function listarDescartes(loteId: Id): Promise<DescarteDTO[]> {
  return requisicao(`/lotes/${loteId}/descartes`)
}

/** Registra um descarte; a data é a do servidor e o registro não pode ser alterado depois. */
export async function registrarDescarte(loteId: Id, dados: NovoDescarteDTO): Promise<DescarteDTO> {
  return requisicao(`/lotes/${loteId}/descartes`, { method: 'POST', corpo: dados })
}

export type ResultadoDescarte =
  | { ok: true; gravado: DescarteDTO }
  | { ok: false; erros: ErrosDescarte; mensagem?: string }

/**
 * Valida o formulário e, se estiver certo, envia (issue #202). Erro de campo vindo da API (422) volta para o campo;
 * qualquer outro erro vira uma mensagem para o aviso da tela. Separado do componente para ser testado sem navegador.
 */
export async function salvarDescarte(
  loteId: Id,
  form: FormDescarte,
  enviar: typeof registrarDescarte = registrarDescarte,
): Promise<ResultadoDescarte> {
  const { dados, erros } = validarDescarte(form)
  if (!dados) return { ok: false, erros }
  try {
    return { ok: true, gravado: await enviar(loteId, dados) }
  } catch (e) {
    if (e instanceof ApiError && Object.keys(e.campos).length) return { ok: false, erros: e.campos as ErrosDescarte }
    return { ok: false, erros: {}, mensagem: e instanceof ApiError ? e.message : 'Erro inesperado. Tente novamente.' }
  }
}
