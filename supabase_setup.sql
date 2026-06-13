-- 1. Crear la tabla del contador
CREATE TABLE IF NOT EXISTS global_counter (
  id integer PRIMARY KEY DEFAULT 1,
  count integer NOT NULL DEFAULT 0
);

-- Asegurarse de que solo haya una fila
ALTER TABLE global_counter ADD CONSTRAINT single_row CHECK (id = 1);

-- Insertar la fila inicial si no existe
INSERT INTO global_counter (id, count) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

-- 2. Crear una función (RPC) para incrementar el contador de forma atómica y evitar race conditions
CREATE OR REPLACE FUNCTION increment_counter()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE global_counter 
  SET count = count + 1 
  WHERE id = 1 
  RETURNING count INTO new_count;
  
  RETURN new_count;
END;
$$;

-- 3. Habilitar Supabase Realtime para esta tabla
ALTER PUBLICATION supabase_realtime ADD TABLE global_counter;

-- (Opcional) Si tienes RLS activado, permite acceso anonimo/autenticado a esta tabla
ALTER TABLE global_counter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura general" ON global_counter FOR SELECT USING (true);
CREATE POLICY "Permitir update general" ON global_counter FOR UPDATE USING (true);
