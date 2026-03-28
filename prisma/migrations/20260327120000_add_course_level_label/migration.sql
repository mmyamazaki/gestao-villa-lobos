-- CreateTable alignment: Prisma model Course expects "levelLabel" (TEXT NOT NULL).
-- Bancos antigos podem ter só "stage" (inteiro) ou não ter "levelLabel" → P2022.

ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "levelLabel" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'Course'
      AND a.attname = 'stage'
      AND NOT a.attisdropped
  ) THEN
    UPDATE "Course"
    SET "levelLabel" = CASE
      WHEN "stage" = 1 THEN '1º estágio'
      WHEN "stage" = 2 THEN '2º estágio'
      WHEN "stage" = 3 THEN '3º estágio'
      ELSE CONCAT("stage"::text, 'º estágio')
    END
    WHERE "levelLabel" IS NULL;
  END IF;
END $$;

UPDATE "Course" SET "levelLabel" = 'Nível' WHERE "levelLabel" IS NULL;

ALTER TABLE "Course" ALTER COLUMN "levelLabel" SET NOT NULL;

ALTER TABLE "Course" DROP COLUMN IF EXISTS "stage";
