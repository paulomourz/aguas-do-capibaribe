-- Massa de dados para medir as consultas (issue #59). SÓ PARA BANCO DE TESTE DESCARTÁVEL:
-- os lotes não podem ser apagados depois (trigger trg_lote_imutavel).
--
-- Uso: psql -v qtd=10000 -f popula-lotes.sql   (qtd = número de lotes; padrão 10000)
-- Distribui os lotes por 12 meses de 2026, pelos 4 processos iniciais (V3) e por 10 operadores,
-- e cria um alerta a cada 3 lotes do começo da tabela, quase todos já resolvidos.
-- Cria também um processo pouco usado, com 5 lotes em janeiro: o pior caso da regra de alerta.

\set ON_ERROR_STOP 1
\if :{?qtd}
\else
    \set qtd 10000
\endif

BEGIN;

INSERT INTO usuario (nome, login, senha_hash, perfil)
SELECT 'Operador carga ' || n, 'carga.op' || n, repeat('x', 60), 'operador'
FROM generate_series(1, 10) AS n
ON CONFLICT (login) DO NOTHING;

INSERT INTO processo (nome, unidade, meta) VALUES ('Processo raro (carga)', 'lote', 100.00)
ON CONFLICT (nome) DO NOTHING;

-- litros de 20% abaixo a 25% acima da meta, como no teste de carga; esperado vem do trigger.
-- Datas em ordem crescente, como na API (registrado_em = now()): o disco fica na ordem do tempo.
INSERT INTO lote (processo_id, usuario_id, pecas, litros, registrado_em)
SELECT p.id,
       u.id,
       (10 + random() * 90)::int,
       round((p.meta * CASE WHEN p.unidade = 'peca' THEN 50 ELSE 1 END * (0.8 + random() * 0.45))::numeric, 2),
       timestamptz '2026-01-01 00:00:00-03' + (n * 365.0 / :qtd) * interval '1 day'
FROM generate_series(1, :qtd) AS n
JOIN LATERAL (SELECT id, meta, unidade FROM processo WHERE nome <> 'Processo raro (carga)' ORDER BY id OFFSET (n % 4) LIMIT 1) p ON true
JOIN LATERAL (SELECT id FROM usuario WHERE login = 'carga.op' || (1 + n % 10)) u ON true;

INSERT INTO lote (processo_id, usuario_id, pecas, litros, registrado_em)
SELECT (SELECT id FROM processo WHERE nome = 'Processo raro (carga)'),
       (SELECT id FROM usuario WHERE login = 'carga.op1'),
       10, 120.00, timestamptz '2026-01-02 08:00:00-03' + n * interval '1 hour'
FROM generate_series(1, 5) AS n;

-- 1 alerta para cada 3 lotes do primeiro décimo da tabela; 5% ficam abertos.
WITH grupos AS (
    SELECT (row_number() OVER (ORDER BY id) - 1) / 3 AS g, id, processo_id
    FROM (SELECT id, processo_id FROM lote ORDER BY id LIMIT :qtd / 10) t
), novos AS (
    INSERT INTO alerta (processo_id, status, detectado_em)
    SELECT min(processo_id),
           CASE WHEN g % 20 = 0 THEN 'aberto' ELSE 'resolvido' END,
           timestamptz '2026-01-01 00:00:00-03' + g * interval '1 hour'
    FROM grupos GROUP BY g ORDER BY g
    RETURNING id
), numerados AS (
    SELECT id, row_number() OVER (ORDER BY id) - 1 AS g FROM novos
)
INSERT INTO alerta_lote (lote_id, alerta_id)
SELECT gr.id, nu.id FROM grupos gr JOIN numerados nu USING (g);

COMMIT;

-- Estatísticas e mapa de visibilidade em dia, como num banco em uso (o autovacuum faz isso sozinho).
VACUUM ANALYZE usuario, processo, lote, alerta, alerta_lote;

SELECT (SELECT count(*) FROM lote) AS lotes,
       (SELECT count(*) FROM alerta) AS alertas,
       (SELECT count(*) FROM alerta WHERE status = 'aberto') AS alertas_abertos;
