-- ATENÇÃO: expõe a tabela "LessonLog" à anon key (qualquer visitante com a URL do frontend).
-- Use só em intranet/desenvolvimento ou quando não houver API Node acessível ao browser.
-- Em produção pública com dados sensíveis, prefira apenas API Node e não execute este ficheiro.

ALTER TABLE IF NOT EXISTS "LessonLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_lesson_log" ON "LessonLog";
DROP POLICY IF EXISTS "anon_insert_lesson_log" ON "LessonLog";
DROP POLICY IF EXISTS "anon_update_lesson_log" ON "LessonLog";

CREATE POLICY "anon_select_lesson_log" ON "LessonLog" FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_lesson_log" ON "LessonLog" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_lesson_log" ON "LessonLog" FOR UPDATE TO anon USING (true) WITH CHECK (true);
