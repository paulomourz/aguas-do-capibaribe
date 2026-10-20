/* SIMULAÇÃO: será substituído pela API REST. Não levar para produção. */

import type { Usuario } from '../domain/tipos'

export const SENHA_DEMO = 'capibaribe'

export const usuariosIniciais: Usuario[] = [
  { id: 'u1', nome: 'Gestor Demo', usuario: 'gestor.demo', perfil: 'gestor', senha: SENHA_DEMO, ativo: true },
  { id: 'u2', nome: 'Operador 01', usuario: 'operador01', perfil: 'operador', senha: SENHA_DEMO, ativo: true },
]
