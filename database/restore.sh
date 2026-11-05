#!/usr/bin/env bash
# Restore de um backup gerado por backup.sh (issue #53).
#
# Uso:
#   bash database/restore.sh --verificar <arquivo.dump>
#       Restaura num PostgreSQL temporário (contêiner Docker apagado no fim) e confere se cada tabela
#       voltou com o número de linhas esperado. Não toca em nenhum banco real.
#   bash database/restore.sh <arquivo.dump>
#       Restaura no banco da conexão (PGHOST, PGDATABASE...). Só aceita banco vazio: nunca sobrescreve
#       dados. Tudo numa transação; se der erro, o banco continua vazio.
#
# O restore não leva dono nem permissões (o dono do Neon não existe no PC, por exemplo). Depois de
# restaurar num banco real, rode database/seguranca-usuario-api.sql para recriar as permissões do aguas_api.

set -euo pipefail
. "$(dirname "$0")/backup-comum.sh"

uso() { echo "Uso: bash database/restore.sh [--verificar] <arquivo.dump>" >&2; exit 2; }

VERIFICAR=0
if [ "${1:-}" = "--verificar" ]; then VERIFICAR=1; shift; fi
[ $# -eq 1 ] || uso
ARQUIVO="$1"
[ -f "$ARQUIVO" ] || erro "arquivo não encontrado: $ARQUIVO"

# O arquivo é o mesmo que o backup gerou?
if [ -f "$ARQUIVO.sha256" ]; then
    [ "$(sha256 "$ARQUIVO")" = "$(cat "$ARQUIVO.sha256")" ] || erro "o arquivo não confere com $ARQUIVO.sha256 (corrompido ou alterado)."
    aviso "Arquivo íntegro (sha256 confere)."
else
    aviso "Sem $ARQUIVO.sha256: a integridade do arquivo não foi conferida."
fi

RESTORE_OPCOES=(--no-owner --no-privileges --exit-on-error --single-transaction)

if [ "$VERIFICAR" = "1" ]; then
    command -v docker >/dev/null 2>&1 || erro "a verificação precisa do Docker."
    CONTEINER="aguas-verifica-backup-$$"
    trap 'docker rm -f "$CONTEINER" >/dev/null 2>&1 || true' EXIT

    aviso "Verificando num banco temporário ($CONTEINER)..."
    docker run -d --name "$CONTEINER" -e POSTGRES_PASSWORD=verifica -e POSTGRES_DB=verifica "$IMAGEM_PG" >/dev/null
    for _ in $(seq 1 60); do
        docker exec "$CONTEINER" psql -U postgres -d verifica -qc 'select 1' >/dev/null 2>&1 && break
        sleep 1
    done
    # O PostgreSQL do contêiner reinicia uma vez depois de criar o banco; espera ficar pronto de novo.
    sleep 2
    docker exec "$CONTEINER" pg_isready -q -U postgres -d verifica || erro "o banco temporário não subiu."

    docker exec -i "$CONTEINER" pg_restore -U postgres -d verifica "${RESTORE_OPCOES[@]}" < "$ARQUIVO" \
        || erro "o pg_restore falhou no banco temporário."

    if [ ! -f "$ARQUIVO.contagens" ]; then
        aviso "Sem $ARQUIVO.contagens: o restore funcionou, mas as linhas não foram conferidas."
        exit 0
    fi

    falhas=0
    while read -r tabela antes depois; do
        restauradas=$(docker exec "$CONTEINER" psql -U postgres -d verifica -X -A -t -c "select count(*) from $tabela") \
            || { echo "  $tabela: tabela não existe no backup"; falhas=1; continue; }
        if [ "$restauradas" -ge "$antes" ] && [ "$restauradas" -le "$depois" ]; then
            echo "  $tabela: $restauradas linhas (ok)"
        else
            echo "  $tabela: $restauradas linhas, esperado entre $antes e $depois"
            falhas=1
        fi
    done < "$ARQUIVO.contagens"
    [ "$falhas" = "0" ] || erro "o backup restaurado não tem as linhas esperadas."
    aviso "Verificação concluída: o backup restaura completo."
    exit 0
fi

# Restore num banco real.
carregar_conexao
[ -n "${PGDATABASE:-}" ] || erro "defina PGDATABASE (e PGHOST, PGUSER, PGPASSWORD) ou crie database/.env.backup."

tabelas=$(pg psql -X -A -t -v ON_ERROR_STOP=1 -c \
    "select count(*) from information_schema.tables where table_schema = 'public'") \
    || erro "não consegui conectar em ${PGDATABASE}."
[ "$tabelas" = "0" ] || erro "o banco ${PGDATABASE} já tem $tabelas tabela(s). O restore só roda em banco vazio; crie um banco novo."

aviso "Restaurando $ARQUIVO em ${PGDATABASE} (${PGHOST:-localhost})..."
pg pg_restore -d "$PGDATABASE" --no-password "${RESTORE_OPCOES[@]}" < "$ARQUIVO" || erro "o pg_restore falhou; nada foi gravado."
aviso "Restore concluído. Agora rode database/seguranca-usuario-api.sql para as permissões do aguas_api."
