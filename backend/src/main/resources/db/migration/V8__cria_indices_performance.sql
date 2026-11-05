-- V8: índices para as consultas que o EXPLAIN ANALYZE mostrou lentas (issue #59).
-- A medição está em docs/tecnico/desempenho-indices.md e pode ser repetida com os scripts de
-- database/desempenho/. Só entra aqui o índice que mudou o plano e o tempo na medição.

-- Regra de alerta, a cada lote registrado e com o processo bloqueado (LoteService.registrar):
--   where processo_id = ? and id <> ? order by registrado_em desc, id desc limit 2
-- Sem este índice, o PostgreSQL percorre os lotes de todos os processos, do mais novo ao mais antigo,
-- até achar 2 do processo; num processo pouco usado, isso é a tabela quase inteira. Com ele, lê só 2.
-- Começa por processo_id, então também atende a chave estrangeira e substitui o ix_lote_processo da V1.
CREATE INDEX ix_lote_processo_data ON lote USING btree (processo_id, registrado_em DESC, id DESC);
DROP INDEX IF EXISTS ix_lote_processo;

-- Lotes de um alerta, na listagem e no detalhe (AlertaLoteRepository.findByAlertaIdIn):
--   where alerta_id in (...)
-- A chave primária de alerta_lote é só lote_id; sem este índice, cada busca lê a tabela inteira.
CREATE INDEX ix_alerta_lote_alerta ON alerta_lote USING btree (alerta_id);
