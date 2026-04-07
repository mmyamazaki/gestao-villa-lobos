-- Supabase SQL: colunas de multa/juros manuais e observação (após pagamento).
-- Migração versionada: prisma/migrations/20260402140000_add_mensalidade_manual_fees/
-- Ou: npx prisma migrate deploy (produção) / prisma db push (dev).

ALTER TABLE "Mensalidade"
  ADD COLUMN IF NOT EXISTS "manual_fine" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "manual_interest" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "adjustment_notes" TEXT;
