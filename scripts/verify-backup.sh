#!/usr/bin/env bash
set -euo pipefail

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "Erro: pg_restore nao encontrado. Instale com:"
  echo "  brew install libpq"
  echo "  echo 'export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"' >> ~/.zshrc"
  echo "  source ~/.zshrc"
  exit 1
fi

dump_file="${1:-}"
if [ -z "${dump_file}" ]; then
  echo "Uso: npm run backup:verify -- backups/pre-financeiro-YYYYMMDD-HHMM.dump"
  exit 1
fi

if [ ! -f "${dump_file}" ]; then
  echo "Erro: arquivo nao encontrado: ${dump_file}"
  exit 1
fi

echo "Validando estrutura do dump..."
pg_restore --list "${dump_file}" >/tmp/backup-list.txt

for required in "TABLE public.Mensalidade" "TABLE public.Student" "TABLE public.Course"; do
  if ! rg -n "${required}" /tmp/backup-list.txt >/dev/null 2>&1; then
    echo "Aviso: nao encontrei ${required} no dump."
  fi
done

echo "Validacao concluida. Amostra de objetos:"
sed -n '1,20p' /tmp/backup-list.txt
