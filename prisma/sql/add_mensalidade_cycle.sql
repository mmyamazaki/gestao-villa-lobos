-- Coluna de ciclo de contrato (rematrícula) na tabela Mensalidade.
-- Aplicar no Supabase (SQL editor) ou via migração Prisma. Dados existentes ficam no ciclo 1.
-- IF NOT EXISTS: seguro para reaplicar.

ALTER TABLE "Mensalidade"
  ADD COLUMN IF NOT EXISTS "cycle" INTEGER NOT NULL DEFAULT 1;
