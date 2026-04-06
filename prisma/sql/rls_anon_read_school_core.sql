-- ATENÇÃO: expõe cursos/professores/alunos a qualquer pessoa com a anon key (URL do site).
-- Só para desenvolvimento ou intranet. Em produção pública prefira prisma/sql/rls_secure_production.sql + API Node.
-- Se executar este ficheiro, ajuste se já existirem políticas (evite duplicar nomes).

ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Teacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_course" ON "Course";
DROP POLICY IF EXISTS "anon_select_teacher" ON "Teacher";
DROP POLICY IF EXISTS "anon_select_student" ON "Student";

CREATE POLICY "anon_select_course" ON "Course" FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_teacher" ON "Teacher" FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_student" ON "Student" FOR SELECT TO anon USING (true);
