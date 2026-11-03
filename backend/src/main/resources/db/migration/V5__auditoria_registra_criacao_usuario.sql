-- V5: a auditoria passa a registrar também a criação de usuários pelo gestor (issue #57).

ALTER TABLE auditoria_usuario DROP CONSTRAINT auditoria_usuario_acao_check;
ALTER TABLE auditoria_usuario ADD CONSTRAINT auditoria_usuario_acao_check
    CHECK ((acao)::text = ANY ((ARRAY['CRIACAO_USUARIO'::character varying, 'REDEFINICAO_SENHA'::character varying,
                                      'DESATIVACAO_USUARIO'::character varying, 'REATIVACAO_USUARIO'::character varying])::text[]));
