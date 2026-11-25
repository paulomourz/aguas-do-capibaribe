-- V15: visão mensal de conformidade dos efluentes (issue #203), sobre efluentes_descarte (V12, #162).
-- Por mês (fuso America/Recife, como os relatórios) e por processo do lote: quantos descartes, o volume descartado,
-- o pH (médio, mínimo e máximo), a turbidez média, o índice de reúso e quantos descartes ficaram fora da faixa de pH
-- de lançamento da Resolução CONAMA 430/2011 (art. 16: entre 5 e 9).
--
-- Índice de reúso = volume reaproveitado ÷ volume descartado, com cada descarte pesando pelo próprio volume
-- (um descarte de 1.000 L com 50% reaproveitado conta mais que um de 10 L com 90%).

CREATE VIEW v_efluentes_mensal AS
SELECT date_trunc('month', d.data_descarte AT TIME ZONE 'America/Recife')::date AS mes,
       l.processo_id,
       count(*)::integer                                                    AS descartes,
       sum(d.volume_litros)                                                 AS volume_litros,
       round(avg(d.ph), 2)                                                  AS ph_medio,
       min(d.ph)                                                            AS ph_minimo,
       max(d.ph)                                                            AS ph_maximo,
       round(avg(d.turbidez_ntu), 2)                                        AS turbidez_media_ntu,
       round(sum(d.volume_litros * d.reutilizado_percentual / 100), 2)      AS volume_reaproveitado_litros,
       round(sum(d.volume_litros * d.reutilizado_percentual / 100) / sum(d.volume_litros) * 100, 2) AS indice_reuso_percentual,
       count(*) FILTER (WHERE d.ph < 5 OR d.ph > 9)::integer                AS fora_do_ph_de_lancamento
FROM efluentes_descarte d
JOIN lote l ON l.id = d.lote_id
GROUP BY 1, 2;

-- O relatório de um mês filtra pela coluna "mes" da visão. O índice por data_descarte (V12) não serve para isso,
-- porque o mês é calculado no fuso de Recife; este índice usa a mesma expressão. Medido com 200.000 descartes:
-- um mês caiu de 58 ms (Seq Scan) para 15 ms (Index Scan), em docs/tecnico/desempenho-indices.md.
CREATE INDEX ix_efluentes_descarte_mes ON efluentes_descarte
    USING btree ((date_trunc('month', data_descarte AT TIME ZONE 'America/Recife')::date));

-- Usuário da API (se já existir): só leitura, como as outras visões.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aguas_api') THEN
        GRANT SELECT ON v_efluentes_mensal TO aguas_api;
    END IF;
END;
$$;
