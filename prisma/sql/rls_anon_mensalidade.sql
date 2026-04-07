-- ATENÇÃO: expõe a tabela "Mensalidade" à anon key (qualquer visitante com a URL do frontend).
-- Use só em intranet/desenvolvimento ou quando não houver API Node acessível ao browser.
-- Em produção pública com dados sensíveis, prefira apenas API Node (rls_secure_production.sql) e não execute este ficheiro.

ALTER TABLE IF NOT EXISTS "Mensalidade" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_mensalidade" ON "Mensalidade";
DROP POLICY IF EXISTS "anon_insert_mensalidade" ON "Mensalidade";
DROP POLICY IF EXISTS "anon_update_mensalidade" ON "Mensalidade";

CREATE POLICY "anon_select_mensalidade" ON "Mensalidade" FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_mensalidade" ON "Mensalidade" FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_mensalidade" ON "Mensalidade" FOR UPDATE TO anon USING (true) WITH CHECK (true);
