/*
 * Aviso de privacidade (LGPD, Lei nº 13.709/2018; issue #117, RNF27).
 * Fonte única do texto mostrado na tela /privacidade, aberta pelo link da tela de login.
 * O mesmo conteúdo está em docs/gestao/seguranca.md, seção 6: mudar nos dois.
 */

export const AVISO_ATUALIZADO_EM = '11/11/2026'

export type DadoPessoal = {
  /** O que é guardado. */
  dado: string
  /** Para que serve e a base legal (art. 7º da LGPD). */
  finalidade: string
  /** Por quanto tempo fica guardado. */
  prazo: string
  /** Quem consegue ver. */
  quemVe: string
}

export const DADOS_GUARDADOS: DadoPessoal[] = [
  {
    dado: 'Nome',
    finalidade:
      'Identificar quem registrou cada lote e quem fez cada ação sobre as contas, para a lavanderia comprovar o consumo de água a clientes e órgãos ambientais (art. 7º, II e IX).',
    prazo:
      'Enquanto a lavanderia usar o sistema. A conta não é apagada, só desativada, porque os lotes e a auditoria precisam continuar mostrando quem fez.',
    quemVe:
      'Você, o administrador e os gestores. Aparece no histórico de lotes, no arquivo CSV, na auditoria e, para quem emitiu, no relatório em PDF.',
  },
  {
    dado: 'Usuário (login)',
    finalidade: 'Entrar no sistema (art. 7º, V).',
    prazo: 'O mesmo do nome.',
    quemVe:
      'Inteiro, só você e o administrador, que cria e cuida das contas. Para as outras pessoas aparece mascarado, por exemplo ca****in.',
  },
  {
    dado: 'Senha',
    finalidade: 'Confirmar que é você quem está entrando (art. 7º, V).',
    prazo: 'Até você ou o administrador trocar a senha.',
    quemVe:
      'Ninguém. Ela é guardada só como um código embaralhado (hash BCrypt), que não dá para desfazer, nem pela equipe do sistema.',
  },
  {
    dado: 'Perfil, situação da conta e data de criação',
    finalidade: 'Definir o que cada pessoa pode fazer no sistema (art. 7º, V e IX).',
    prazo: 'O mesmo do nome.',
    quemVe: 'Perfil e situação: você, o administrador e os gestores. A data de criação não aparece nas telas.',
  },
  {
    dado: 'Lotes que você registrou (data, hora e autoria)',
    finalidade:
      'Medir o consumo de água por lote e comprovar esse consumo a clientes e órgãos ambientais (art. 7º, II e IX).',
    prazo: 'Permanente. Um lote não pode ser alterado nem apagado, por ninguém.',
    quemVe: 'Você, os gestores e o administrador. O operador vê só os próprios lotes.',
  },
  {
    dado: 'Auditoria das contas',
    finalidade:
      'Registrar quem criou, desativou, reativou ou redefiniu a senha de uma conta, e quando, para segurança das contas (art. 7º, IX).',
    prazo: 'Permanente. Os registros não podem ser alterados nem apagados.',
    quemVe: 'Só o administrador.',
  },
  {
    dado: 'Endereço IP',
    finalidade: 'Limitar as tentativas de login (5 por minuto) e barrar quem tenta adivinhar senhas (art. 7º, IX).',
    prazo:
      'Só na memória do servidor, sem ir para o banco de dados nem para os registros do sistema. Some quando o servidor reinicia.',
    quemVe:
      'Só o administrador, e mascarado (por exemplo 200.17.33.***), quando alguém passa do limite de tentativas. O serviço de hospedagem (Render) pode registrar o endereço nos registros de acesso dele, pelo prazo que ele define.',
  },
  {
    dado: 'Dados guardados neste aparelho',
    finalidade:
      'Manter você conectado e permitir registrar lotes quando a internet cai: a sessão, a sua conta (sem a senha), os processos e os lotes vistos.',
    prazo:
      'A sessão vale até 8 horas e some ao fechar a aba. O restante é apagado ao clicar em Sair, menos os lotes que ainda não foram enviados.',
    quemVe: 'Só quem usa este aparelho.',
  },
]

export type SecaoAviso = { titulo: string; paragrafos: string[] }

export const SECOES_AVISO: SecaoAviso[] = [
  {
    titulo: 'Quem cuida dos seus dados',
    paragrafos: [
      'A lavanderia onde você trabalha decide como os dados são usados (controladora, na LGPD). O administrador da lavanderia é quem responde por ela no sistema.',
      'A equipe do Águas do Capibaribe mantém o sistema e trata os dados só para fazê-lo funcionar (operadora).',
    ],
  },
  {
    titulo: 'Com quem os dados são compartilhados',
    paragrafos: [
      'Os dados não são vendidos nem usados para propaganda.',
      'O sistema fica hospedado em serviços de nuvem: o site e a API no Render, e o banco de dados no Neon. Os servidores podem ficar fora do Brasil, e esses serviços seguem regras próprias de segurança.',
      'O aviso de alerta no Telegram leva só o processo e o número dos lotes, sem nome nem login de ninguém.',
      'O arquivo CSV leva só o nome de quem registrou cada lote, e o relatório em PDF leva só o nome de quem o emitiu. Nenhum dos dois leva login, senha ou perfil. Quem baixa um arquivo passa a ser responsável por ele.',
    ],
  },
  {
    titulo: 'Seus direitos',
    paragrafos: [
      'Você pode ver o seu nome, usuário e perfil a qualquer momento em Configurações da conta, e corrigir o seu nome por lá.',
      'Pelo administrador, você pode pedir uma cópia dos seus dados, a correção do que estiver errado e a desativação da sua conta.',
      'Os lotes e os registros de auditoria não são apagados, mesmo a pedido, porque a lavanderia precisa guardá-los para comprovar o consumo de água (art. 16 da LGPD).',
    ],
  },
  {
    titulo: 'Com quem falar',
    paragrafos: [
      'Fale com o administrador da sua lavanderia. Ele resolve o que for da conta e leva à equipe do Águas do Capibaribe o que depender do sistema.',
    ],
  },
]
