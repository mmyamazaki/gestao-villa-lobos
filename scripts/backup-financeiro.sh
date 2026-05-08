#!/usr/bin/env bash
set -euo pipefail

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Erro: pg_dump nao encontrado. Instale com:"
  echo "  brew install libpq"
  echo "  echo 'export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"' >> ~/.zshrc"
  echo "  source ~/.zshrc"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Erro: DATABASE_URL nao definida."
  echo "Exemplo:"
  echo "  export DATABASE_URL='postgresql://postgres:***@db.xxxxx.supabase.co:5432/postgres?sslmode=require'"
  exit 1
fi

if [[ "${DATABASE_URL}" == *":6543"* ]]; then
  echo "Aviso: DATABASE_URL usando porta 6543 (pooler)."
  echo "Para backup, prefira 5432 (direct)."
  echo "URL atual: ${DATABASE_URL}"
  exit 1
fi

mkdir -p backups
ts="$(date +%Y%m%d-%H%M)"
base="backups/pre-financeiro-${ts}"

echo "Gerando backup SQL..."
pg_dump "${DATABASE_URL}" --format=plain --no-owner --no-privileges > "${base}.sql"

echo "Gerando backup DUMP..."
pg_dump "${DATABASE_URL}" --format=custom --no-owner --no-privileges > "${base}.dump"

if [ ! -s "${base}.sql" ] || [ ! -s "${base}.dump" ]; then
  echo "Erro: arquivos de backup vazios."
  exit 1
fi

echo ""
echo "Backup concluido com sucesso:"
ls -lh "${base}.sql" "${base}.dump"
echo ""
echo "Proximo passo recomendado:"
echo "  npm run backup:verify -- '${base}.dump'"
