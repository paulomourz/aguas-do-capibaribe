# Desempenho das consultas e índices (V8)

Análise dos planos de execução das consultas de relatório, alerta e listagem (issue #59), com `EXPLAIN (ANALYZE,
BUFFERS)` no PostgreSQL 18. O resultado é a migração
[`V8__cria_indices_performance.sql`](../../backend/src/main/resources/db/migration/V8__cria_indices_performance.sql).

## Como repetir

Precisa só do Docker. Use um banco descartável: os lotes de teste não podem ser apagados (trigger `trg_lote_imutavel`).

```bash
docker run -d --name aguas-idx -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=aguas_teste postgres:18-alpine
# aplica V1 a V7 (para medir o "antes")
for f in backend/src/main/resources/db/migration/V[1-7]__*.sql; do
  docker exec -i aguas-idx psql -q -v ON_ERROR_STOP=1 -U postgres -d aguas_teste < "$f"; done
docker exec -i aguas-idx psql -q -U postgres -d aguas_teste -v qtd=10000 < database/desempenho/popula-lotes.sql
docker exec -i aguas-idx psql -U postgres -d aguas_teste < database/desempenho/explain-indices.sql > antes.txt
# aplica a V8 e mede de novo
docker exec -i aguas-idx psql -q -U postgres -d aguas_teste < backend/src/main/resources/db/migration/V8__cria_indices_performance.sql
docker exec aguas-idx psql -q -U postgres -d aguas_teste -c "VACUUM ANALYZE lote, alerta_lote"
docker exec -i aguas-idx psql -U postgres -d aguas_teste < database/desempenho/explain-indices.sql > depois.txt
docker rm -f aguas-idx
```

O [`popula-lotes.sql`](../../database/desempenho/popula-lotes.sql) grava `qtd` lotes em ordem de data ao longo de 2026,
como a API faz (`registrado_em = now()`). Também grava os alertas e um processo pouco usado, com 5 lotes em janeiro.
O [`explain-indices.sql`](../../database/desempenho/explain-indices.sql) roda as mesmas consultas que o Hibernate gera.
Rode o script duas vezes e use a segunda saída: a primeira pega o cache frio.

## Resultado em 05/11/2026

Medido com 10.000 lotes (critério da issue) e com 200.000 (volume do [teste de carga](teste-carga.md)). "Blocos" é o
número de páginas de 8 kB lidas (`Buffers: shared`). Ele não varia entre execuções, ao contrário do tempo.

| Consulta | Lotes | Antes da V8 | Depois da V8 |
|---|---|---|---|
| Regra de alerta, processo pouco usado | 10.000 | 1,78 ms, 119 blocos | 0,11 ms, 4 blocos |
| Regra de alerta, processo pouco usado | 200.000 | **73,5 ms, 2.214 blocos** | **0,19 ms, 5 blocos** |
| Regra de alerta, processo muito usado | 200.000 | 0,32 ms, 14 blocos | 0,76 ms, 8 blocos |
| Lotes de um alerta | 10.000 | 0,39 ms, Seq Scan | 0,86 ms, Index Scan |
| Lotes de um alerta | 200.000 | **9,8 ms, Seq Scan em 20.000 linhas** | **0,40 ms, Index Scan** |
| Fechamento mensal (junho) | 10.000 | 0,72 ms, Index Scan, 15 blocos | sem mudança |
| Fechamento mensal (junho) | 200.000 | 6 a 16 ms, Index Scan, 188 blocos | sem mudança |
| Alertas não resolvidos | 200.000 | 0,67 ms, Index Scan | sem mudança |
| Lotes de um operador no mês | 200.000 | 7 a 13 ms, Index Scan | sem mudança |

Abaixo de 1 ms, a diferença de tempo é ruído da máquina. Nessa faixa, vale o número de blocos e o tipo de varredura.

### O que mudou

- **Regra de alerta** (`ix_lote_processo_data`). A cada lote registrado, com o processo bloqueado, a API busca os 2
  lotes anteriores do mesmo processo. Sem índice por processo e data, o PostgreSQL percorre o `ix_lote_data` do lote
  mais novo para trás até achar 2 do processo. Num processo pouco usado, isso é quase a tabela inteira, e o bloqueio
  segura os outros envios do mesmo processo durante esse tempo. Com o índice, ele lê só os 2. O índice começa por
  `processo_id`, então também cobre a chave estrangeira e substitui o `ix_lote_processo`, que é removido.
- **Lotes de um alerta** (`ix_alerta_lote_alerta`). A chave primária de `alerta_lote` é só `lote_id`, e não havia
  índice em `alerta_id`. Cada abertura de alerta lia a tabela inteira.

### O que ficou de fora, e por quê

- **Fechamento mensal.** O critério da issue (Index Scan e menos de 15 ms com 10.000 lotes) já era atendido pelo
  `ix_lote_data` da V1, com 0,72 ms. Um índice de cobertura com `INCLUDE (processo_id, litros, esperado, id)` trouxe o
  Index Only Scan, mas não reduziu o tempo (cerca de 8 ms nos dois casos com 200.000 lotes). Os lotes já ficam no disco
  em ordem de data, então a leitura da tabela é sequencial. Um índice a mais só deixaria o registro de lote mais lento.
- **Alertas não resolvidos e lotes de um operador.** Índices compostos `(status, detectado_em)` e
  `(usuario_id, registrado_em)` foram testados, e o planejador continuou ordenando em memória ou preferiu o
  `ix_lote_data`. Os índices de uma coluna da V1 continuam.

A issue cita `lotes`, `data_hora` e `lavanderia_id`. No esquema, a tabela é `lote`, a data é `registrado_em`, e não
existe coluna de lavanderia (o sistema atende uma lavanderia).
