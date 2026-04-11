-- ATENÇÃO: expõe a tabela "ReplacementClass" à anon key (qualquer visitante com a URL do frontend).
-- Use só em intranet/desenvolvimento ou quando não houver API Node acessível ao browser.
-- Em produção pública com dados sensíveis, prefira apenas API Node e não execute este ficheiro.

ALTER TABLE IF NOT EXISTS "ReplacementClass" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_replacement_class" ON "ReplacementClass";
DROP POLICY IF EXISTS "anon_insert_replacement_class" ON "ReplacementClass";
DROP POLICY IF EXISTS "anon_update_replacement_class" ON "ReplacementClass";

CREATE POLICY "anon_select_replacement_class" ON "ReplacementClass" FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_replacement_class" ON "ReplacementClass" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_replacement_class" ON "ReplacementClass" FOR UPDATE TO anon USING (true) WITH CHECK (true);
