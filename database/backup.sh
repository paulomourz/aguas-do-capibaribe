#!/usr/bin/env bash
# Backup do PostgreSQL do Águas do Capibaribe com pg_dump (issue #53).
#
# Uso:    bash database/backup.sh
# Gera:   database/backups/<prefixo>_<AAAAMMDD_HHMMSS>.dump  (formato custom do pg_dump, compactado)
#         e, ao lado, .sha256 (conferência do arquivo) e .contagens (linhas de cada tabela)
#
# Passos: 1) conta as linhas; 2) pg_dump; 3) conta de novo; 4) confere se o arquivo abre (pg_restore
# --list); 5) restaura num banco temporário e confere as contagens (restore.sh --verificar);
# 6) apaga os backups com mais de 7 dias. Se qualquer passo falhar, o backup é descartado, sai com
# erro e nenhum backup antigo é apagado.
#
# Variáveis (além da conexão, ver backup-comum.sh):
#   BACKUP_PASTA          pasta dos arquivos (padrão: database/backups, ignorada pelo Git)
#   BACKUP_PREFIXO        início do nome, para separar bancos (padrão: o nome do banco)
#   BACKUP_RETENCAO_DIAS  dias que um backup fica guardado (padrão: 7)
#   BACKUP_VERIFICAR=0    pula o passo 5 (que precisa do Docker)
#
# Use o dono do banco (postgres no Docker e no PC, neondb_owner no Neon): o aguas_api não lê todas as
# tabelas. Passo a passo em database/LEIA-ME.md#backup-e-restore.

set -euo pipefail
. "$(dirname "$0")/backup-comum.sh"

carregar_conexao
[ -n "${PGDATABASE:-}" ] || erro "defina PGDATABASE (e PGHOST, PGUSER, PGPASSWORD) ou crie database/.env.backup."

PASTA="${BACKUP_PASTA:-$PASTA_DATABASE/backups}"
PREFIXO="${BACKUP_PREFIXO:-$PGDATABASE}"
RETENCAO="${BACKUP_RETENCAO_DIAS:-7}"
[[ "$PREFIXO" =~ ^[A-Za-z0-9_-]+$ ]] || erro "BACKUP_PREFIXO só pode ter letras, números, _ e -."
[[ "$RETENCAO" =~ ^[1-9][0-9]*$ ]] || erro "BACKUP_RETENCAO_DIAS precisa ser um número maior que zero."

mkdir -p "$PASTA"
ARQUIVO="$PASTA/${PREFIXO}_$(date '+%Y%m%d_%H%M%S').dump"
TEMP="$ARQUIVO.parcial"
trap 'rm -f "$TEMP" "$TEMP.antes" "$TEMP.depois" "$ARQUIVO.contagens.parcial"' EXIT

aviso "Backup de ${PGDATABASE} em ${PGHOST:-localhost} -> $ARQUIVO"

contar_linhas > "$TEMP.antes" || erro "não consegui ler o banco. Confira a conexão e se o usuário é o dono do banco."

# -Fc: formato custom, já compactado (-Z 9) e restaurável tabela a tabela com pg_restore.
pg pg_dump -Fc -Z 9 --no-password > "$TEMP" || erro "pg_dump falhou."

# Antes e depois: com a API ligada, linhas novas podem entrar durante o backup.
contar_linhas > "$TEMP.depois" || erro "não consegui contar as linhas depois do backup."
# Cada linha: tabela, linhas antes, linhas depois.
paste -d' ' "$TEMP.antes" "$TEMP.depois" | awk '$1 != $3 { exit 1 } { print $1, $2, $4 }' \
    > "$ARQUIVO.contagens.parcial" || erro "as contagens de antes e depois não batem."

[ -s "$TEMP" ] || erro "o pg_dump não gerou nada."
pg pg_restore --list < "$TEMP" > /dev/null || erro "o arquivo gerado não abre no pg_restore."

mv "$TEMP" "$ARQUIVO"
mv "$ARQUIVO.contagens.parcial" "$ARQUIVO.contagens"
sha256 "$ARQUIVO" > "$ARQUIVO.sha256"
aviso "Arquivo gerado: $(du -h "$ARQUIVO" | cut -f1)"

if [ "${BACKUP_VERIFICAR:-1}" != "0" ]; then
    if ! bash "$PASTA_DATABASE/restore.sh" --verificar "$ARQUIVO"; then
        mv "$ARQUIVO" "$ARQUIVO.falhou"
        erro "o backup não passou na verificação. Ficou como $ARQUIVO.falhou; nenhum backup antigo foi apagado."
    fi
fi

# Retenção: só depois de um backup bom, e só os arquivos deste prefixo.
find "$PASTA" -maxdepth 1 -type f \
    \( -name "${PREFIXO}_*.dump" -o -name "${PREFIXO}_*.dump.sha256" -o -name "${PREFIXO}_*.dump.contagens" \) \
    -mtime "+$((RETENCAO - 1))" -print -delete | sed 's/^/Apagado (mais de '"$RETENCAO"' dias): /'

aviso "Backup concluído."
