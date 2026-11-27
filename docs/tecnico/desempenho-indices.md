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

## Particionamento mensal da tabela `lote` (issue #100), em 11/11/2026

A issue propôs particionar a telemetria por mês, com um trigger que cria a partição do mês quando ela ainda não
existe. O projeto não tem tabela de telemetria: o sensor envia o lote pronto (`POST /lotes`) e o consumo fica na
tabela `lote`. A análise abaixo é sobre particionar a `lote` por `registrado_em`.

**Decisão: não particionar nesta escala.** O particionamento quebraria duas garantias do sistema, a proposta do
trigger não funciona no PostgreSQL, e a única consulta que melhora já é rápida. A regra de alerta, que roda a cada
lote registrado, ficaria centenas de vezes mais lenta.

### Como foi medido

Mesmo roteiro da seção [Como repetir](#como-repetir), com a V1 a V10 aplicadas, PostgreSQL 18.6 e `qtd=1000000` no
`popula-lotes.sql`: 1.000.005 lotes, 65 MB de tabela e 190 MB com os índices. Depois:

```bash
docker exec -i aguas-idx psql -U postgres -d aguas_teste < database/desempenho/explain-indices.sql > sem-particao.txt
docker exec -i aguas-idx psql -U postgres -d aguas_teste < database/desempenho/teste-particionamento.sql > particionada.txt
```

O [`teste-particionamento.sql`](../../database/desempenho/teste-particionamento.sql) cria `lote_part`, uma cópia
da `lote` com uma partição por mês e os mesmos índices da V1 e da V8. Ele mostra as restrições que o PostgreSQL
recusa e roda as mesmas consultas. A tabela `lote` não é alterada. Cada consulta foi rodada três vezes.

### O que quebraria

| Garantia | Na tabela `lote` hoje | Na tabela particionada |
|---|---|---|
| Chave primária | `id` | Recusada: `unique constraint on partitioned table must include all partitioning columns`. Só aceita `(id, registrado_em)`. |
| Chave de envio única (V7, RF28) | `chave_envio`: o reenvio do site depois de a resposta se perder não cria lote repetido | Recusada pelo mesmo motivo. Só aceita `(chave_envio, registrado_em)`, que **não barra o reenvio**: ele grava outro `registrado_em` (`now()`). No teste, a mesma chave entrou duas vezes, com 5 segundos de diferença. |
| `alerta_lote → lote(id)` | Chave estrangeira normal | Recusada: `there is no unique constraint matching given keys`. Precisaria guardar também o `registrado_em` em `alerta_lote`. |

A chave de envio é a mais grave. A API procura a chave antes de gravar (`findByChaveEnvio`), mas o índice único é o
que segura dois reenvios simultâneos. Sem ele, o modo offline do site passaria a poder duplicar consumo, e o lote
não pode ser apagado depois (`trg_lote_imutavel`).

**O trigger da issue não funciona.** O PostgreSQL escolhe a partição antes de rodar os triggers da linha. Se a
partição do mês não existe, o `INSERT` falha com `no partition of relation "lote_part" found for row` antes de o
trigger rodar. Por isso as partições precisam ser criadas antes da hora, por uma tarefa agendada ou pela extensão
`pg_partman`, e não no momento do `INSERT`.

### Resultado

"Blocos" é o número de páginas de 8 kB lidas (`Buffers: shared`).

| Consulta | Sem partição (hoje) | Particionada por mês |
|---|---|---|
| Fechamento mensal (junho, 82 mil lotes) | 17 a 102 ms, Index Scan, 916 blocos | 14 a 31 ms, Seq Scan só na partição de junho, 688 blocos |
| Lotes de um operador no mês | 11 ms, 917 blocos | 3 a 6 ms, 696 blocos |
| Regra de alerta, processo muito usado | 0,30 ms, 8 blocos | 1,2 ms, 82 blocos |
| Regra de alerta, processo pouco usado (pior caso) | **0,07 a 0,48 ms, 5 blocos** | **63 a 109 ms, 11.055 blocos** |

- **O relatório mensal e a listagem ganham**, porque o PostgreSQL só lê a partição do mês. Mas já são consultas de
  tela, feitas algumas vezes por dia pelo gestor, e já estão abaixo de um décimo de segundo.
- **A regra de alerta perde muito.** Ela busca os 2 lotes anteriores do mesmo processo, sem filtro de data. Na
  tabela particionada, o PostgreSQL abre o índice de cada uma das 14 partições e junta os resultados. No processo
  pouco usado, isso volta ao problema que a V8 resolveu (73,5 ms com 200.000 lotes). Essa consulta roda a cada lote
  registrado, com o processo bloqueado, e segura os outros envios do mesmo processo enquanto isso.

### Alternativa mais barata, se o relatório mensal ficar lento

Os lotes são gravados em ordem de data, então um índice BRIN em `registrado_em` resume cada faixa de páginas em
poucos bytes. Com o mesmo 1 milhão de lotes, ele deixou o fechamento mensal em 15 a 20 ms, o mesmo ganho do
particionamento, com 24 kB de índice (o `ix_lote_data` tem 21 MB) e sem mexer em nenhuma restrição. Ele não entrou
agora porque o `ix_lote_data` também atende a listagem ordenada por data, e trocar um pelo outro exige medir essa
listagem.

### Quando reavaliar

1 milhão de lotes é muito mais do que a lavanderia vai gerar tão cedo. O TAP fala em cerca de 70.000 litros por dia
numa lavanderia média. Em lotes de alguns milhares de litros, isso dá dezenas de lotes por dia. Mesmo com 300 lotes
por dia, seriam cerca de 110 mil por ano, e 1 milhão levaria uns 9 anos. Esta é uma estimativa, não uma medição.

Vale reavaliar quando o fechamento mensal passar de 1 segundo, ou quando a tabela com índices deixar de caber na
memória do banco. Pelo crescimento medido (190 MB por milhão de lotes), isso fica perto de 10 milhões de lotes. O
primeiro passo seria o índice BRIN. Se ainda assim for preciso particionar:

1. Trocar a chave de envio única por uma tabela própria, `lote_chave_envio (chave_envio uuid PRIMARY KEY, lote_id,
   registrado_em)`, gravada na mesma transação do lote.
2. Guardar `registrado_em` em `alerta_lote` e usar a chave estrangeira composta `(lote_id, registrado_em)`.
3. Criar as partições dos próximos meses com antecedência (tarefa agendada ou `pg_partman`), mais uma partição
   padrão para nenhum `INSERT` falhar.
4. Limitar a regra de alerta aos lotes recentes (por exemplo, os últimos 3 meses), para o PostgreSQL ignorar as
   partições antigas.
5. Migrar numa janela combinada: criar a tabela nova, copiar os lotes, recriar os triggers `trg_lote_esperado` e
   `trg_lote_imutavel` e trocar os nomes. Testar antes num banco de teste, nunca direto no Neon.

## Visão mensal dos efluentes (issue #203), em 23/11/2026

A visão `v_efluentes_mensal` (V15) agrupa os descartes de `efluentes_descarte` por mês, no fuso de Recife, e por
processo do lote. O relatório de um mês filtra pela coluna `mes`, que é calculada:
`date_trunc('month', data_descarte AT TIME ZONE 'America/Recife')`. O índice por data da V12
(`ix_efluentes_descarte_data`) não serve para esse filtro, porque o PostgreSQL não consegue passar do mês calculado
para um intervalo de `data_descarte`.

Medido num PostgreSQL 18 no Docker, com **200.000 descartes** espalhados por 9 meses e
`EXPLAIN (ANALYZE) SELECT * FROM v_efluentes_mensal WHERE mes = date '2026-03-01'`:

| Situação | Plano | Tempo |
|---|---|---|
| Só com os índices da V12 | Parallel Seq Scan em `efluentes_descarte` | 58 ms |
| Com `ix_efluentes_descarte_mes`, um índice na mesma expressão do mês (V15) | Index Scan em `ix_efluentes_descarte_mes` | 15 ms |

A visão inteira, sem filtro (todos os meses), lê a tabela toda de qualquer jeito: 228 ms com os 200.000 descartes.
Antes de medir, os totais da visão foram conferidos com uma consulta direta na tabela, sem a visão: descartes, volume,
índice de reúso e pH fora da faixa batem.
