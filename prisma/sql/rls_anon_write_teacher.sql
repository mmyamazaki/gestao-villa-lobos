-- Executar no Supabase → SQL Editor (uma vez por projeto).
-- Permite que o app grave professores com a chave anon (fallback quando PUT /api/teachers falha por rede/API ausente).
-- ATENÇÃO: qualquer pessoa com a URL do projeto e a anon key pública pode alterar linhas em "Teacher".
-- Em produção com tráfego público, prefira API Node + service role ou Supabase Auth + políticas por utilizador.

ALTER TABLE "Teacher" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_teacher" ON "Teacher";
DROP POLICY IF EXISTS "anon_update_teacher" ON "Teacher";

CREATE POLICY "anon_insert_teacher" ON "Teacher" FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_teacher" ON "Teacher" FOR UPDATE TO anon USING (true) WITH CHECK (true);
