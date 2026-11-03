-- V3: processos têxteis iniciais com metas de referência, para um banco novo já sair utilizável.
-- O gestor ajusta as metas (ou cadastra outros processos) pela tela Processos e metas.
-- O banco oficial, que já existia antes do Flyway, entra pela baseline na V4 e não recebe estes dados.

INSERT INTO processo (nome, unidade, meta) VALUES
    ('Amaciamento', 'lote', 800.00),
    ('Estonagem',   'peca', 12.00),
    ('Tingimento',  'lote', 1500.00),
    ('Alvejamento', 'lote', 1200.00)
ON CONFLICT (nome) DO NOTHING;
