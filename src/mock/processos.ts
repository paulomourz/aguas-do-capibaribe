/* SIMULAÇÃO: será substituído pela API REST. Não levar para produção. */

import type { Processo } from '../domain/tipos'

export const processosIniciais: Processo[] = [
  { id: 'amaciamento', nome: 'Amaciamento', unidade: 'lote', meta: 800 },
  { id: 'estonagem', nome: 'Estonagem', unidade: 'peca', meta: 12 },
  { id: 'tingimento', nome: 'Tingimento', unidade: 'lote', meta: 1500 },
]
