-- Filiação do aluno: nome do pai e da mãe (opcionais). Coluna `filiacao` continua como texto legado.
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "nomePai" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "nomeMae" TEXT NOT NULL DEFAULT '';
