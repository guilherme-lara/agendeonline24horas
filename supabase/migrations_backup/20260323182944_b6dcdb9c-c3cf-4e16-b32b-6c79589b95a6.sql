-- SEEDER: 3 barbeiros (1 novo), 10 agendamentos, 5 vendas para studio-nespoli
INSERT INTO barbers (barbershop_id, name, commission_pct, phone) 
VALUES ('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'Lucas Seed', 40, '11999990003')
ON CONFLICT DO NOTHING;

INSERT INTO appointments (barbershop_id, client_name, client_phone, service_name, price, scheduled_at, status, payment_status, barber_name) VALUES
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'João Seed', '11900000001', 'Corte Masculino', 50, NOW() + interval '1 hour', 'confirmed', 'paid', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'Maria Seed', '11900000002', 'Barba', 30, NOW() + interval '2 hours', 'pending', 'pending', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'Carlos Seed', '11900000003', 'Corte + Barba', 70, NOW() + interval '3 hours', 'confirmed', 'paid', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'Ana Seed', '11900000004', 'Corte Masculino', 50, NOW() - interval '2 hours', 'completed', 'paid', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'Pedro Seed', '11900000005', 'Barba', 30, NOW() - interval '3 hours', 'completed', 'paid', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'Bruna Seed', '11900000006', 'Corte + Barba', 70, NOW() + interval '1 day', 'pending', 'pending_local', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'Rafael Seed', '11900000007', 'Corte Masculino', 50, NOW() + interval '1 day 2 hours', 'confirmed', 'paid', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'Camila Seed', '11900000008', 'Barba', 30, NOW() + interval '4 hours', 'pending', 'pending', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'Diego Seed', '11900000009', 'Corte Masculino', 50, NOW() + interval '5 hours', 'confirmed', 'paid', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', 'Fernanda Seed', '11900000010', 'Corte + Barba', 70, NOW() - interval '1 hour', 'completed', 'paid', 'Lucas Seed');

INSERT INTO orders (barbershop_id, items, total, payment_method, status, barber_name) VALUES
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', '[{"name":"Corte Masculino","price":50,"qty":1,"type":"service"}]', 50, 'cash', 'closed', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', '[{"name":"Barba","price":30,"qty":1,"type":"service"},{"name":"Pomada","price":25,"qty":1,"type":"product"}]', 55, 'pix', 'closed', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', '[{"name":"Corte + Barba","price":70,"qty":1,"type":"service"}]', 70, 'card', 'closed', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', '[{"name":"Corte Masculino","price":50,"qty":1,"type":"service"},{"name":"Shampoo","price":35,"qty":2,"type":"product"}]', 120, 'cash', 'closed', 'Lucas Seed'),
('ae21db3f-41e7-40a5-bf92-c7f947e0989d', '[{"name":"Barba","price":30,"qty":1,"type":"service"}]', 30, 'pix', 'closed', 'Lucas Seed');