-- Análise do particionamento mensal da tabela lote (issue #100). SÓ PARA BANCO DE TESTE DESCARTÁVEL.
-- Uso: psql -f teste-particionamento.sql   (depois do popula-lotes.sql)
--
-- Cria lote_part, uma cópia da tabela lote particionada por mês (registrado_em), e mostra:
--   1. as restrições do projeto que o PostgreSQL recusa numa tabela particionada (os ERROR são esperados);
--   2. que um trigger de INSERT não consegue criar a partição que falta (a proposta original da issue);
--   3. que a chave de envio deixa de impedir lote repetido;
--   4. o plano das consultas da API na cópia particionada, para comparar com o explain-indices.sql.
-- A tabela lote não é alterada. Resultado e decisão em docs/tecnico/desempenho-indices.md.

\pset pager off
\set VERBOSITY terse

DROP TABLE IF EXISTS lote_part CASCADE;
DROP FUNCTION IF EXISTS lote_part_cria_particao();

CREATE TABLE lote_part (LIKE lote INCLUDING DEFAULTS INCLUDING CONSTRAINTS) PARTITION BY RANGE (registrado_em);

\echo '=== 1a. Chave primária só em id, como na tabela lote (esperado: ERROR) ==='
ALTER TABLE lote_part ADD PRIMARY KEY (id);

\echo '=== 1b. Chave de envio única sozinha, como na V7 (esperado: ERROR) ==='
CREATE UNIQUE INDEX ON lote_part (chave_envio);

\echo '=== 1c. O que o PostgreSQL aceita: a coluna da partição dentro de cada chave única ==='
ALTER TABLE lote_part ADD PRIMARY KEY (id, registrado_em);
CREATE UNIQUE INDEX ux_lote_part_chave_envio ON lote_part (chave_envio, registrado_em);

\echo '=== 1d. alerta_lote apontando para lote_part(id) (esperado: ERROR) ==='
CREATE TABLE alerta_lote_teste (lote_id integer REFERENCES lote_part (id));
DROP TABLE IF EXISTS alerta_lote_teste;

\echo '=== 2. Trigger que cria a partição do mês no INSERT (esperado: ERROR "no partition ... found for row") ==='
-- O PostgreSQL escolhe a partição antes de rodar os triggers da linha; sem partição, o INSERT falha antes.
CREATE FUNCTION lote_part_cria_particao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF lote_part FOR VALUES FROM (%L) TO (%L)',
                   'lote_part_' || to_char(NEW.registrado_em, 'YYYY_MM'),
                   date_trunc('month', NEW.registrado_em),
                   date_trunc('month', NEW.registrado_em) + interval '1 month');
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_lote_part_cria_particao BEFORE INSERT ON lote_part
    FOR EACH ROW EXECUTE FUNCTION lote_part_cria_particao();
INSERT INTO lote_part (processo_id, usuario_id, pecas, litros, esperado, registrado_em)
VALUES (1, 1, 10, 100, 100, timestamptz '2027-03-15 10:00:00-03');
DROP TRIGGER trg_lote_part_cria_particao ON lote_part;
DROP FUNCTION lote_part_cria_particao();

-- Uma partição por mês, de janeiro/2026 a janeiro/2027 (fuso de Recife, como os relatórios), e a padrão.
DO $$
DECLARE
    m date := date '2026-01-01';
BEGIN
    WHILE m < date '2027-02-01' LOOP
        EXECUTE format('CREATE TABLE %I PARTITION OF lote_part FOR VALUES FROM (%L) TO (%L)',
                       'lote_part_' || to_char(m, 'YYYY_MM'),
                       m::timestamp AT TIME ZONE 'America/Recife',
                       (m + interval '1 month')::timestamp AT TIME ZONE 'America/Recife');
        m := m + interval '1 month';
    END LOOP;
END;
$$;
CREATE TABLE lote_part_padrao PARTITION OF lote_part DEFAULT;

\echo '=== 3. Mesma chave de envio duas vezes (esperado: as duas linhas gravadas) ==='
-- Com a chave única composta, só a mesma chave no mesmo instante é barrada. Como o reenvio grava outro
-- registrado_em (now()), o lote repetido entra, no mesmo mês ou em outro.
INSERT INTO lote_part (id, processo_id, usuario_id, pecas, litros, esperado, registrado_em, chave_envio) VALUES
    (-1, 1, 1, 10, 100, 100, timestamptz '2026-03-10 10:00:00-03', '11111111-1111-1111-1111-111111111111'),
    (-2, 1, 1, 10, 100, 100, timestamptz '2026-03-10 10:00:05-03', '11111111-1111-1111-1111-111111111111');
SELECT id, registrado_em, chave_envio FROM lote_part WHERE chave_envio = '11111111-1111-1111-1111-111111111111';
DELETE FROM lote_part WHERE id < 0;

-- Cópia dos lotes e os mesmos índices da tabela lote (V1 e V8).
INSERT INTO lote_part SELECT * FROM lote;
CREATE INDEX ON lote_part (registrado_em);
CREATE INDEX ON lote_part (processo_id, registrado_em DESC, id DESC);
CREATE INDEX ON lote_part (usuario_id);
VACUUM ANALYZE lote_part;

\echo '=== 4. Consultas da API na cópia particionada (compare com o explain-indices.sql) ==='
\echo '--- 4.1 Fechamento mensal de junho/2026 (LoteRepository.resumir) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT processo_id, sum(litros), sum(esperado), count(id)
FROM lote_part
WHERE registrado_em >= timestamptz '2026-06-01 00:00:00-03' AND registrado_em < timestamptz '2026-07-01 00:00:00-03'
GROUP BY processo_id
ORDER BY processo_id;

\echo '--- 4.2 Regra de alerta, processo pouco usado: o pior caso (LoteRepository.findTop2...) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM lote_part
WHERE processo_id = (SELECT id FROM processo WHERE nome = 'Processo raro (carga)') AND id <> 0
ORDER BY registrado_em DESC, id DESC
LIMIT 2;

\echo '--- 4.3 Lotes de um operador em junho/2026 (LoteService.listar) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM lote_part
WHERE usuario_id = (SELECT id FROM usuario WHERE login = 'carga.op1')
  AND registrado_em >= timestamptz '2026-06-01 00:00:00-03' AND registrado_em <= timestamptz '2026-07-01 00:00:00-03'
ORDER BY registrado_em DESC, id DESC;
