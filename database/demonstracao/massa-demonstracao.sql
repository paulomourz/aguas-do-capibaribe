-- Massa de dados da demonstração (issue #115): 20 dias de lotes dos 4 processos iniciais (V3), com 2 alertas
-- já tratados e o descarte de efluentes dos lotes de Tingimento e Alvejamento, para o Dashboard, os gráficos, o Histórico, os Alertas e os Relatórios já abrirem cheios.
--
-- SÓ RODA EM BANCO SEM LOTES: no Docker recém-criado ou no banco publicado logo depois da limpeza
-- (docs/guia/roteiro-apresentacao.md, "Começar com o histórico limpo"). Se já houver lote, para sem mudar nada.
-- Lotes não podem ser apagados (trigger trg_lote_imutavel): rode só quando quiser estes dados de vez.
--
-- No Docker:   docker compose exec -T db psql -U postgres -d aguas -v ON_ERROR_STOP=1 < database/demonstracao/massa-demonstracao.sql
-- No Neon:     cole este arquivo no SQL Editor, com o banco aguas selecionado, e rode.
--
-- As datas contam a partir do dia em que o script roda (de 20 dias atrás até ontem, no fuso de Recife), então a
-- demonstração funciona em qualquer dia. Os valores são fixos (sem sorteio): toda execução gera os mesmos lotes.
--
-- Os 3 operadores são fictícios e não entram no sistema (a senha guardada não é um hash válido). Para mostrar o
-- registro ao vivo, o administrador cadastra um operador na hora (roteiro).
--
-- Alertas criados (a regra de 3 lotes seguidos acima da meta, Apêndice D da ERS, é respeitada nos dados):
--   Tingimento   há 12 dias  -> resolvido
--   Alvejamento  há 6 dias   -> em análise
-- A Estonagem termina com 2 lotes seguidos acima da meta, ontem, e sem alerta: o próximo lote acima (o lote crítico
-- do sensor, na apresentação) é o 3º e abre o alerta ao vivo, com o aviso no Telegram. Até lá, não registre lote de
-- Estonagem. Amaciamento, Tingimento e Alvejamento terminam dentro da meta.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM lote) THEN
        RAISE EXCEPTION 'O banco já tem lotes. A massa de demonstração só roda num banco sem lotes; nada foi alterado.';
    END IF;
    IF (SELECT count(*) FROM processo WHERE nome IN ('Amaciamento', 'Estonagem', 'Tingimento', 'Alvejamento')) <> 4 THEN
        RAISE EXCEPTION 'Faltam os processos iniciais (Amaciamento, Estonagem, Tingimento e Alvejamento, migração V3).';
    END IF;
END;
$$;

INSERT INTO usuario (nome, login, senha_hash, perfil) VALUES
    ('Josefa Lima (demonstração)',    'demo.josefa',   repeat('x', 60), 'operador'),
    ('Severino Alves (demonstração)', 'demo.severino', repeat('x', 60), 'operador'),
    ('Rita Barbosa (demonstração)',   'demo.rita',     repeat('x', 60), 'operador')
ON CONFLICT (login) DO NOTHING;

-- Meia-noite de hoje no horário de Recife; cada lote fica em (hoje - dias + horas), convertido de volta para UTC.
CREATE TEMP TABLE demo_lote (
    processo text,
    dias     int,
    horas    numeric,
    desvio   numeric,   -- fração da meta: 0.10 = 10% acima
    pecas    int,
    marca    text       -- liga os lotes de cada alerta
) ON COMMIT DROP;

-- Dias e processos em que os lotes especiais (abaixo) substituem os lotes comuns.
CREATE TEMP TABLE demo_reservado (processo text, dias int) ON COMMIT DROP;
INSERT INTO demo_reservado VALUES
    ('Tingimento', 12), ('Tingimento', 11),
    ('Alvejamento', 6), ('Alvejamento', 5),
    ('Estonagem', 1), ('Amaciamento', 1);

-- Lotes comuns: cada processo segue um ciclo de desvios em que nunca há dois lotes seguidos acima da meta.
WITH processos AS (
    SELECT nome, row_number() OVER (ORDER BY nome) AS k
    FROM processo WHERE nome IN ('Amaciamento', 'Estonagem', 'Tingimento', 'Alvejamento')
), comuns AS (
    SELECT p.nome, d.dias, p.k
    FROM processos p
    CROSS JOIN generate_series(20, 1, -1) AS d(dias)
    WHERE (d.dias + p.k) % 3 <> 0
      AND NOT EXISTS (SELECT 1 FROM demo_reservado r WHERE r.processo = p.nome AND r.dias = d.dias)
), numerados AS (
    SELECT c.*, row_number() OVER (PARTITION BY c.nome ORDER BY c.dias DESC) AS n FROM comuns c
)
INSERT INTO demo_lote (processo, dias, horas, desvio, pecas, marca)
SELECT nome,
       dias,
       7 + 2 * k + (dias % 2),
       (ARRAY[-0.06, -0.02, 0.03, -0.04, -0.01, 0.05, -0.03, -0.08])[((n - 1) % 8) + 1],
       40 + (n * 7) % 50,
       NULL
FROM numerados;

-- Sequências que abrem os alertas, cada uma com um lote dentro da meta antes e, nas já tratadas, um depois.
INSERT INTO demo_lote (processo, dias, horas, desvio, pecas, marca) VALUES
    ('Tingimento', 12,  8.0, -0.05, 60, NULL),
    ('Tingimento', 12, 10.0,  0.11, 62, 'tingimento'),
    ('Tingimento', 12, 13.0,  0.14, 58, 'tingimento'),
    ('Tingimento', 12, 15.5,  0.09, 64, 'tingimento'),
    ('Tingimento', 11,  9.0, -0.04, 60, NULL),
    ('Alvejamento', 6,  8.0, -0.03, 45, NULL),
    ('Alvejamento', 6, 10.5,  0.07, 48, 'alvejamento'),
    ('Alvejamento', 6, 13.5,  0.12, 50, 'alvejamento'),
    ('Alvejamento', 6, 16.0,  0.06, 47, 'alvejamento'),
    ('Alvejamento', 5,  9.5, -0.02, 46, NULL),
    ('Estonagem',   1,  7.5, -0.03, 80, NULL),
    ('Estonagem',   1, 11.0,  0.10, 82, NULL),
    ('Estonagem',   1, 14.0,  0.13, 78, NULL),
    ('Amaciamento', 1, 16.5, -0.02, 50, NULL);

-- Grava em ordem cronológica, como a API faria. O esperado vem do trigger trg_lote_esperado.
CREATE TEMP TABLE demo_gravado (id int, processo text, marca text, registrado_em timestamptz) ON COMMIT DROP;

WITH base AS (
    SELECT d.*,
           p.id AS processo_id,
           p.meta * CASE WHEN p.unidade = 'peca' THEN d.pecas ELSE 1 END AS esperado,
           (date_trunc('day', now() AT TIME ZONE 'America/Recife')
               - d.dias * interval '1 day' + d.horas * interval '1 hour') AT TIME ZONE 'America/Recife' AS quando,
           (SELECT id FROM usuario
             WHERE login = (ARRAY['demo.josefa', 'demo.severino', 'demo.rita'])[1 + (d.dias % 3)]) AS usuario_id
    FROM demo_lote d
    JOIN processo p ON p.nome = d.processo
), gravados AS (
    INSERT INTO lote (processo_id, usuario_id, pecas, litros, registrado_em)
    SELECT processo_id, usuario_id, pecas, round(esperado * (1 + desvio), 2), quando
    FROM base
    ORDER BY quando
    RETURNING id, processo_id, registrado_em
)
INSERT INTO demo_gravado (id, processo, marca, registrado_em)
SELECT g.id, b.processo, b.marca, g.registrado_em
FROM gravados g
JOIN base b ON b.processo_id = g.processo_id AND b.quando = g.registrado_em;

-- Os 2 alertas já tratados, detectados no 3º lote de cada sequência.
WITH novos AS (
    INSERT INTO alerta (processo_id, status, detectado_em, atualizado_em)
    SELECT p.id,
           s.status,
           (SELECT max(registrado_em) FROM demo_gravado WHERE marca = s.marca),
           (SELECT max(registrado_em) FROM demo_gravado WHERE marca = s.marca) + s.tratado_depois
    FROM (VALUES ('tingimento', 'Tingimento', 'resolvido', interval '1 day 20 hours'),
                 ('alvejamento', 'Alvejamento', 'analise', interval '17 hours')) AS s(marca, processo, status, tratado_depois)
    JOIN processo p ON p.nome = s.processo
    RETURNING id, processo_id
)
INSERT INTO alerta_lote (lote_id, alerta_id)
SELECT g.id, n.id
FROM novos n
JOIN processo p ON p.id = n.processo_id
JOIN demo_gravado g ON g.processo = p.nome AND g.marca IS NOT NULL;

-- Descarte de efluentes (issue #203): um por lote de Tingimento e de Alvejamento, os processos com banho químico,
-- 2 horas depois do lote. Valores fixos: volume de 90% da água do lote, pH de 6,5 a 9,4 (alguns acima de 9, fora da
-- faixa de lançamento da CONAMA 430), turbidez de 20 a 79 NTU e reaproveitamento de 0% a 44%.
INSERT INTO efluentes_descarte (lote_id, data_descarte, volume_litros, ph, turbidez_ntu, reutilizado_percentual)
SELECT g.id,
       g.registrado_em + interval '2 hours',
       round(l.litros * 0.9, 2),
       6.5 + ((g.id * 37) % 30) / 10.0,
       20 + (g.id * 13) % 60,
       (g.id * 7) % 45
FROM demo_gravado g
JOIN lote l ON l.id = g.id
WHERE g.processo IN ('Tingimento', 'Alvejamento')
ORDER BY g.registrado_em;

-- Conferência: lotes por processo e alertas criados.
SELECT p.nome AS processo, count(l.id) AS lotes,
       count(*) FILTER (WHERE l.litros > l.esperado) AS acima_da_meta,
       min(l.registrado_em AT TIME ZONE 'America/Recife')::date AS primeiro,
       max(l.registrado_em AT TIME ZONE 'America/Recife')::date AS ultimo
FROM processo p JOIN lote l ON l.processo_id = p.id
GROUP BY p.nome ORDER BY p.nome;

SELECT count(*) AS descartes, count(*) FILTER (WHERE ph < 5 OR ph > 9) AS fora_do_ph_de_lancamento FROM efluentes_descarte;

SELECT a.id AS alerta, p.nome AS processo, a.status, count(al.lote_id) AS lotes
FROM alerta a JOIN processo p ON p.id = a.processo_id JOIN alerta_lote al ON al.alerta_id = a.id
GROUP BY a.id, p.nome, a.status ORDER BY a.id;

COMMIT;
