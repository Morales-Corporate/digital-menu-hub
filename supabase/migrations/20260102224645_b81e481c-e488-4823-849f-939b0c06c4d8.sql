-- Actualizar el rol de admin@gmail.com a 'admin'
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '31ccbb5f-6a78-4fd8-b195-db94671188e2';