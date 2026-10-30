#!/bin/sh
# Restaura un respaldo creado por backup.sh. ¡Reemplaza los datos actuales!
#   sh scripts/restore.sh backups/gallardo-20261030-031500.sql.gz
set -e
cd "$(dirname "$0")/.."
[ -f "$1" ] || { echo "Uso: sh scripts/restore.sh <archivo.sql.gz>"; exit 1; }
printf "Esto reemplazará la base de datos actual con %s. Escriba SI para continuar: " "$1"
read -r ok
[ "$ok" = "SI" ] || { echo "Cancelado."; exit 1; }
docker compose stop app
docker compose exec -T db psql -U gallardo -d postgres -c "DROP DATABASE IF EXISTS gallardo WITH (FORCE);" -c "CREATE DATABASE gallardo OWNER gallardo;"
gunzip -c "$1" | docker compose exec -T db psql -U gallardo -d gallardo -q
docker compose start app
echo "Restauración completa."
