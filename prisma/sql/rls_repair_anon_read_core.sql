-- Reparo de fallback Supabase (modo sem API Node): leitura anon consistente do core.
-- Use APENAS em dev/intranet. Em produção pública, use rls_secure_production.sql.
--
-- Corrige cenário "mensalidades aparecem, mas alunos somem" por política ausente na tabela Student.

ALTER TABLE IF EXISTS "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Teacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Student" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_course" ON "Course";
DROP POLICY IF EXISTS "anon_select_teacher" ON "Teacher";
DROP POLICY IF EXISTS "anon_select_student" ON "Student";

CREATE POLICY "anon_select_course" ON "Course" FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_teacher" ON "Teacher" FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_student" ON "Student" FOR SELECT TO anon USING (true);
