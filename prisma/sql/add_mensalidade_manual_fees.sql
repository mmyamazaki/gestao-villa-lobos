-- Supabase SQL: colunas de multa/juros manuais e observação (após pagamento).
-- Execute no Editor SQL se não usar `prisma db push`.

ALTER TABLE "Mensalidade"
  ADD COLUMN IF NOT EXISTS "manual_fine" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "manual_interest" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "adjustment_notes" TEXT;
