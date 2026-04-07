-- Colunas de multa/juros manuais e observações na baixa (alinhado com schema.prisma).
-- IF NOT EXISTS: seguro se já tiveres aplicado prisma/sql/add_mensalidade_manual_fees.sql à mão.

ALTER TABLE "Mensalidade"
  ADD COLUMN IF NOT EXISTS "manual_fine" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "manual_interest" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "adjustment_notes" TEXT;
