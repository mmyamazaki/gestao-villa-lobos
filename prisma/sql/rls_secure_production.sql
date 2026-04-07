-- Segurança Supabase (produção): RLS ligado e SEM políticas para o papel `anon`.
-- Efeito: a chave pública anon (browser) não lê nem escreve estas tabelas via PostgREST.
--
-- O teu Mac e o servidor Node usam DATABASE_URL com o role `postgres` — em geral faz bypass
-- de RLS no Supabase, portanto Prisma, `npx prisma studio`, `db push` e migrações continuam a funcionar.
-- O painel Supabase (Table Editor / SQL) também usa privilégios elevados.
--
-- IMPORTANTE:
-- - Com este script, o fallback do frontend que lê Course/Teacher/Student pela anon key DEIXA de funcionar
--   até haver API Node no ar. Isto é desejável em produção com dados reais.
-- - Remova antes qualquer política permissiva (ver DROP abaixo). Execute uma vez: SQL Editor → Run.
--
-- Referência antiga (evitar em produção aberta): prisma/sql/rls_anon_read_school_core.sql

-- --- RLS ativo ---------------------------------------------------------------
ALTER TABLE IF EXISTS "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Teacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Student" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Mensalidade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "LessonLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ReplacementClass" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "SchoolSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "admins" ENABLE ROW LEVEL SECURITY;

-- --- Remover políticas antigas que expunham `anon` -----------------------------
DROP POLICY IF EXISTS "anon_select_course" ON "Course";
DROP POLICY IF EXISTS "anon_select_teacher" ON "Teacher";
DROP POLICY IF EXISTS "anon_select_student" ON "Student";
DROP POLICY IF EXISTS "anon_insert_teacher" ON "Teacher";
DROP POLICY IF EXISTS "anon_update_teacher" ON "Teacher";
DROP POLICY IF EXISTS "anon_select_mensalidade" ON "Mensalidade";
DROP POLICY IF EXISTS "anon_insert_mensalidade" ON "Mensalidade";
DROP POLICY IF EXISTS "anon_update_mensalidade" ON "Mensalidade";

-- Se criou políticas anónimas noutras tabelas, DROP aqui antes de confiar no bloqueio total.

-- Não acrescentamos CREATE POLICY para `anon`: por omissão = acesso negado.
