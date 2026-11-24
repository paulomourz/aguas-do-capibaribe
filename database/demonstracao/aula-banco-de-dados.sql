-- Aula de Banco de Dados com o plano C (issue #227): tudo o que o banco do Águas do Capibaribe faz, um bloco de
-- cada vez, para a disciplina de Banco de Dados. Roteiro: docs/guia/roteiro-banco-de-dados.md.
--
-- NÃO ESTRAGA OS DADOS: o que grava, altera ou apaga roda dentro de BEGIN ... ROLLBACK, e o que o banco recusa
-- (trigger, CHECK, chave, permissão) roda num bloco DO que mostra a mensagem de erro como NOTICE, sem parar o script.
-- No fim, a parte 12 confere que todas as tabelas têm as mesmas linhas do começo. Só os contadores das sequências
-- (ids) andam: um id usado numa transação desfeita não volta (parte 8).
--
-- Rodar inteiro, no PowerShell, com o plano C de pé:
--   cmd /c "docker compose exec -T db psql -U postgres -d aguas < database\demonstracao\aula-banco-de-dados.sql"
-- No pgAdmin (servidor da porta 5433): Tools > Query Tool, abra este arquivo, selecione um bloco e aperte F5.
-- As recusas aparecem na aba Messages. Comece pela parte 0, que guarda as contagens para a parte 12.
--
-- Funciona com ou sem a massa de demonstração; precisa de pelo menos 1 lote (registre um pelo site, se não houver).

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 0. Foto do começo: quantas linhas cada tabela tem agora (a parte 12 compara)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Se a parte 0 rodar de novo, troca a foto (o aviso de "não existe" da primeira vez fica escondido).
SET client_min_messages = warning;
DROP TABLE IF EXISTS foto_inicio;
RESET client_min_messages;
CREATE TEMP TABLE foto_inicio AS
SELECT 'usuario' AS tabela, count(*) AS linhas FROM usuario
UNION ALL SELECT 'processo', count(*) FROM processo
UNION ALL SELECT 'lote', count(*) FROM lote
UNION ALL SELECT 'alerta', count(*) FROM alerta
UNION ALL SELECT 'alerta_lote', count(*) FROM alerta_lote
UNION ALL SELECT 'aviso_pendente', count(*) FROM aviso_pendente
UNION ALL SELECT 'efluentes_descarte', count(*) FROM efluentes_descarte
UNION ALL SELECT 'telemetria', count(*) FROM telemetria
UNION ALL SELECT 'auditoria_usuario', count(*) FROM auditoria_usuario;

SELECT * FROM foto_inicio ORDER BY tabela;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. O catálogo: o banco descreve a si mesmo
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- 1.1 Tabelas e visões do esquema public
SELECT table_name AS nome, table_type AS tipo
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_type, table_name;

-- 1.2 Colunas da tabela lote: tipo, se aceita nulo e o valor padrão
SELECT column_name AS coluna, data_type AS tipo, is_nullable AS aceita_nulo, column_default AS padrao
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'lote'
ORDER BY ordinal_position;

-- 1.3 Restrições de todas as tabelas: p = chave primária, f = chave estrangeira, u = única, c = CHECK
SELECT conrelid::regclass AS tabela, conname AS restricao, contype AS tipo, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, contype, conname;

-- 1.4 Índices
SELECT tablename AS tabela, indexname AS indice, indexdef AS definicao
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 1.5 Triggers: quando disparam e que função chamam
SELECT event_object_table AS tabela, trigger_name AS gatilho, action_timing AS quando,
       string_agg(event_manipulation, ' OR ' ORDER BY event_manipulation) AS evento, action_statement AS executa
FROM information_schema.triggers
WHERE trigger_schema = 'public'
GROUP BY event_object_table, trigger_name, action_timing, action_statement
ORDER BY tabela, gatilho;

-- 1.6 O código das funções dos triggers (PL/pgSQL)
SELECT p.proname AS funcao, pg_get_functiondef(p.oid) AS codigo
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
ORDER BY p.proname;

-- 1.7 A definição das visões
SELECT viewname AS visao, definition AS definicao
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. Consultas: SELECT, JOIN, GROUP BY, HAVING, subconsulta, CTE e funções de janela
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- 2.1 JOIN de 3 tabelas: os últimos lotes com o processo e quem registrou
SELECT l.id, p.nome AS processo, u.nome AS registrado_por, l.pecas, l.litros, l.esperado,
       round((l.litros - l.esperado) / l.esperado * 100, 2) AS desvio_percentual,
       l.registrado_em AT TIME ZONE 'America/Recife' AS registrado_em_recife
FROM lote l
JOIN processo p ON p.id = l.processo_id
JOIN usuario u ON u.id = l.usuario_id
ORDER BY l.id DESC
LIMIT 10;

-- 2.2 GROUP BY e HAVING: consumo por processo, só dos processos que gastaram mais que o esperado no total
SELECT p.nome AS processo, count(*) AS lotes, sum(l.litros) AS litros_gastos, sum(l.esperado) AS litros_esperados,
       round((sum(l.litros) - sum(l.esperado)) / sum(l.esperado) * 100, 2) AS desvio_total_percentual
FROM lote l
JOIN processo p ON p.id = l.processo_id
GROUP BY p.nome
HAVING sum(l.litros) > sum(l.esperado)
ORDER BY desvio_total_percentual DESC;

-- 2.3 Subconsulta: lotes que gastaram mais que a média do próprio processo
SELECT l.id, p.nome AS processo, l.litros,
       (SELECT round(avg(x.litros), 2) FROM lote x WHERE x.processo_id = l.processo_id) AS media_do_processo
FROM lote l
JOIN processo p ON p.id = l.processo_id
WHERE l.litros > (SELECT avg(x.litros) FROM lote x WHERE x.processo_id = l.processo_id)
ORDER BY p.nome, l.litros DESC
LIMIT 10;

-- 2.4 CTE e funções de janela (LAG): a regra do alerta escrita em SQL.
-- Um lote abre alerta quando ele e os 2 anteriores do mesmo processo ficaram acima do esperado.
WITH lotes AS (
    SELECT l.id, p.nome AS processo, l.registrado_em, l.litros > l.esperado AS acima,
           lag(l.litros > l.esperado, 1) OVER w AS anterior_acima,
           lag(l.litros > l.esperado, 2) OVER w AS antes_do_anterior_acima
    FROM lote l
    JOIN processo p ON p.id = l.processo_id
    WINDOW w AS (PARTITION BY l.processo_id ORDER BY l.registrado_em, l.id)
)
SELECT id AS lote_que_fecha_a_sequencia, processo, registrado_em AT TIME ZONE 'America/Recife' AS registrado_em_recife
FROM lotes
WHERE acima AND anterior_acima AND antes_do_anterior_acima
ORDER BY registrado_em;

-- 2.5 Função de janela de acumulado: litros gastos dia a dia e o total acumulado no mês, por processo
SELECT p.nome AS processo, (l.registrado_em AT TIME ZONE 'America/Recife')::date AS dia, sum(l.litros) AS litros_no_dia,
       sum(sum(l.litros)) OVER (PARTITION BY p.nome ORDER BY (l.registrado_em AT TIME ZONE 'America/Recife')::date)
           AS acumulado
FROM lote l
JOIN processo p ON p.id = l.processo_id
GROUP BY p.nome, dia
ORDER BY p.nome, dia
LIMIT 15;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. INSERT com trigger: o banco calcula o "esperado" sozinho
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- O INSERT não informa "esperado". O trigger trg_lote_esperado (BEFORE INSERT) busca a meta do processo e preenche:
-- por lote, a própria meta; por peça, meta × peças. ROLLBACK no fim: o lote não fica.
BEGIN;
INSERT INTO lote (processo_id, usuario_id, pecas, litros)
SELECT p.id, (SELECT min(id) FROM usuario WHERE ativo), 40, 500
FROM processo p
WHERE p.unidade = 'peca'
ORDER BY p.id
LIMIT 1
RETURNING id, processo_id, pecas, litros, esperado AS esperado_calculado_pelo_trigger;
ROLLBACK;

-- 3.1 O mesmo trigger recusa lote de usuário desativado
BEGIN;
INSERT INTO usuario (nome, login, senha_hash, perfil, ativo)
VALUES ('Operador desativado (aula)', 'aula.desativado', repeat('x', 60), 'operador', false);
DO $$
BEGIN
    INSERT INTO lote (processo_id, usuario_id, pecas, litros)
    SELECT (SELECT min(id) FROM processo), id, 10, 100 FROM usuario WHERE login = 'aula.desativado';
    RAISE NOTICE 'ACEITO (não devia)';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RECUSADO pelo trigger trg_lote_esperado: %', SQLERRM;
END $$;
ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. UPDATE: o que pode e o que não pode mudar
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- 4.1 Mudar a meta de um processo é permitido. Os lotes antigos guardam o esperado da época: o histórico não muda.
BEGIN;
SELECT id, nome, meta AS meta_antes FROM processo ORDER BY id LIMIT 1;
UPDATE processo SET meta = meta * 2 WHERE id = (SELECT min(id) FROM processo)
RETURNING id, nome, meta AS meta_depois;
SELECT l.id, l.esperado AS esperado_guardado, p.meta AS meta_nova
FROM lote l JOIN processo p ON p.id = l.processo_id
WHERE p.id = (SELECT min(id) FROM processo)
ORDER BY l.id DESC
LIMIT 3;
ROLLBACK;

-- 4.2 Lote não se altera: trigger trg_lote_imutavel (BEFORE UPDATE OR DELETE), nem para o dono do banco
DO $$
BEGIN
    UPDATE lote SET litros = 1 WHERE id = (SELECT min(id) FROM lote);
    RAISE NOTICE 'ACEITO (não devia)';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RECUSADO pelo trigger trg_lote_imutavel: %', SQLERRM;
END $$;

-- 4.3 A auditoria também não se altera: trigger trg_auditoria_imutavel
DO $$
BEGIN
    UPDATE auditoria_usuario SET acao = 'CRIACAO_USUARIO' WHERE id = (SELECT min(id) FROM auditoria_usuario);
    IF NOT FOUND THEN
        RAISE NOTICE 'Sem linhas na auditoria ainda: cadastre um usuário pelo site para ver esta recusa.';
    ELSE
        RAISE NOTICE 'ACEITO (não devia)';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RECUSADO pelo trigger trg_auditoria_imutavel: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 5. DELETE: o que o banco deixa e o que ele protege
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- 5.1 DELETE de lote: recusado pelo trigger (o histórico de consumo é a prova do que aconteceu)
DO $$
BEGIN
    DELETE FROM lote WHERE id = (SELECT min(id) FROM lote);
    RAISE NOTICE 'ACEITO (não devia)';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RECUSADO pelo trigger trg_lote_imutavel: %', SQLERRM;
END $$;

-- 5.2 DELETE de processo que tem lotes: recusado pela chave estrangeira lote_processo_id_fkey
DO $$
BEGIN
    DELETE FROM processo WHERE id = (SELECT min(processo_id) FROM lote);
    RAISE NOTICE 'ACEITO (não devia)';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RECUSADO pela chave estrangeira: %', SQLERRM;
END $$;

-- 5.3 DELETE permitido: um processo novo, sem lotes, sai normalmente (DELETE ... RETURNING mostra o que saiu)
BEGIN;
INSERT INTO processo (nome, unidade, meta) VALUES ('Processo da aula', 'lote', 100) RETURNING *;
DELETE FROM processo WHERE nome = 'Processo da aula' RETURNING *;
ROLLBACK;

-- 5.4 TRUNCATE esvazia a tabela de uma vez e NÃO dispara os triggers de linha. Também é transacional no
-- PostgreSQL: com ROLLBACK, tudo volta. (Na apresentação, é assim que o roteiro limpa o histórico.)
BEGIN;
TRUNCATE alerta_lote, aviso_pendente, alerta, efluentes_descarte, telemetria, lote;
SELECT count(*) AS lotes_depois_do_truncate FROM lote;
ROLLBACK;
SELECT count(*) AS lotes_depois_do_rollback FROM lote;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 6. Restrições: o banco recusa dado impossível
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_lote integer := (SELECT min(id) FROM lote);
    v_usuario integer := (SELECT min(id) FROM usuario);
BEGIN
    -- CHECK: pH vai de 0 a 14
    BEGIN
        INSERT INTO efluentes_descarte (lote_id, volume_litros, ph, turbidez_ntu) VALUES (v_lote, 10, 15, 1);
        RAISE NOTICE 'ACEITO (não devia)';
    EXCEPTION WHEN check_violation THEN RAISE NOTICE 'RECUSADO pelo CHECK: %', SQLERRM;
    END;
    -- CHECK: litros maior que zero
    BEGIN
        INSERT INTO lote (processo_id, usuario_id, pecas, litros) VALUES ((SELECT min(id) FROM processo), v_usuario, 1, -5);
        RAISE NOTICE 'ACEITO (não devia)';
    EXCEPTION WHEN check_violation THEN RAISE NOTICE 'RECUSADO pelo CHECK: %', SQLERRM;
    END;
    -- CHECK: status do alerta só aberto, analise ou resolvido
    BEGIN
        INSERT INTO alerta (processo_id, status) VALUES ((SELECT min(id) FROM processo), 'esquecido');
        RAISE NOTICE 'ACEITO (não devia)';
    EXCEPTION WHEN check_violation THEN RAISE NOTICE 'RECUSADO pelo CHECK: %', SQLERRM;
    END;
    -- NOT NULL: lote sem litros
    BEGIN
        INSERT INTO lote (processo_id, usuario_id, pecas) VALUES ((SELECT min(id) FROM processo), v_usuario, 1);
        RAISE NOTICE 'ACEITO (não devia)';
    EXCEPTION WHEN not_null_violation THEN RAISE NOTICE 'RECUSADO pelo NOT NULL: %', SQLERRM;
    END;
    -- UNIQUE: dois processos com o mesmo nome
    BEGIN
        INSERT INTO processo (nome, unidade, meta) SELECT nome, unidade, meta FROM processo ORDER BY id LIMIT 1;
        RAISE NOTICE 'ACEITO (não devia)';
    EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'RECUSADO pelo UNIQUE: %', SQLERRM;
    END;
    -- FOREIGN KEY: descarte de um lote que não existe
    BEGIN
        INSERT INTO efluentes_descarte (lote_id, volume_litros, ph, turbidez_ntu) VALUES (-1, 10, 7, 1);
        RAISE NOTICE 'ACEITO (não devia)';
    EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'RECUSADO pela chave estrangeira: %', SQLERRM;
    END;
    -- PRIMARY KEY: um lote só pode estar em um alerta (alerta_lote tem chave primária em lote_id)
    BEGIN
        INSERT INTO alerta_lote (lote_id, alerta_id) SELECT lote_id, alerta_id FROM alerta_lote LIMIT 1;
        IF NOT FOUND THEN
            RAISE NOTICE 'Sem alertas ainda: rode a massa ou abra um alerta para ver esta recusa.';
        ELSE
            RAISE NOTICE 'ACEITO (não devia)';
        END IF;
    EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'RECUSADO pela chave primária: %', SQLERRM;
    END;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 7. Transações: tudo ou nada, e SAVEPOINT para desfazer só uma parte
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;
INSERT INTO processo (nome, unidade, meta) VALUES ('Aula: fica até o fim', 'lote', 100);
SAVEPOINT antes_do_segundo;
INSERT INTO processo (nome, unidade, meta) VALUES ('Aula: desfeito no savepoint', 'lote', 100);
ROLLBACK TO SAVEPOINT antes_do_segundo;
-- Dentro da transação: só o primeiro existe
SELECT nome FROM processo WHERE nome LIKE 'Aula:%';
ROLLBACK;
-- Depois do ROLLBACK: nenhum dos dois
SELECT count(*) AS processos_da_aula_depois_do_rollback FROM processo WHERE nome LIKE 'Aula:%';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 8. Sequências: o id usado numa transação desfeita não volta
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- É por isso que os ids podem ter buracos: o nextval() não participa do ROLLBACK, para duas transações ao mesmo
-- tempo nunca pegarem o mesmo id.
SELECT last_value AS ultimo_id_de_processo_usado FROM processo_id_seq;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 9. Permissões: a API entra com um usuário que só pode o necessário (privilégio mínimo)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- 9.1 O que o aguas_api pode em cada tabela
SELECT table_name AS tabela, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS pode
FROM information_schema.role_table_grants
WHERE grantee = 'aguas_api'
GROUP BY table_name
ORDER BY table_name;

-- 9.2 Agindo como a API (SET LOCAL ROLE vale só até o fim da transação): ler pode; apagar e criar tabela, não
BEGIN;
SET LOCAL ROLE aguas_api;
SELECT current_user AS agindo_como, count(*) AS lotes_que_a_api_le FROM lote;
DO $$
BEGIN
    BEGIN
        DELETE FROM lote WHERE id = (SELECT min(id) FROM lote);
        RAISE NOTICE 'ACEITO (não devia)';
    EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'RECUSADO pela permissão: %', SQLERRM;
    END;
    BEGIN
        DELETE FROM processo WHERE false;
        RAISE NOTICE 'ACEITO (não devia)';
    EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'RECUSADO pela permissão: %', SQLERRM;
    END;
    BEGIN
        CREATE TABLE tabela_da_aula (id integer);
        RAISE NOTICE 'ACEITO (não devia)';
    EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'RECUSADO pela permissão: %', SQLERRM;
    END;
END $$;
ROLLBACK;
SELECT current_user AS de_volta_como;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 10. Índices: o plano de execução com e sem índice
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- A consulta do Histórico usa o índice ix_lote_processo_data. O otimizador escolhe pelo custo estimado: com poucos
-- lotes, ele pode preferir ler a tabela inteira (Seq Scan). Desligando a leitura sequencial só nesta transação, o
-- plano com o índice aparece sempre. Compare o custo (cost) e o tempo (actual time) dos dois.
EXPLAIN ANALYZE
SELECT * FROM lote WHERE processo_id = (SELECT min(id) FROM processo) ORDER BY registrado_em DESC, id DESC LIMIT 20;

BEGIN;
SET LOCAL enable_seqscan = off;
EXPLAIN ANALYZE
SELECT * FROM lote WHERE processo_id = (SELECT min(id) FROM processo) ORDER BY registrado_em DESC, id DESC LIMIT 20;
ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 11. Visões e versão do banco
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- 11.1 Visão de alertas: quantos lotes formaram cada um
SELECT * FROM v_alertas ORDER BY detectado_em DESC;

-- 11.2 Visão de conformidade dos efluentes por mês e processo (V15)
SELECT * FROM v_efluentes_mensal ORDER BY mes DESC, processo_id;

-- 11.3 Histórico das migrações do Flyway: cada mudança no banco é um arquivo versionado
SELECT installed_rank AS ordem, version AS versao, description AS descricao, installed_on AS aplicada_em, success AS ok
FROM flyway_schema_history
ORDER BY installed_rank;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 12. Conferência: o banco terminou igual ao começo
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
WITH agora AS (
    SELECT 'usuario' AS tabela, count(*) AS linhas FROM usuario
    UNION ALL SELECT 'processo', count(*) FROM processo
    UNION ALL SELECT 'lote', count(*) FROM lote
    UNION ALL SELECT 'alerta', count(*) FROM alerta
    UNION ALL SELECT 'alerta_lote', count(*) FROM alerta_lote
    UNION ALL SELECT 'aviso_pendente', count(*) FROM aviso_pendente
    UNION ALL SELECT 'efluentes_descarte', count(*) FROM efluentes_descarte
    UNION ALL SELECT 'telemetria', count(*) FROM telemetria
    UNION ALL SELECT 'auditoria_usuario', count(*) FROM auditoria_usuario
)
SELECT a.tabela, i.linhas AS no_comeco, a.linhas AS agora,
       CASE WHEN a.linhas = i.linhas THEN 'igual' ELSE 'MUDOU (alguém usou o site durante a aula?)' END AS situacao
FROM agora a
JOIN foto_inicio i USING (tabela)
ORDER BY a.tabela;
