-- Insert sample categories
INSERT INTO public.categorias (nombre, orden) VALUES
  ('Entradas', 1),
  ('Platos Principales', 2),
  ('Postres', 3),
  ('Bebidas', 4);

-- Insert sample products
INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Nachos con Guacamole', 'Crujientes nachos de maíz acompañados de guacamole fresco, pico de gallo y crema agria', 8.50, id, true, 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600'
FROM public.categorias WHERE nombre = 'Entradas';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Bruschetta Italiana', 'Pan tostado con tomates frescos, albahaca, ajo y aceite de oliva extra virgen', 7.00, id, true, 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600'
FROM public.categorias WHERE nombre = 'Entradas';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Sopa del Día', 'Pregunta por nuestra sopa especial preparada diariamente', 6.00, id, true, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600'
FROM public.categorias WHERE nombre = 'Entradas';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Filete de Res a la Parrilla', 'Corte premium de 300g con papas al horno y vegetales de temporada', 28.00, id, true, 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=600'
FROM public.categorias WHERE nombre = 'Platos Principales';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Pasta Carbonara', 'Fettuccine con salsa cremosa de huevo, panceta crujiente y queso parmesano', 16.50, id, true, 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600'
FROM public.categorias WHERE nombre = 'Platos Principales';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Salmón al Limón', 'Filete de salmón atlántico con salsa de limón y eneldo, acompañado de arroz pilaf', 24.00, id, true, 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600'
FROM public.categorias WHERE nombre = 'Platos Principales';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Pollo al Curry', 'Pechuga de pollo en salsa curry tailandesa con leche de coco y arroz jazmín', 18.00, id, true, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600'
FROM public.categorias WHERE nombre = 'Platos Principales';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Tiramisú', 'Clásico postre italiano con capas de bizcocho, café espresso, mascarpone y cacao', 8.00, id, true, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600'
FROM public.categorias WHERE nombre = 'Postres';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Cheesecake de Frutos Rojos', 'Cremoso cheesecake con coulis de frutos rojos y base de galleta', 7.50, id, true, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600'
FROM public.categorias WHERE nombre = 'Postres';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Brownie con Helado', 'Brownie de chocolate caliente con helado de vainilla y salsa de chocolate', 7.00, id, true, 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=600'
FROM public.categorias WHERE nombre = 'Postres';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Limonada Natural', 'Refrescante limonada preparada con limones frescos y un toque de menta', 4.00, id, true, 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=600'
FROM public.categorias WHERE nombre = 'Bebidas';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Café Americano', 'Café de especialidad recién preparado', 3.50, id, true, 'https://images.unsplash.com/photo-1497515114583-f7b97e070e94?w=600'
FROM public.categorias WHERE nombre = 'Bebidas';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Vino Tinto de la Casa', 'Copa de vino tinto selección de la casa', 6.50, id, true, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600'
FROM public.categorias WHERE nombre = 'Bebidas';

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id, disponible, imagen_url)
SELECT 'Agua Mineral', 'Agua mineral natural con o sin gas', 2.50, id, true, null
FROM public.categorias WHERE nombre = 'Bebidas';