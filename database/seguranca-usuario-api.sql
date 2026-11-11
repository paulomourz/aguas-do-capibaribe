-- Cria o usuário da aplicação (aguas_api) com o mínimo de permissões que a API precisa.
-- Depois disso, a API deixa de conectar como o superusuário postgres (ver docs/tecnico/banco-remoto.md).
--
-- Rode como dono do banco (postgres), com psql 18+, passando três variáveis:
--   psql -U postgres -d aguas -v ON_ERROR_STOP=1 ^
--        -v papel=aguas_api -v banco=aguas -v senha='SENHA-FORTE-AQUI' ^
--        -f database/seguranca-usuario-api.sql
--
-- A senha não fica neste arquivo: entra por -v e o PostgreSQL guarda só o hash SCRAM-SHA-256.
-- Depois, coloque DB_USER e DB_PASSWORD no backend/.env (fora do Git).

\if :{?papel}
\else
  \echo 'Faltou -v papel=<nome do usuário>'
  \quit
\endif
\if :{?banco}
\else
  \echo 'Faltou -v banco=<nome do banco>'
  \quit
\endif
\if :{?senha}
\else
  \echo 'Faltou -v senha=<senha forte>'
  \quit
\endif

SET password_encryption = 'scram-sha-256';

-- 1. O usuário: só faz login. Não é superusuário, não cria bancos nem outros usuários.
CREATE ROLE :"papel" LOGIN PASSWORD :'senha'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

-- 2. Pode conectar neste banco e enxergar o esquema public, mas não criar objetos nele.
GRANT CONNECT ON DATABASE :"banco" TO :"papel";
GRANT USAGE ON SCHEMA public TO :"papel";
REVOKE CREATE ON SCHEMA public FROM :"papel";

-- 3. Tabelas que a API altera: lê, insere e atualiza. Sem DELETE.
--    processo precisa de UPDATE também para o SELECT ... FOR UPDATE do registro de lote.
GRANT SELECT, INSERT, UPDATE ON public.usuario, public.processo, public.alerta TO :"papel";

-- 4. Histórico de consumo: só lê e insere. Lote não se altera nem se apaga
--    (o trigger trg_lote_imutavel também bloqueia, mas a permissão barra antes).
--    A auditoria segue a mesma regra (trigger trg_auditoria_imutavel).
GRANT SELECT, INSERT ON public.lote, public.alerta_lote, public.auditoria_usuario TO :"papel";
--    Avisos que o Telegram não recebeu (aviso_pendente): a API só registra.
GRANT SELECT, INSERT ON public.aviso_pendente TO :"papel";

-- 5. Views: só leitura.
GRANT SELECT ON public.v_alertas, public.v_historico_lotes TO :"papel";

-- 6. Sequências dos ids: nextval (USAGE) e leitura do valor atual (SELECT).
GRANT USAGE, SELECT ON SEQUENCE public.usuario_id_seq, public.processo_id_seq,
  public.lote_id_seq, public.alerta_id_seq, public.auditoria_usuario_id_seq,
  public.aviso_pendente_id_seq TO :"papel";

-- DROP, ALTER e TRUNCATE não precisam de REVOKE: as tabelas pertencem ao postgres,
-- e só o dono pode alterar a estrutura. DELETE e TRUNCATE nunca foram concedidos.

-- Conferência: o que o usuário pode fazer em cada tabela.
SELECT c.relname AS tabela,
       has_table_privilege(:'papel', c.oid, 'SELECT') AS "select",
       has_table_privilege(:'papel', c.oid, 'INSERT') AS "insert",
       has_table_privilege(:'papel', c.oid, 'UPDATE') AS "update",
       has_table_privilege(:'papel', c.oid, 'DELETE') AS "delete",
       has_table_privilege(:'papel', c.oid, 'TRUNCATE') AS "truncate"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v')
ORDER BY c.relkind, c.relname;
