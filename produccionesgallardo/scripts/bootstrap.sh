#!/bin/sh
# Aplica migraciones pendientes y, solo si la base está vacía (sin usuarios),
# carga la semilla base con el administrador definido en ADMIN_EMAIL / ADMIN_PASSWORD.
set -e

echo "▸ Aplicando migraciones…"
npx prisma migrate deploy

USERS=$(node -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.user.count().then((n) => { console.log(n); return p.$disconnect(); }).catch((e) => { console.error(e); process.exit(1); });
')

if [ "$USERS" = "0" ]; then
  echo "▸ Base vacía: cargando semilla (${SEED_MODE:-base})…"
  SEED_MODE="${SEED_MODE:-base}" npx tsx prisma/seed.ts
else
  echo "▸ La base ya tiene $USERS usuario(s); no se carga la semilla."
fi
