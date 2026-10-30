#!/bin/sh
# Respaldo comprimido de PostgreSQL en ./backups (conserva los últimos 14).
# Programarlo con cron, por ejemplo cada día a las 03:15:
#   15 3 * * * cd /opt/produccionesgallardo && sh scripts/backup.sh >> backups/backup.log 2>&1
set -e
cd "$(dirname "$0")/.."
mkdir -p backups
FILE="backups/gallardo-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U gallardo -d gallardo --no-owner | gzip > "$FILE"
echo "Respaldo creado: $FILE"
ls -1t backups/gallardo-*.sql.gz | tail -n +15 | xargs -r rm --
