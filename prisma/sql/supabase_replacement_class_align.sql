-- Alinhar tabela "ReplacementClass" criada manualmente no Supabase ao Prisma (duration inteiro + updatedAt).
-- Execute no SQL Editor do Supabase antes de `npx prisma db push` se o push falhar por tipo de coluna.

-- 1) Coluna de sincronização (merge entre dispositivos)
ALTER TABLE "ReplacementClass" ADD COLUMN IF NOT EXISTS "updatedAt" TEXT NOT NULL DEFAULT '';

-- 2) Se "duration" estiver como TEXT com valores '30' ou '60', converta para INTEGER:
ALTER TABLE "ReplacementClass"
  ALTER COLUMN "duration" TYPE INTEGER USING (
    CASE
      WHEN trim("duration"::text) ~ '^[0-9]+$' THEN trim("duration"::text)::integer
      ELSE 30
    END
  );
