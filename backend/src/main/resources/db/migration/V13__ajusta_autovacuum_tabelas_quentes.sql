-- V13: autovacuum mais frequente nas tabelas que mais crescem (issue #163).
-- O padrão do PostgreSQL só limpa uma tabela quando 20% dela mudou (e só analisa com 10%). Numa tabela de milhões de
-- lotes, isso é esperar centenas de milhares de linhas: as estatísticas ficam velhas e o mapa de visibilidade
-- atrasa, e as consultas por período e a regra de alerta passam a ler mais páginas que o necessário.
-- Rotina de conferência e números em docs/tecnico/manutencao-banco.md (script database/manutencao/db-bloat-check.sql).
--
-- No projeto não há tabela particionada (o particionamento de lote foi testado e recusado, ver
-- docs/tecnico/desempenho-indices.md), então o ajuste vai nas tabelas quentes. Se um dia houver partições, cada
-- partição recebe os mesmos parâmetros (o autovacuum trabalha por partição, não pela tabela mãe).

-- lote e alerta_lote só recebem INSERT (lote é imutável, trg_lote_imutavel): quase não geram linhas mortas.
-- Para elas, o que importa é o gatilho de inserção (autovacuum_vacuum_insert_scale_factor, padrão 20%), que mantém o
-- mapa de visibilidade em dia, e o ANALYZE, que mantém as estatísticas das consultas por data.
ALTER TABLE lote SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_vacuum_insert_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);
ALTER TABLE alerta_lote SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_vacuum_insert_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

-- alerta recebe UPDATE (status, resolução): cada mudança deixa uma linha morta para o vacuum limpar.
ALTER TABLE alerta SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);
