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

## Índice parcial para os alertas ativos (issue #110), em 11/11/2026

A issue propôs um índice parcial só com os alertas ativos (`status IN ('aberto', 'analise')`), porque quase todo
alerta termina resolvido e o Dashboard só lista os abertos e os em análise. A tabela `lote` não tem status (o status do
lote é calculado pelo desvio), então o índice seria na tabela `alerta`.

**Decisão: o índice não entrou.** Em nenhuma das versões testadas o tempo ou o número de blocos lidos melhorou, e um
índice que o planejador não usa só deixa a gravação mais lenta. É a mesma regra da V8: só entra o índice que muda o
plano e o tempo na medição.

### Como foi medido

Mesmo roteiro da seção [Como repetir](#como-repetir), com a V1 a V10 aplicadas, PostgreSQL 18.6 e
`qtd=1000000` no `popula-lotes.sql`. Isso dá 1.000.005 lotes e 33.334 alertas. O script não grava alertas em
análise, então 1% dos resolvidos passou para `analise`, e a massa ficou com 1.667 abertos, 334 em análise e 31.333
resolvidos:

```sql
UPDATE alerta SET status = 'analise' WHERE status = 'resolvido' AND id % 100 = 7;
VACUUM ANALYZE alerta;
```

Cada versão do índice foi criada dentro de `BEGIN; ... ROLLBACK;`, seguida de `ANALYZE alerta` e da consulta 3 do
[`explain-indices.sql`](../../database/desempenho/explain-indices.sql) (a mesma de
`AlertaRepository.findByStatusOrderByDetectadoEmDescIdDesc`), rodada duas vezes para usar a segunda medição.

### Resultado

| Versão | Alertas abertos (1.667 linhas) | Tamanho do índice |
|---|---|---|
| Só o `ix_alerta_status` da V1 (hoje) | 0,76 ms, Index Scan, 253 blocos | 232 kB |
| `+ (detectado_em DESC, id DESC) WHERE status IN ('aberto', 'analise')` | sem mudança: o planejador continua no `ix_alerta_status` | 72 kB |
| A mesma, forçada (sem o `ix_alerta_status`) | 1,70 ms, Bitmap Heap Scan, 266 blocos, descarta os 334 em análise | 72 kB |
| `+ (status, detectado_em DESC, id DESC) WHERE status IN (...)` | sem mudança: o planejador continua no `ix_alerta_status` | 96 kB |
| A mesma, **no lugar** do `ix_alerta_status` | 0,79 ms, Bitmap Heap Scan, 254 blocos | 96 kB |

Os alertas em análise (334 linhas) ficaram em 0,15 ms em todos os casos.

### Por que não houve ganho

- **A consulta já é rápida.** Com 33 mil alertas, ela fica abaixo de 1 ms. Nessa faixa, a diferença de tempo é ruído.
- **O custo está na tabela, não no índice.** Os alertas abertos ficam espalhados por quase todas as 246 páginas da
  tabela, então qualquer índice termina lendo as mesmas páginas. O índice só deixaria de ordenar em memória 1.667
  linhas, o que custa cerca de 0,05 ms.
- **O `ix_alerta_status` já filtra pelo status.** O índice parcial não traz informação que o planejador não tenha.

Trocar o `ix_alerta_status` pelo índice parcial economizaria 136 kB e um pouco de escrita, sem ganho de leitura. Além
disso, o filtro "resolvidos" da tela de alertas, que hoje já lê a tabela inteira (8 ms com 31 mil alertas), não seria
atendido. Por isso o índice da V1 continua como está.

Valeria medir de novo se os alertas ativos passassem de dezenas de milhares, ou se a tela de alertas passasse a usar
paginação (`LIMIT`). Nesse caso, um índice já na ordem da tela evitaria ler todos os alertas para mostrar os primeiros.
