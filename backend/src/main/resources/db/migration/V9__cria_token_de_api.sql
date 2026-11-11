-- V9: token de API da conta de sensor, com rotação pelo administrador.
-- A chave tem 64 caracteres alfanuméricos e só aparece na resposta da rotação. No banco fica apenas o
-- SHA-256 dela (64 hexadecimais): quem ler a tabela não consegue usar o token.
-- Rotacionar troca o hash, então a chave anterior deixa de valer na mesma hora.
-- NULL: a conta não tem token (o índice único aceita vários NULL).

ALTER TABLE usuario ADD COLUMN token_hash character varying(64);

ALTER TABLE usuario ADD CONSTRAINT usuario_token_hash_check
    CHECK (token_hash IS NULL OR (token_hash)::text ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX ux_usuario_token_hash ON usuario USING btree (token_hash);

-- A auditoria passa a registrar a rotação (sem a chave nem o hash).
ALTER TABLE auditoria_usuario DROP CONSTRAINT auditoria_usuario_acao_check;
ALTER TABLE auditoria_usuario ADD CONSTRAINT auditoria_usuario_acao_check
    CHECK ((acao)::text = ANY ((ARRAY['CRIACAO_USUARIO'::character varying, 'REDEFINICAO_SENHA'::character varying,
                                      'DESATIVACAO_USUARIO'::character varying, 'REATIVACAO_USUARIO'::character varying,
                                      'ROTACAO_TOKEN'::character varying])::text[]));
