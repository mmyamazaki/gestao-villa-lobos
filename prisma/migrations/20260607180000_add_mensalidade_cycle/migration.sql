-- Marcador de ciclo de contrato (rematrícula) nas parcelas.
-- Dados existentes assumem ciclo 1. IF NOT EXISTS: seguro para reaplicar.

ALTER TABLE "Mensalidade"
  ADD COLUMN IF NOT EXISTS "cycle" INTEGER NOT NULL DEFAULT 1;
