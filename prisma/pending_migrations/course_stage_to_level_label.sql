-- Execute no Supabase (SQL Editor) ou via psql se a tabela Course ainda tiver a coluna inteira "stage".
-- Depois rode: npx prisma generate && npx prisma db pull (opcional) para alinhar o cliente.

ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "levelLabel" TEXT;

UPDATE "Course"
SET "levelLabel" = CASE
  WHEN "stage" = 1 THEN '1º estágio'
  WHEN "stage" = 2 THEN '2º estágio'
  WHEN "stage" = 3 THEN '3º estágio'
  ELSE CONCAT("stage"::text, 'º estágio')
END
WHERE "levelLabel" IS NULL;

ALTER TABLE "Course" ALTER COLUMN "levelLabel" SET NOT NULL;

ALTER TABLE "Course" DROP COLUMN IF EXISTS "stage";
