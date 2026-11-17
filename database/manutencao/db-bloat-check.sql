-- Saúde das tabelas: linhas mortas, inchaço (bloat) e autovacuum (issue #163).
-- Só lê estatísticas: não altera nada, a menos que você peça para executar os VACUUM sugeridos.
-- Rotina completa em docs/tecnico/manutencao-banco.md.
--
-- Rode como dono do banco (postgres), com psql 18+:
--   psql -U postgres -d aguas -f database/manutencao/db-bloat-check.sql
-- Opções (todas com -v):
--   limite=20     percentual de inchaço a partir do qual a tabela entra na lista de VACUUM (padrão 20)
--   tamanho_min_mb=1  tabelas menores que isso ficam fora da lista (padrão 1)
--   executar=1    executa os VACUUM (ANALYZE) sugeridos, em vez de só listar (o VACUUM FULL, nunca)
--
-- O inchaço vem do pgstattuple, se a extensão estiver instalada (CREATE EXTENSION pgstattuple, uma vez, como
-- postgres): espaço de linhas mortas + espaço livre dentro da tabela. Sem ela, o script usa o
-- percentual de linhas mortas das estatísticas, que é uma estimativa.

\if :{?limite}
\else
  \set limite 20
\endif
\if :{?tamanho_min_mb}
\else
  \set tamanho_min_mb 1
\endif
\if :{?executar}
\else
  \set executar 0
\endif

\pset footer off
\pset null '-'

SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgstattuple') AS tem_pgstattuple \gset

-- Base comum: uma linha por tabela (cada partição aparece sozinha, com a tabela mãe ao lado), com o gatilho do
-- autovacuum calculado com os parâmetros da própria tabela (V13) ou, sem eles, os do servidor.
CREATE TEMP VIEW saude_tabela AS
WITH param AS (
    SELECT c.oid,
           (SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name = 'autovacuum_vacuum_scale_factor')        AS vac_sf,
           (SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name = 'autovacuum_vacuum_threshold')           AS vac_base,
           (SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name = 'autovacuum_vacuum_insert_scale_factor') AS ins_sf,
           (SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name = 'autovacuum_vacuum_insert_threshold')    AS ins_base,
           (SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name = 'autovacuum_analyze_scale_factor')       AS ana_sf,
           (SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name = 'autovacuum_analyze_threshold')          AS ana_base
    FROM pg_class c
)
SELECT s.relid,
       s.schemaname,
       s.relname,
       mae.relname                                                         AS particao_de,
       pg_total_relation_size(s.relid)                                     AS bytes,
       s.n_live_tup                                                        AS vivas,
       s.n_dead_tup                                                        AS mortas,
       round(100.0 * s.n_dead_tup / nullif(s.n_live_tup + s.n_dead_tup, 0), 2) AS pct_mortas,
       s.n_ins_since_vacuum                                                AS inseridas_desde_vacuum,
       s.n_mod_since_analyze                                               AS alteradas_desde_analyze,
       coalesce(p.vac_sf, current_setting('autovacuum_vacuum_scale_factor'))::numeric AS vac_sf,
       -- Gatilhos do autovacuum: base + fator × linhas estimadas da tabela.
       ceil(coalesce(p.vac_base, current_setting('autovacuum_vacuum_threshold'))::numeric
            + coalesce(p.vac_sf, current_setting('autovacuum_vacuum_scale_factor'))::numeric * greatest(c.reltuples, 0)) AS gatilho_mortas,
       ceil(coalesce(p.ins_base, current_setting('autovacuum_vacuum_insert_threshold'))::numeric
            + coalesce(p.ins_sf, current_setting('autovacuum_vacuum_insert_scale_factor'))::numeric * greatest(c.reltuples, 0)) AS gatilho_insercoes,
       ceil(coalesce(p.ana_base, current_setting('autovacuum_analyze_threshold'))::numeric
            + coalesce(p.ana_sf, current_setting('autovacuum_analyze_scale_factor'))::numeric * greatest(c.reltuples, 0)) AS gatilho_analyze,
       greatest(s.last_vacuum, s.last_autovacuum)                          AS ultimo_vacuum,
       greatest(s.last_analyze, s.last_autoanalyze)                        AS ultimo_analyze,
       s.autovacuum_count                                                  AS autovacuums
FROM pg_stat_user_tables s
JOIN pg_class c ON c.oid = s.relid
JOIN param p ON p.oid = s.relid
LEFT JOIN pg_inherits h ON h.inhrelid = s.relid
LEFT JOIN pg_class mae ON mae.oid = h.inhparent
-- Só tabelas com dados próprios. A tabela mãe de um particionamento (relkind 'p') não guarda linhas: quem incha e
-- quem o autovacuum limpa são as partições, que aparecem aqui uma a uma.
WHERE c.relkind IN ('r', 'm');

\echo
\echo '=== 1. Linhas mortas e autovacuum, por tabela (maiores primeiro) ==='
\echo 'Se "mortas" passa de "gatilho_mortas" (ou "inseridas" de "gatilho_insercoes"), o autovacuum já deveria ter rodado.'
SELECT relname                                                   AS tabela,
       particao_de,
       pg_size_pretty(bytes)                                     AS tamanho,
       vivas,
       mortas,
       pct_mortas                                                AS "% mortas",
       gatilho_mortas,
       inseridas_desde_vacuum                                    AS inseridas,
       gatilho_insercoes,
       alteradas_desde_analyze                                   AS alteradas,
       gatilho_analyze,
       vac_sf                                                    AS fator_vacuum,
       to_char(ultimo_vacuum, 'DD/MM HH24:MI')                   AS ultimo_vacuum,
       to_char(ultimo_analyze, 'DD/MM HH24:MI')                  AS ultimo_analyze,
       CASE WHEN mortas > gatilho_mortas OR inseridas_desde_vacuum > gatilho_insercoes THEN 'vacuum atrasado'
            WHEN alteradas_desde_analyze > gatilho_analyze THEN 'analyze atrasado'
            ELSE 'ok' END                                        AS situacao
FROM saude_tabela
ORDER BY bytes DESC, relname;

-- Inchaço por tabela: medido (pgstattuple) ou estimado (% de linhas mortas).
-- Ele tem duas partes, com remédios diferentes:
--   linhas mortas: o VACUUM limpa, sem bloquear a tabela;
--   espaço livre: sobra de linhas já limpas. Fica com a tabela e é reaproveitado pelos próximos INSERT; só o
--   VACUUM FULL devolve ao disco, e ele bloqueia a tabela inteira enquanto roda. Este script nunca o executa.
\if :tem_pgstattuple
CREATE TEMP VIEW inchaco AS
SELECT t.*,
       round((a.dead_tuple_percent + a.approx_free_percent)::numeric, 2) AS pct_inchaco,
       round(a.dead_tuple_percent::numeric, 2)                           AS pct_mortas_medido,
       'pgstattuple_approx'                                              AS fonte
FROM saude_tabela t
CROSS JOIN LATERAL pgstattuple_approx(t.relid) a;
\else
\echo
\echo '(pgstattuple não instalado: o inchaço abaixo é estimado pelo % de linhas mortas. Para medir: CREATE EXTENSION pgstattuple;)'
CREATE TEMP VIEW inchaco AS
SELECT t.*, coalesce(t.pct_mortas, 0) AS pct_inchaco, coalesce(t.pct_mortas, 0) AS pct_mortas_medido,
       'estatisticas (estimado)' AS fonte
FROM saude_tabela t;
\endif

-- O que fazer com cada tabela inchada. Tabelas pequenas ficam de fora: com poucas linhas, a página quase vazia
-- conta como espaço livre e dá um percentual alto sem significar nada.
CREATE TEMP VIEW sugestao AS
SELECT i.*,
       (i.pct_mortas_medido >= 5 OR i.mortas > i.gatilho_mortas) AS precisa_vacuum
FROM inchaco i
WHERE i.pct_inchaco > :limite
  AND pg_relation_size(i.relid) >= :tamanho_min_mb * 1024 * 1024;

\echo
\echo '=== 2. Tabelas a partir de ':tamanho_min_mb' MB com inchaço acima de ':limite'% e o comando sugerido ==='
SELECT relname                AS tabela,
       particao_de,
       pg_size_pretty(bytes)  AS tamanho,
       pct_mortas_medido      AS "% mortas",
       pct_inchaco            AS "% inchaço",
       fonte,
       -- Numa tabela particionada, o comando sai por partição: o VACUUM da mãe percorreria todas.
       CASE WHEN precisa_vacuum THEN format('VACUUM (ANALYZE, VERBOSE) %I.%I;', schemaname, relname)
            ELSE format('-- só espaço livre, já reaproveitável. Para devolver ao disco, fora do expediente: VACUUM FULL %I.%I;',
                        schemaname, relname)
       END                    AS comando_sugerido
FROM sugestao
ORDER BY pct_inchaco DESC, bytes DESC;

\if :executar
\echo
\echo '=== 3. Executando os VACUUM (ANALYZE) da seção 2 (o VACUUM FULL nunca é executado por aqui) ==='
SELECT format('VACUUM (ANALYZE, VERBOSE) %I.%I', schemaname, relname)
FROM sugestao
WHERE precisa_vacuum
ORDER BY pct_inchaco DESC \gexec
\else
\echo
\echo 'Nada foi executado. Para rodar os VACUUM (ANALYZE) da seção 2: -v executar=1'
\endif
