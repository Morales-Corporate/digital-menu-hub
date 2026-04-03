
-- Insert new insumos with stock_inicial_referencia
INSERT INTO insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_por_unidad, stock_inicial_referencia) VALUES
('Aceite vegetal', 'ml', 3000, 500, 0.008, 5000),
('Arroz', 'g', 8000, 1000, 0.004, 10000),
('Pollo', 'g', 4000, 500, 0.012, 5000),
('Cebolla', 'g', 2000, 300, 0.003, 3000),
('Ají amarillo', 'g', 500, 100, 0.015, 1000),
('Limón', 'unidad', 30, 10, 0.30, 50),
('Sal', 'g', 3000, 200, 0.001, 5000),
('Sillao', 'ml', 800, 200, 0.012, 2000);

-- Update existing insumos
UPDATE insumos SET unidad_medida = 'g', stock_actual = 3000, stock_minimo = 500, costo_por_unidad = 0.005, stock_inicial_referencia = 5000 WHERE nombre = 'Tomate';
UPDATE insumos SET stock_inicial_referencia = 50, stock_actual = 15, stock_minimo = 5 WHERE nombre = 'papa';

-- Lomo Saltado recipes
INSERT INTO producto_insumos (producto_id, insumo_id, cantidad)
SELECT '12fdb7d8-cfb1-41e5-852f-8d7bd034fd13'::uuid, id, 150 FROM insumos WHERE nombre = 'Tomate'
UNION ALL
SELECT '12fdb7d8-cfb1-41e5-852f-8d7bd034fd13'::uuid, id, 100 FROM insumos WHERE nombre = 'Cebolla'
UNION ALL
SELECT '12fdb7d8-cfb1-41e5-852f-8d7bd034fd13'::uuid, id, 20 FROM insumos WHERE nombre = 'Ají amarillo'
UNION ALL
SELECT '12fdb7d8-cfb1-41e5-852f-8d7bd034fd13'::uuid, id, 30 FROM insumos WHERE nombre = 'Aceite vegetal'
UNION ALL
SELECT '12fdb7d8-cfb1-41e5-852f-8d7bd034fd13'::uuid, id, 15 FROM insumos WHERE nombre = 'Sillao'
UNION ALL
SELECT '12fdb7d8-cfb1-41e5-852f-8d7bd034fd13'::uuid, id, 200 FROM insumos WHERE nombre = 'Arroz';

-- Arroz con Pollo recipes
INSERT INTO producto_insumos (producto_id, insumo_id, cantidad)
SELECT '895f6365-08ff-4d8d-a36a-84e2b4021d09'::uuid, id, 250 FROM insumos WHERE nombre = 'Pollo'
UNION ALL
SELECT '895f6365-08ff-4d8d-a36a-84e2b4021d09'::uuid, id, 250 FROM insumos WHERE nombre = 'Arroz'
UNION ALL
SELECT '895f6365-08ff-4d8d-a36a-84e2b4021d09'::uuid, id, 30 FROM insumos WHERE nombre = 'Ají amarillo'
UNION ALL
SELECT '895f6365-08ff-4d8d-a36a-84e2b4021d09'::uuid, id, 80 FROM insumos WHERE nombre = 'Cebolla'
UNION ALL
SELECT '895f6365-08ff-4d8d-a36a-84e2b4021d09'::uuid, id, 20 FROM insumos WHERE nombre = 'Aceite vegetal';

-- Causa rellena recipes
INSERT INTO producto_insumos (producto_id, insumo_id, cantidad)
SELECT '31c34396-46cb-492e-829e-0be9237a4a9e'::uuid, id, 3 FROM insumos WHERE nombre = 'papa'
UNION ALL
SELECT '31c34396-46cb-492e-829e-0be9237a4a9e'::uuid, id, 2 FROM insumos WHERE nombre = 'Limón'
UNION ALL
SELECT '31c34396-46cb-492e-829e-0be9237a4a9e'::uuid, id, 15 FROM insumos WHERE nombre = 'Ají amarillo'
UNION ALL
SELECT '31c34396-46cb-492e-829e-0be9237a4a9e'::uuid, id, 10 FROM insumos WHERE nombre = 'Aceite vegetal'
UNION ALL
SELECT '31c34396-46cb-492e-829e-0be9237a4a9e'::uuid, id, 100 FROM insumos WHERE nombre = 'Pollo';

-- Caldo de gallina recipes
INSERT INTO producto_insumos (producto_id, insumo_id, cantidad)
SELECT 'cec424ca-f464-4696-9105-cf4f32309985'::uuid, id, 200 FROM insumos WHERE nombre = 'Pollo'
UNION ALL
SELECT 'cec424ca-f464-4696-9105-cf4f32309985'::uuid, id, 50 FROM insumos WHERE nombre = 'Cebolla'
UNION ALL
SELECT 'cec424ca-f464-4696-9105-cf4f32309985'::uuid, id, 5 FROM insumos WHERE nombre = 'Sal'
UNION ALL
SELECT 'cec424ca-f464-4696-9105-cf4f32309985'::uuid, id, 100 FROM insumos WHERE nombre = 'Arroz';

-- Limonada Natural recipes
INSERT INTO producto_insumos (producto_id, insumo_id, cantidad)
SELECT '934eaca7-7ece-4f55-b279-e2f332be4e5c'::uuid, id, 3 FROM insumos WHERE nombre = 'Limón'
UNION ALL
SELECT '934eaca7-7ece-4f55-b279-e2f332be4e5c'::uuid, id, 30 FROM insumos WHERE nombre = 'Sal';
