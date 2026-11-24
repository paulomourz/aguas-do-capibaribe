# Funções usadas por backup.sh e restore.sh (issue #53). Não é para rodar sozinho.
#
# A conexão vem das variáveis padrão do PostgreSQL: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD e
# PGSSLMODE. Elas podem ficar em database/.env.backup (ignorado pelo Git), lido aqui se existir.
# Sem pg_dump/psql instalados, as ferramentas rodam pelo Docker, na imagem do projeto.

IMAGEM_PG="${BACKUP_IMAGEM_PG:-postgres:18-alpine}"
PASTA_DATABASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Tabelas conferidas depois do restore. A API nunca apaga linhas (não tem DELETE em nenhuma tabela, e
# lote e auditoria_usuario têm trigger que impede), então a contagem só cresce durante o backup.
# Toda tabela nova de uma migração entra aqui (issue #219: as da V10, V12 e V14 tinham ficado de fora).
TABELAS="usuario processo lote alerta alerta_lote auditoria_usuario aviso_pendente efluentes_descarte telemetria flyway_schema_history"

erro() { echo "ERRO: $*" >&2; exit 1; }
aviso() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

carregar_conexao() {
    local arquivo="${BACKUP_ENV:-$PASTA_DATABASE/.env.backup}"
    if [ -f "$arquivo" ]; then
        set -a
        # shellcheck disable=SC1090
        . "$arquivo"
        set +a
    fi
    export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSSLMODE
}

# Roda pg_dump, pg_restore ou psql. Entrada e saída passam por stdin/stdout, sem montar pastas no
# contêiner (o Git Bash do Windows converte caminhos de volume de um jeito que o Docker não entende).
# BACKUP_REDE_DOCKER: rede do contêiner, por exemplo aguas-do-capibaribe_default para o banco do
# docker compose (PGHOST=db).
pg() {
    local programa="$1"; shift
    if [ -z "${BACKUP_USAR_DOCKER:-}" ] && command -v "$programa" >/dev/null 2>&1; then
        "$programa" "$@"
    else
        command -v docker >/dev/null 2>&1 || erro "$programa não está instalado e o Docker não foi encontrado."
        local rede=()
        [ -n "${BACKUP_REDE_DOCKER:-}" ] && rede=(--network "$BACKUP_REDE_DOCKER")
        MSYS_NO_PATHCONV=1 docker run --rm -i "${rede[@]}" \
            -e PGHOST -e PGPORT -e PGDATABASE -e PGUSER -e PGPASSWORD -e PGSSLMODE \
            "$IMAGEM_PG" "$programa" "$@"
    fi
}

# Uma linha "tabela quantidade" para cada tabela de $TABELAS, no banco da conexão atual.
contar_linhas() {
    local sql="" t
    for t in $TABELAS; do
        [ -n "$sql" ] && sql="$sql union all "
        sql="${sql}select '$t', count(*) from $t"
    done
    pg psql -X -q -A -t -F ' ' -v ON_ERROR_STOP=1 -c "$sql"
}

sha256() { sha256sum "$1" | cut -d' ' -f1; }
