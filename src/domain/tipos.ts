/* Tipos usados pelas telas. O store converte os DTOs da API (src/services/tipos.ts) para estes tipos. */

import type { Perfil, StatusAlerta, Unidade } from '../services/tipos'

// Valores aceitos pelo banco; definidos uma única vez no contrato da API.
export type { Perfil, Unidade }
export type AlertaStatus = StatusAlerta

/** senha só existe nos dados simulados (src/mock); a API nunca devolve senha. */
export type Usuario = { id: string; nome: string; usuario: string; perfil: Perfil; senha?: string; ativo: boolean }
export type Processo = { id: string; nome: string; unidade: Unidade; meta: number }

export type Lote = {
  id: string
  processoId: string
  pecas: number
  litros: number
  esperado: number
  desvio: number
  data: Date
  usuarioId: string
}

export type Alerta = {
  id: string
  processoId: string
  lotes: Lote[]
  detectado: Date
  status: AlertaStatus
}

/** Consumo de um processo no mês. */
export type Resumo = { processoId: string; real: number; esperado: number; lotes: number }
