-- Executar após `prisma db push` (ou via: npx prisma db execute --file prisma/sql/admins_updated_at_trigger.sql).
-- Garante updated_at = now() em qualquer UPDATE na tabela admins (incl. fora do Prisma).

CREATE OR REPLACE FUNCTION public.admins_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admins_set_updated_at ON public.admins;

CREATE TRIGGER admins_set_updated_at
BEFORE UPDATE ON public.admins
FOR EACH ROW
EXECUTE FUNCTION public.admins_set_updated_at();
