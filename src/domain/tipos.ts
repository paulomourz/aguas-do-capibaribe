/* Tipos usados pelas telas. O store converte os DTOs da API (src/services/tipos.ts) para estes tipos. */

import type { Status } from '../components/ui'
import type { Perfil, StatusAlerta, Unidade } from '../services/tipos'

// Valores aceitos pelo banco; definidos uma única vez no contrato da API.
export type { Perfil, Unidade }
export type AlertaStatus = StatusAlerta

/** A API nunca devolve senha. */
export type Usuario = { id: string; nome: string; usuario: string; perfil: Perfil; ativo: boolean }
export type Processo = { id: string; nome: string; unidade: Unidade; meta: number }

export type Lote = {
  id: string
  processoId: string
  pecas: number
  litros: number
  esperado: number
  desvio: number
  /** Faixa do desvio, vinda da API (statusConformidade). */
  status: Status
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

/** Preço do m³ em R$, que vale a partir de `vigencia` (AAAA-MM-DD). `cadastradoPor` é o nome de quem cadastrou. */
export type PrecoM3 = { id: string; valor: number; vigencia: string; cadastradoPor: string | null; cadastradoEm: Date }

/** Consumo de um processo no mês, com o total de peças e a pegada hídrica (litros por peça, #116). */
export type Resumo = { processoId: string; real: number; esperado: number; lotes: number; pecas: number; litrosPorPeca: number | null }
