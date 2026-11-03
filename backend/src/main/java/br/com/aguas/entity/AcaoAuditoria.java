package br.com.aguas.entity;

/** Ações do gestor sobre a conta de outra pessoa que ficam registradas em auditoria_usuario. */
public enum AcaoAuditoria {
    CRIACAO_USUARIO,
    REDEFINICAO_SENHA,
    DESATIVACAO_USUARIO,
    REATIVACAO_USUARIO
}
