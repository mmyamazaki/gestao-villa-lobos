-- Executar no Supabase → SQL Editor se o fallback do app (leitura via anon key) falhar com "permission denied".
-- Equivale ao GET /api/school/core sem autenticação: qualquer visitante lê cursos/professores/alunos.
-- Ajuste se já tiver políticas (evite duplicar nomes).

ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Teacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_course" ON "Course";
DROP POLICY IF EXISTS "anon_select_teacher" ON "Teacher";
DROP POLICY IF EXISTS "anon_select_student" ON "Student";

CREATE POLICY "anon_select_course" ON "Course" FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_teacher" ON "Teacher" FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_student" ON "Student" FOR SELECT TO anon USING (true);
