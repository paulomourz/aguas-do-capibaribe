#!/usr/bin/env bash
# Teste da massa de demonstração e do reset do roteiro (issue #210).
#
# Uso:
#   bash database/demonstracao/testar-massa.sh
#
# Sobe um PostgreSQL temporário (contêiner Docker apagado no fim), aplica todas as migrações e confere:
#   1. a massa num banco limpo grava 64 lotes, 2 alertas e 34 descartes;
#   2. a massa rodada de novo para com erro e não grava nada;
#   3. depois de um ensaio (operador cadastrado ao vivo, lote crítico da Estonagem com alerta, aviso pendente,
#      leituras do sensor e descarte), o TRUNCATE do roteiro seguido da massa leva o banco de volta ao estado
#      exato de logo depois da massa, sem erro de constraint e em menos de 30 segundos.
# Não toca em nenhum banco real.

set -euo pipefail

PASTA_PROJETO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRACOES="$PASTA_PROJETO/backend/src/main/resources/db/migration"
MASSA="$PASTA_PROJETO/database/demonstracao/massa-demonstracao.sql"
IMAGEM_PG="${TESTE_IMAGEM_PG:-postgres:18-alpine}"
LIMITE_RESET_S="${TESTE_LIMITE_RESET_S:-30}"
CONTEINER="aguas-teste-massa-$$"

# O mesmo comando de docs/guia/roteiro-apresentacao.md, "Começar com o histórico limpo".
RESET="TRUNCATE alerta_lote, aviso_pendente, alerta, efluentes_descarte, telemetria, lote RESTART IDENTITY;"

erro() { echo "FALHOU: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

command -v docker >/dev/null 2>&1 || erro "o teste precisa do Docker."

trap 'docker rm -f "$CONTEINER" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$CONTEINER" -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=aguas "$IMAGEM_PG" >/dev/null
for _ in $(seq 1 60); do
    docker exec "$CONTEINER" pg_isready -h 127.0.0.1 -U postgres -d aguas >/dev/null 2>&1 && break
    sleep 1
done
docker exec "$CONTEINER" pg_isready -h 127.0.0.1 -U postgres -d aguas >/dev/null 2>&1 || erro "o PostgreSQL temporário não subiu."

psql_teste() { docker exec -i "$CONTEINER" psql -X -q -U postgres -d aguas -v ON_ERROR_STOP=1 "$@"; }

# Linhas e hash do conteúdo de cada tabela: duas fotos iguais são o mesmo banco.
foto() {
    psql_teste -At <<'SQL'
DO $$
DECLARE t text; n bigint; h text;
BEGIN
    CREATE TEMP TABLE foto (tabela text, linhas bigint, hash text);
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1 LOOP
        EXECUTE format('SELECT count(*), md5(coalesce(string_agg(x::text, ''|'' ORDER BY x::text), '''')) FROM %I x', t)
            INTO n, h;
        INSERT INTO foto VALUES (t, n, h);
    END LOOP;
END $$;
SELECT tabela || ' ' || linhas || ' ' || hash FROM foto ORDER BY tabela;
SQL
}

contar() { psql_teste -At -c "SELECT count(*) FROM $1"; }

# Migrações em ordem de versão, como o Flyway faria.
for arquivo in $(ls "$MIGRACOES"/V*__*.sql | sort -t V -k 2 -n); do
    psql_teste < "$arquivo" >/dev/null || erro "migração $(basename "$arquivo")."
done
ok "migrações aplicadas num banco limpo."

# 1. Massa num banco limpo.
psql_teste < "$MASSA" >/dev/null || erro "a massa não rodou no banco limpo."
[ "$(contar lote)" = 64 ] || erro "esperava 64 lotes, vieram $(contar lote)."
[ "$(contar alerta)" = 2 ] || erro "esperava 2 alertas, vieram $(contar alerta)."
[ "$(contar efluentes_descarte)" = 34 ] || erro "esperava 34 descartes, vieram $(contar efluentes_descarte)."
ok "massa no banco limpo: 64 lotes, 2 alertas e 34 descartes."
FOTO_MASSA="$(foto)"

# 2. Massa de novo: tem que parar com erro, sem gravar nada.
if psql_teste < "$MASSA" >/dev/null 2>&1; then
    erro "a massa rodou de novo num banco com lotes."
fi
[ "$(foto)" = "$FOTO_MASSA" ] || erro "a massa recusou, mas o banco mudou."
ok "massa de novo: parou com erro e nada foi gravado."

# 3. Ensaio: o que a apresentação grava ao vivo.
psql_teste <<'SQL' >/dev/null
BEGIN;
INSERT INTO usuario (nome, login, senha_hash, perfil)
VALUES ('Operador do ensaio', 'ensaio.operador', repeat('y', 60), 'operador');
WITH p AS (SELECT id, meta FROM processo WHERE nome = 'Estonagem'),
     u AS (SELECT id FROM usuario WHERE login = 'ensaio.operador'),
     l AS (INSERT INTO lote (processo_id, usuario_id, pecas, litros)
           SELECT p.id, u.id, 80, round(p.meta * 80 * 1.15, 2) FROM p, u RETURNING id, processo_id),
     a AS (INSERT INTO alerta (processo_id, status) SELECT processo_id, 'aberto' FROM l RETURNING id)
INSERT INTO alerta_lote (lote_id, alerta_id) SELECT l.id, a.id FROM l, a;
INSERT INTO aviso_pendente (alerta_id, tentativas, ultimo_erro) SELECT max(id), 1, 'ensaio' FROM alerta;
INSERT INTO telemetria (processo_id, usuario_id, vazao_litros)
SELECT p.id, u.id, 12.5
FROM processo p CROSS JOIN usuario u CROSS JOIN generate_series(1, 50)
WHERE p.nome = 'Estonagem' AND u.login = 'ensaio.operador';
INSERT INTO efluentes_descarte (lote_id, data_descarte, volume_litros, ph, turbidez_ntu, reutilizado_percentual)
SELECT max(id), now(), 100, 7, 30, 10 FROM lote;
COMMIT;
SQL
[ "$(foto)" != "$FOTO_MASSA" ] || erro "o ensaio não gravou nada."

# Reset do roteiro e massa de novo, cronometrados juntos.
inicio=$(date +%s%N)
{ echo "$RESET"; cat "$MASSA"; } | psql_teste >/dev/null || erro "o reset deu erro."
fim=$(date +%s%N)
ms=$(( (fim - inicio) / 1000000 ))
[ "$ms" -lt $(( LIMITE_RESET_S * 1000 )) ] || erro "o reset levou ${ms} ms (limite: ${LIMITE_RESET_S} s)."

# O operador cadastrado ao vivo continua (o roteiro não apaga usuários); o resto tem que ser idêntico.
sem_usuario() { grep -v '^usuario '; }
[ "$(foto | sem_usuario)" = "$(echo "$FOTO_MASSA" | sem_usuario)" ] \
    || erro "depois do reset o banco não voltou ao estado de logo depois da massa."
ok "reset em ${ms} ms, sem erro, com o banco igual ao de logo depois da massa."
echo "Aviso: o operador cadastrado no ensaio continua em usuario; o próximo cadastro ao vivo precisa de outro login."
