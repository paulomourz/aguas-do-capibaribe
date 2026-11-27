-- =====================================================================================================================
-- Testes do banco de dados pelo plano C (issue #225)
--
-- Comandos prontos para a aula de Banco de Dados: ver, inserir, alterar, ativar e desativar, e o que o banco recusa.
-- Roteiro completo em docs/guia/roteiro-banco-de-dados.md.
--
-- COMO USAR, no pgAdmin: Tools > Query Tool, abra este arquivo pelo ícone de pasta, selecione UM bloco (de um
-- comentário "--" até o próximo) e aperte F5. Rode bloco a bloco: os comandos marcados com "RECUSADO" param com erro de
-- propósito, e o Query Tool pararia ali se o arquivo inteiro rodasse de uma vez.
--
-- O QUE MUDA OS DADOS:
--   * Partes 2 e 4 gravam de verdade, mas só em registros de teste (o usuário "teste.sql" e o processo "Teste da
--     aula"), e terminam apagando o que criaram.
--   * Parte 3 ativa e desativa de verdade o usuário criado pelo site (troque 'teste.aula' pelo login que você criou).
--   * Partes 5 a 8 rodam dentro de BEGIN ... ROLLBACK: o professor vê o resultado e nada fica gravado. Para gravar de
--     verdade e ver no site, troque o ROLLBACK por COMMIT (só nos blocos de lote, descarte e alerta).
--
-- ANTES: carregue a massa de demonstração (passo 2 do roteiro). Sem ela não há alertas nem descartes, e os blocos
-- dessas tabelas voltam vazios ou sem a recusa. A massa não cadastra preço do m³: para o UPDATE recusado da parte 8,
-- cadastre um preço antes no site, como gestor, na tela do custo da água.
-- =====================================================================================================================


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 0. Onde estou conectado
-- ---------------------------------------------------------------------------------------------------------------------

-- 0.1 Versão do PostgreSQL, banco e usuário da conexão
SELECT version(), current_database() AS banco, current_user AS usuario_do_banco;

-- 0.2 Todas as tabelas, com a quantidade de linhas
SELECT relname AS tabela, n_live_tup AS linhas
FROM pg_stat_user_tables
ORDER BY relname;

-- 0.3 As migrações do Flyway que criaram o banco (a última é a versão atual do esquema)
SELECT installed_rank, version, description, installed_on, success
FROM flyway_schema_history
ORDER BY installed_rank;


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 1. Ver os usuários (SELECT)
-- ---------------------------------------------------------------------------------------------------------------------

-- 1.1 Todos os usuários. A senha fica só como hash bcrypt (60 caracteres); o token do sensor, como hash SHA-256
SELECT id, nome, login, perfil, ativo, criado_em AT TIME ZONE 'America/Recife' AS criado_em_recife,
       length(senha_hash) AS tamanho_do_hash, token_hash IS NOT NULL AS tem_token
FROM usuario
ORDER BY id;

-- 1.2 Só os ativos, ou só os inativos
SELECT id, login, perfil FROM usuario WHERE ativo = true  ORDER BY id;
SELECT id, login, perfil FROM usuario WHERE ativo = false ORDER BY id;

-- 1.3 Quantos usuários há em cada perfil (GROUP BY)
SELECT perfil, count(*) AS total, count(*) FILTER (WHERE ativo) AS ativos
FROM usuario
GROUP BY perfil
ORDER BY perfil;

-- 1.4 Um usuário pelo login (troque pelo login criado no site)
SELECT id, nome, login, perfil, ativo FROM usuario WHERE login = 'teste.aula';

-- 1.5 A auditoria, com o nome de quem fez e de quem sofreu a ação (JOIN da mesma tabela duas vezes)
SELECT a.id, a.acao, g.login AS feito_por, u.login AS usuario_afetado,
       a.data_hora AT TIME ZONE 'America/Recife' AS quando_recife
FROM auditoria_usuario a
JOIN usuario g ON g.id = a.gestor_id
JOIN usuario u ON u.id = a.usuario_afetado_id
ORDER BY a.id DESC;

-- 1.6 Quem registrou mais lotes (JOIN + GROUP BY + ORDER BY)
SELECT u.login, u.perfil, count(l.id) AS lotes, coalesce(sum(l.litros), 0) AS litros
FROM usuario u
LEFT JOIN lote l ON l.usuario_id = u.id
GROUP BY u.id, u.login, u.perfil
ORDER BY lotes DESC;


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 2. INSERT, UPDATE e DELETE de um usuário de teste (grava de verdade e apaga no fim)
-- ---------------------------------------------------------------------------------------------------------------------

-- 2.1 INSERT: um usuário criado direto no banco. O hash é falso (60 caracteres, para passar no CHECK), então este
--     usuário não consegue entrar no site. Criado assim, sem a API, ele não ganha linha de auditoria.
INSERT INTO usuario (nome, login, senha_hash, perfil)
VALUES ('Teste pelo SQL', 'teste.sql', repeat('x', 60), 'operador')
RETURNING id, login, perfil, ativo, criado_em;

-- 2.2 UPDATE: mudar o nome e o perfil
UPDATE usuario SET nome = 'Teste alterado', perfil = 'gestor'
WHERE login = 'teste.sql'
RETURNING id, nome, login, perfil;

-- 2.3 RECUSADO: login repetido (UNIQUE usuario_login_key)
INSERT INTO usuario (nome, login, senha_hash, perfil) VALUES ('Outro', 'teste.sql', repeat('x', 60), 'operador');

-- 2.4 RECUSADO: perfil que não existe (CHECK usuario_perfil_check aceita admin, gestor, operador e sensor)
UPDATE usuario SET perfil = 'chefe' WHERE login = 'teste.sql';

-- 2.5 RECUSADO: login com menos de 3 letras (CHECK usuario_login_check)
UPDATE usuario SET login = 'ab' WHERE login = 'teste.sql';

-- 2.6 RECUSADO: senha guardada em texto puro (CHECK usuario_senha_hash_check exige o hash de 60 caracteres)
UPDATE usuario SET senha_hash = '123456' WHERE login = 'teste.sql';

-- 2.7 DELETE que FUNCIONA: este usuário não tem lote nem auditoria, então nada aponta para ele
DELETE FROM usuario WHERE login = 'teste.sql' RETURNING id, login;

-- 2.8 Confere que sumiu (0 linhas)
SELECT * FROM usuario WHERE login = 'teste.sql';


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 3. Usuário criado pelo SITE: o DELETE é recusado; desativar e reativar (grava de verdade)
--          Antes: no site, em Usuários, cadastre um operador. Troque 'teste.aula' pelo login dele.
-- ---------------------------------------------------------------------------------------------------------------------

-- 3.1 O usuário e a auditoria que a API gravou junto, na mesma transação (CRIACAO_USUARIO)
SELECT u.id, u.login, u.perfil, u.ativo, a.acao, a.data_hora AT TIME ZONE 'America/Recife' AS quando_recife
FROM usuario u
LEFT JOIN auditoria_usuario a ON a.usuario_afetado_id = u.id
WHERE u.login = 'teste.aula';

-- 3.2 RECUSADO: apagar o usuário. A auditoria aponta para ele (FOREIGN KEY auditoria_usuario_usuario_afetado_id_fkey)
DELETE FROM usuario WHERE login = 'teste.aula';

-- 3.3 RECUSADO: apagar a auditoria primeiro. O trigger trg_auditoria_imutavel protege o histórico
DELETE FROM auditoria_usuario
WHERE usuario_afetado_id = (SELECT id FROM usuario WHERE login = 'teste.aula');

-- 3.4 RECUSADO: alterar a auditoria (o mesmo trigger)
UPDATE auditoria_usuario SET acao = 'REDEFINICAO_SENHA'
WHERE usuario_afetado_id = (SELECT id FROM usuario WHERE login = 'teste.aula');

-- 3.5 DESATIVAR: o jeito certo de tirar alguém. Depois disso, o login dele é recusado no site
UPDATE usuario SET ativo = false WHERE login = 'teste.aula' RETURNING id, login, ativo;

-- 3.6 RECUSADO: usuário desativado não registra lote (trigger trg_lote_esperado: "Usuário inativo ou inexistente.")
INSERT INTO lote (processo_id, usuario_id, pecas, litros)
VALUES (1, (SELECT id FROM usuario WHERE login = 'teste.aula'), 100, 790);

-- 3.7 REATIVAR: volta a entrar no site
UPDATE usuario SET ativo = true WHERE login = 'teste.aula' RETURNING id, login, ativo;

-- 3.8 Compare com o botão do site: desative pelo site (Usuários > Desativar) e rode de novo. Pelo site aparece a linha
--     DESATIVACAO_USUARIO; pelo SQL, não, porque quem grava a auditoria é a API.
SELECT a.id, a.acao, g.login AS feito_por, a.data_hora AT TIME ZONE 'America/Recife' AS quando_recife
FROM auditoria_usuario a
JOIN usuario g ON g.id = a.gestor_id
WHERE a.usuario_afetado_id = (SELECT id FROM usuario WHERE login = 'teste.aula')
ORDER BY a.id;


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 4. Processos: INSERT, UPDATE e DELETE (grava de verdade e apaga no fim)
-- ---------------------------------------------------------------------------------------------------------------------

-- 4.1 Os processos e a meta de água de cada um
SELECT id, nome, unidade, meta FROM processo ORDER BY id;

-- 4.2 INSERT de um processo de teste
INSERT INTO processo (nome, unidade, meta) VALUES ('Teste da aula', 'lote', 1000)
RETURNING id, nome, unidade, meta;

-- 4.3 UPDATE da meta. Aparece na hora no site, em Processos (aperte F5)
UPDATE processo SET meta = 950 WHERE nome = 'Teste da aula' RETURNING id, nome, meta;

-- 4.4 RECUSADO: meta zero (CHECK processo_meta_check), unidade inventada (CHECK processo_unidade_check) e nome
--     repetido (UNIQUE processo_nome_key). Rode um por vez
UPDATE processo SET meta = 0 WHERE nome = 'Teste da aula';
UPDATE processo SET unidade = 'kg' WHERE nome = 'Teste da aula';
INSERT INTO processo (nome, unidade, meta) VALUES ('Amaciamento', 'lote', 500);

-- 4.5 DELETE que FUNCIONA: o processo de teste não tem lotes
DELETE FROM processo WHERE nome = 'Teste da aula' RETURNING id, nome;

-- 4.6 RECUSADO: apagar um processo que tem lotes (FOREIGN KEY lote_processo_id_fkey)
DELETE FROM processo WHERE nome = 'Amaciamento';


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 5. Lotes: consultas, INSERT com trigger e o que é recusado
-- ---------------------------------------------------------------------------------------------------------------------

-- 5.1 Os últimos lotes, com o processo, quem registrou e o desvio em relação à meta
SELECT l.id, p.nome AS processo, u.login AS registrado_por, l.pecas, l.litros, l.esperado,
       round((l.litros - l.esperado) / l.esperado * 100, 2) AS desvio_percentual,
       l.registrado_em AT TIME ZONE 'America/Recife' AS registrado_em_recife
FROM lote l
JOIN processo p ON p.id = l.processo_id
JOIN usuario u ON u.id = l.usuario_id
ORDER BY l.id DESC
LIMIT 10;

-- 5.2 A mesma coisa pela visão do Histórico
SELECT * FROM v_historico_lotes ORDER BY lote_id DESC LIMIT 10;

-- 5.3 Consumo por processo, com os lotes acima da meta (GROUP BY + FILTER)
SELECT p.nome AS processo, count(*) AS lotes, sum(l.litros) AS litros, sum(l.esperado) AS esperado,
       count(*) FILTER (WHERE l.litros > l.esperado) AS acima_da_meta
FROM lote l
JOIN processo p ON p.id = l.processo_id
GROUP BY p.nome
ORDER BY litros DESC;

-- 5.4 Consumo por dia (para comparar com o gráfico do Dashboard)
SELECT (l.registrado_em AT TIME ZONE 'America/Recife')::date AS dia, count(*) AS lotes, sum(l.litros) AS litros
FROM lote l
GROUP BY dia
ORDER BY dia DESC;

-- 5.5 INSERT de lote SEM o valor esperado: o trigger trg_lote_esperado calcula pela meta do processo.
--     Amaciamento é por lote (esperado = 800); Estonagem é por peça (esperado = 12 x peças).
--     Roda e desfaz. Troque ROLLBACK por COMMIT para o lote aparecer no site, em Histórico
BEGIN;
INSERT INTO lote (processo_id, usuario_id, pecas, litros)
VALUES (1, (SELECT id FROM usuario WHERE login = 'capibaribe.admin'), 100, 790)
RETURNING id, processo_id, pecas, litros, esperado;
INSERT INTO lote (processo_id, usuario_id, pecas, litros)
VALUES (2, (SELECT id FROM usuario WHERE login = 'capibaribe.admin'), 50, 580)
RETURNING id, processo_id, pecas, litros, esperado;
ROLLBACK;

-- 5.6 RECUSADO: alterar ou apagar um lote (trigger trg_lote_imutavel). Lote errado se corrige com outro lote
UPDATE lote SET litros = 1 WHERE id = (SELECT min(id) FROM lote);
DELETE FROM lote WHERE id = (SELECT min(id) FROM lote);

-- 5.7 RECUSADO: litros negativos, zero peças (CHECK) e lote sem litros (NOT NULL). Rode um por vez
INSERT INTO lote (processo_id, usuario_id, pecas, litros) VALUES (1, 1, 100, -5);
INSERT INTO lote (processo_id, usuario_id, pecas, litros) VALUES (1, 1, 0, 790);
INSERT INTO lote (processo_id, usuario_id, pecas) VALUES (1, 1, 100);

-- 5.8 RECUSADO: processo que não existe. O trigger roda antes da chave estrangeira, não acha a meta e deixa o
--     esperado vazio, e o NOT NULL de "esperado" barra o lote
INSERT INTO lote (processo_id, usuario_id, pecas, litros) VALUES (999, 1, 100, 790);


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 6. Alertas: consultas e mudança de status
-- ---------------------------------------------------------------------------------------------------------------------

-- 6.1 Os alertas, pela visão (processo e quantidade de lotes)
SELECT * FROM v_alertas ORDER BY alerta_id DESC;

-- 6.2 Quais lotes formaram cada alerta (tabela N para N alerta_lote)
SELECT al.alerta_id, a.status, l.id AS lote_id, p.nome AS processo, l.litros, l.esperado
FROM alerta_lote al
JOIN alerta a ON a.id = al.alerta_id
JOIN lote l ON l.id = al.lote_id
JOIN processo p ON p.id = l.processo_id
ORDER BY al.alerta_id, l.id;

-- 6.3 UPDATE do status (como o botão da tela Alertas). Roda e desfaz; troque por COMMIT para ver no site
BEGIN;
UPDATE alerta SET status = 'analise', atualizado_em = now()
WHERE id = (SELECT max(id) FROM alerta)
RETURNING id, status, atualizado_em;
ROLLBACK;

-- 6.4 RECUSADO: status inventado (CHECK alerta_status_check aceita aberto, analise e resolvido)
UPDATE alerta SET status = 'cancelado' WHERE id = (SELECT max(id) FROM alerta);

-- 6.5 RECUSADO: o mesmo lote duas vezes no mesmo alerta (PRIMARY KEY de alerta_lote)
INSERT INTO alerta_lote (alerta_id, lote_id) SELECT alerta_id, lote_id FROM alerta_lote LIMIT 1;


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 7. Efluentes: descartes e a conformidade com a CONAMA 430 (pH de 5 a 9)
-- ---------------------------------------------------------------------------------------------------------------------

-- 7.1 Os últimos descartes, com o processo do lote e se o pH está fora de 5 a 9
SELECT d.id, d.lote_id, p.nome AS processo, d.volume_litros, d.ph, d.turbidez_ntu, d.reutilizado_percentual,
       (d.ph < 5 OR d.ph > 9) AS fora_do_ph,
       d.data_descarte AT TIME ZONE 'America/Recife' AS quando_recife
FROM efluentes_descarte d
JOIN lote l ON l.id = d.lote_id
JOIN processo p ON p.id = l.processo_id
ORDER BY d.id DESC
LIMIT 10;

-- 7.2 O resumo mensal pela visão (o mesmo da tela de efluentes)
SELECT * FROM v_efluentes_mensal ORDER BY mes DESC, processo_id;

-- 7.3 INSERT de descarte. A data vem do DEFAULT now(). Roda e desfaz; troque por COMMIT para ver no site
BEGIN;
INSERT INTO efluentes_descarte (lote_id, volume_litros, ph, turbidez_ntu, reutilizado_percentual)
VALUES ((SELECT max(id) FROM lote), 200, 7.2, 35, 20)
RETURNING id, lote_id, volume_litros, ph, data_descarte;
ROLLBACK;

-- 7.4 RECUSADO: pH 15, turbidez negativa, reúso acima de 100% (CHECK) e lote que não existe (FOREIGN KEY).
--     Rode um por vez
INSERT INTO efluentes_descarte (lote_id, volume_litros, ph, turbidez_ntu) VALUES (1, 100, 15, 10);
INSERT INTO efluentes_descarte (lote_id, volume_litros, ph, turbidez_ntu) VALUES (1, 100, 7, -1);
INSERT INTO efluentes_descarte (lote_id, volume_litros, ph, turbidez_ntu, reutilizado_percentual) VALUES (1, 100, 7, 10, 150);
INSERT INTO efluentes_descarte (lote_id, volume_litros, ph, turbidez_ntu) VALUES (999999, 100, 7, 10);


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 8. Preço do m³, telemetria do sensor e avisos do Telegram
-- ---------------------------------------------------------------------------------------------------------------------

-- 8.1 Preços do m³ cadastrados, com quem cadastrou
SELECT pm.id, pm.valor, pm.vigencia, u.login AS cadastrado_por, pm.cadastrado_em AT TIME ZONE 'America/Recife' AS em
FROM preco_m3 pm
JOIN usuario u ON u.id = pm.usuario_id
ORDER BY pm.vigencia DESC, pm.id DESC;

-- 8.2 INSERT de preço novo. Roda e desfaz
BEGIN;
INSERT INTO preco_m3 (valor, vigencia, usuario_id)
VALUES (18.50, current_date, (SELECT id FROM usuario WHERE login = 'capibaribe.admin'))
RETURNING id, valor, vigencia;
ROLLBACK;

-- 8.3 RECUSADO: preço zero (CHECK). Alterar ou apagar um preço também é recusado (trigger trg_preco_m3_imutavel):
--     preço errado se corrige cadastrando outro na mesma vigência
INSERT INTO preco_m3 (valor, vigencia, usuario_id) VALUES (0, current_date, 1);
UPDATE preco_m3 SET valor = 1 WHERE id = (SELECT min(id) FROM preco_m3);

-- 8.4 Sinal de vida do sensor: as leituras de vazão mais recentes (a cada 15 s, com o Wokwi ligado)
SELECT t.id, p.nome AS processo, t.vazao_litros, t.registrado_em AT TIME ZONE 'America/Recife' AS quando_recife
FROM telemetria t
JOIN processo p ON p.id = t.processo_id
ORDER BY t.id DESC
LIMIT 10;

-- 8.5 Avisos do Telegram que falharam e esperam reenvio (vazio quando tudo foi enviado)
SELECT * FROM aviso_pendente ORDER BY id DESC;


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 9. Permissões: o usuário da API (aguas_api) só tem o mínimo
-- ---------------------------------------------------------------------------------------------------------------------

-- 9.1 O que o aguas_api pode fazer em cada tabela
SELECT table_name AS tabela, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS pode
FROM information_schema.role_table_grants
WHERE grantee = 'aguas_api'
GROUP BY table_name
ORDER BY table_name;

-- 9.2 Testando como aguas_api: ler funciona; apagar e criar tabela são recusados (privilégio mínimo).
--     Rode o bloco inteiro: o ROLLBACK no fim volta ao usuário postgres
BEGIN;
SET LOCAL ROLE aguas_api;
SELECT current_user, count(*) AS lotes FROM lote;
SAVEPOINT antes;
DELETE FROM processo WHERE id = 1;          -- RECUSADO: permission denied
ROLLBACK TO SAVEPOINT antes;
CREATE TABLE invasora (id int);             -- RECUSADO: permission denied
ROLLBACK;


-- ---------------------------------------------------------------------------------------------------------------------
-- PARTE 10. Conferência final
-- ---------------------------------------------------------------------------------------------------------------------

-- 10.1 Os registros de teste das partes 2 e 4 já foram apagados (as duas contagens dão 0)
SELECT (SELECT count(*) FROM usuario WHERE login = 'teste.sql') AS usuario_teste_sql,
       (SELECT count(*) FROM processo WHERE nome = 'Teste da aula') AS processo_teste;

-- 10.2 O usuário do site continua lá, com o histórico de auditoria (ativo ou não, conforme a parte 3)
SELECT id, login, perfil, ativo FROM usuario WHERE login = 'teste.aula';
