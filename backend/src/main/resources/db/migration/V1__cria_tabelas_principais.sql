-- V1: tabelas principais, índices e views (antes em database/banco.sql).
-- Os nomes de colunas, restrições, índices e sequências são os mesmos do dump original, para que o
-- banco oficial (marcado com baseline na V4) e um banco novo criado por aqui fiquem idênticos.

-- Pessoas que entram no sistema. Senha só como hash BCrypt (sempre 60 caracteres).
CREATE TABLE usuario (
    id         serial                   NOT NULL,
    nome       character varying(120)   NOT NULL,
    login      character varying(60)    NOT NULL,
    senha_hash character varying(60)    NOT NULL,
    perfil     character varying(10)    NOT NULL,
    ativo      boolean                  NOT NULL DEFAULT true,
    criado_em  timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT usuario_pkey PRIMARY KEY (id),
    CONSTRAINT usuario_login_key UNIQUE (login),
    CONSTRAINT usuario_login_check CHECK (length(login) >= 3),
    CONSTRAINT usuario_nome_check CHECK (length(nome) > 0),
    CONSTRAINT usuario_perfil_check CHECK ((perfil)::text = ANY ((ARRAY['gestor'::character varying, 'operador'::character varying])::text[])),
    CONSTRAINT usuario_senha_hash_check CHECK (length(senha_hash) = 60)
);

-- Tipos de processo de lavagem e a meta de cada um (litros por lote ou por peça).
CREATE TABLE processo (
    id        serial                   NOT NULL,
    nome      character varying(80)    NOT NULL,
    unidade   character varying(4)     NOT NULL,
    meta      numeric(10,2)            NOT NULL,
    criado_em timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT processo_pkey PRIMARY KEY (id),
    CONSTRAINT processo_nome_key UNIQUE (nome),
    CONSTRAINT processo_meta_check CHECK (meta > 0),
    CONSTRAINT processo_nome_check CHECK (length(nome) > 0),
    CONSTRAINT processo_unidade_check CHECK ((unidade)::text = ANY ((ARRAY['lote'::character varying, 'peca'::character varying])::text[]))
);

-- Cada lote registrado. "esperado" é preenchido pelo trigger trg_lote_esperado (V2).
CREATE TABLE lote (
    id            serial                   NOT NULL,
    processo_id   integer                  NOT NULL,
    usuario_id    integer                  NOT NULL,
    pecas         integer                  NOT NULL,
    litros        numeric(12,2)            NOT NULL,
    esperado      numeric(14,2)            NOT NULL,
    registrado_em timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT lote_pkey PRIMARY KEY (id),
    CONSTRAINT lote_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES processo (id),
    CONSTRAINT lote_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuario (id),
    CONSTRAINT lote_esperado_check CHECK (esperado > 0),
    CONSTRAINT lote_litros_check CHECK (litros > 0),
    CONSTRAINT lote_pecas_check CHECK (pecas > 0)
);

-- Alerta de 3 lotes seguidos acima da meta.
CREATE TABLE alerta (
    id            serial                   NOT NULL,
    processo_id   integer                  NOT NULL,
    status        character varying(10)    NOT NULL DEFAULT 'aberto',
    detectado_em  timestamp with time zone NOT NULL DEFAULT now(),
    atualizado_em timestamp with time zone,
    CONSTRAINT alerta_pkey PRIMARY KEY (id),
    CONSTRAINT alerta_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES processo (id),
    CONSTRAINT alerta_status_check CHECK ((status)::text = ANY ((ARRAY['aberto'::character varying, 'analise'::character varying, 'resolvido'::character varying])::text[]))
);

-- Lotes de cada alerta. PK só em lote_id: um lote pertence a no máximo um alerta.
CREATE TABLE alerta_lote (
    lote_id   integer NOT NULL,
    alerta_id integer NOT NULL,
    CONSTRAINT alerta_lote_pkey PRIMARY KEY (lote_id),
    CONSTRAINT alerta_lote_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES lote (id),
    CONSTRAINT alerta_lote_alerta_id_fkey FOREIGN KEY (alerta_id) REFERENCES alerta (id)
);

CREATE INDEX ix_alerta_status ON alerta USING btree (status);
CREATE INDEX ix_lote_data ON lote USING btree (registrado_em);
CREATE INDEX ix_lote_processo ON lote USING btree (processo_id);
CREATE INDEX ix_lote_usuario ON lote USING btree (usuario_id);

-- Views com o desvio já calculado.
CREATE VIEW v_alertas AS
SELECT a.id AS alerta_id,
       p.nome AS processo,
       a.status,
       a.detectado_em,
       count(al.lote_id) AS qtd_lotes
FROM alerta a
JOIN processo p ON p.id = a.processo_id
LEFT JOIN alerta_lote al ON al.alerta_id = a.id
GROUP BY a.id, p.nome, a.status, a.detectado_em;

CREATE VIEW v_historico_lotes AS
SELECT l.id AS lote_id,
       l.usuario_id,
       p.nome AS processo,
       u.nome AS operador,
       l.pecas,
       l.litros,
       l.esperado,
       round((l.litros - l.esperado) / l.esperado * 100, 2) AS desvio_percentual,
       l.registrado_em
FROM lote l
JOIN processo p ON p.id = l.processo_id
JOIN usuario u ON u.id = l.usuario_id;

-- Usuário da API (se já existir): mesmas permissões de database/seguranca-usuario-api.sql.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aguas_api') THEN
        GRANT SELECT, INSERT, UPDATE ON usuario, processo, alerta TO aguas_api;
        GRANT SELECT, INSERT ON lote, alerta_lote TO aguas_api;
        GRANT SELECT ON v_alertas, v_historico_lotes TO aguas_api;
        GRANT USAGE, SELECT ON SEQUENCE usuario_id_seq, processo_id_seq, lote_id_seq, alerta_id_seq TO aguas_api;
    END IF;
END;
$$;
