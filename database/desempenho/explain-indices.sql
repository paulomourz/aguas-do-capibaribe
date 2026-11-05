-- Plano de execução das consultas de relatório, alerta e listagem da API (issue #59).
-- Uso: psql -f explain-indices.sql   (depois do popula-lotes.sql; rode antes e depois da V8 para comparar)
-- As consultas são as mesmas que o Hibernate gera nos repositórios citados.

\set ON_ERROR_STOP 1
\pset pager off

\echo '=== 1. Fechamento mensal de junho/2026, fuso America/Recife (LoteRepository.resumir) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT processo_id, sum(litros), sum(esperado), count(id)
FROM lote
WHERE registrado_em >= timestamptz '2026-06-01 00:00:00-03' AND registrado_em < timestamptz '2026-07-01 00:00:00-03'
GROUP BY processo_id
ORDER BY processo_id;

\echo '=== 2a. Regra de alerta, processo muito usado (LoteRepository.findTop2...) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM lote
WHERE processo_id = 1 AND id <> (SELECT max(id) FROM lote)
ORDER BY registrado_em DESC, id DESC
LIMIT 2;

\echo '=== 2b. Regra de alerta, processo pouco usado: o pior caso (LoteRepository.findTop2...) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM lote
WHERE processo_id = (SELECT id FROM processo WHERE nome = 'Processo raro (carga)') AND id <> 0
ORDER BY registrado_em DESC, id DESC
LIMIT 2;

\echo '=== 3. Alertas não resolvidos, mais recentes primeiro (AlertaRepository.findByStatus...) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM alerta
WHERE status = 'aberto'
ORDER BY detectado_em DESC, id DESC;

\echo '=== 4. Lotes de um alerta, na tela de detalhe (AlertaLoteRepository.findByAlertaIdIn) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM alerta_lote
WHERE alerta_id IN ((SELECT max(id) FROM alerta));

\echo '=== 5. Lotes de um operador em junho/2026 (LoteService.listar) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM lote
WHERE usuario_id = (SELECT id FROM usuario WHERE login = 'carga.op1')
  AND registrado_em >= timestamptz '2026-06-01 00:00:00-03' AND registrado_em <= timestamptz '2026-07-01 00:00:00-03'
ORDER BY registrado_em DESC, id DESC;
