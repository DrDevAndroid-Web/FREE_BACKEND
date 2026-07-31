-- PASO 1: Ejecutar esto PRIMERO en el SQL Editor de Supabase
-- https://supabase.com/dashboard/project/fuduzzsfaacdtqvsyaos/sql/new
-- Esto habilita que el script de Node pueda correr el resto de la migración

CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
