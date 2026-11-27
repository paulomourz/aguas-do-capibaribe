# Manutenção do banco: linhas mortas, inchaço e autovacuum

Rotina para conferir a saúde das tabelas do PostgreSQL 18 e o ajuste do autovacuum (issue #163). O script é
[`database/manutencao/db-bloat-check.sql`](../../database/manutencao/db-bloat-check.sql) e o ajuste está na migração
[`V13`](../../backend/src/main/resources/db/migration/V13__ajusta_autovacuum_tabelas_quentes.sql).

## Por que isso importa

No PostgreSQL, um `UPDATE` ou `DELETE` não apaga a linha antiga na hora: ela vira uma **linha morta**, que o
**autovacuum** limpa depois. Enquanto isso não acontece, a tabela fica **inchada** (com *bloat*): as consultas leem
páginas com linhas que já não valem, e as estatísticas que o planejador usa ficam velhas.

No projeto, as tabelas se comportam de jeitos diferentes:

| Tabela | Como muda | O que pesa |
|---|---|---|
| `lote`, `alerta_lote` | Só `INSERT` (o lote é imutável, `trg_lote_imutavel`) | Estatísticas e mapa de visibilidade em dia, para as consultas por período e a regra de alerta |
| `alerta` | `UPDATE` do status (aberto → em análise → resolvido) | Linhas mortas a cada mudança de status |
| `aviso_pendente`, `usuario`, `processo` | Poucos `UPDATE` | Pequenas: o padrão do PostgreSQL basta |
| `efluentes_descarte`, `auditoria_usuario` | Só `INSERT`, pouco volume | O padrão basta |

Não há tabela particionada: o particionamento de `lote` foi testado e recusado
([desempenho-indices.md](desempenho-indices.md)). Se um dia houver, o script já mostra cada partição sozinha, com a
tabela mãe ao lado, e sugere o comando por partição.

## O ajuste do autovacuum (V13)

O padrão do PostgreSQL só limpa uma tabela quando **20%** dela mudou e só refaz as estatísticas com **10%**. Com 1 milhão
de lotes, são 200 mil linhas novas até o próximo vacuum. A V13 deixa as tabelas quentes com gatilhos menores:

| Parâmetro | Padrão | `lote` e `alerta_lote` | `alerta` |
|---|---|---|---|
| `autovacuum_vacuum_scale_factor` (linhas mortas) | 0,2 | **0,05** | **0,05** |
| `autovacuum_vacuum_insert_scale_factor` (linhas inseridas) | 0,2 | **0,05** | padrão |
| `autovacuum_analyze_scale_factor` (estatísticas) | 0,1 | **0,02** | **0,02** |

Com 1 milhão de lotes, o vacuum passa a rodar a cada ~50 mil inserções e o `ANALYZE` a cada ~20 mil. Como `lote` só
recebe `INSERT`, quem dispara o vacuum ali é o gatilho de inserção; o de linhas mortas fica para o caso raro de um
`INSERT` desfeito (rollback).

Os parâmetros ficam na própria tabela (`ALTER TABLE ... SET`), aplicados pelo Flyway. Para conferir:
`SELECT relname, reloptions FROM pg_class WHERE reloptions IS NOT NULL;`

## Como rodar o script

Como dono do banco (`postgres`), com psql 18+. O script só lê estatísticas e não muda nada:

```bash
psql -U postgres -d aguas -f database/manutencao/db-bloat-check.sql
```

| Opção | Para quê |
|---|---|
| `-v limite=20` | Inchaço, em %, a partir do qual a tabela entra na lista (padrão 20) |
| `-v tamanho_min_mb=1` | Tabelas menores ficam fora da lista (padrão 1 MB): numa tabela de 5 linhas, a página quase vazia dá um percentual alto que não quer dizer nada |
| `-v executar=1` | Executa os `VACUUM (ANALYZE)` sugeridos. O `VACUUM FULL` nunca é executado pelo script |

Para medir o inchaço de verdade, instale uma vez a extensão `pgstattuple` (vem com o PostgreSQL):
`CREATE EXTENSION pgstattuple;`. Sem ela, o script estima o inchaço pelo percentual de linhas mortas das estatísticas.

### O que ele mostra

1. **Todas as tabelas:** tamanho, linhas vivas e mortas, **% de linhas mortas**, linhas inseridas e alteradas desde o
   último vacuum e analyze, os **gatilhos** do autovacuum calculados com os parâmetros de cada tabela, as datas do último
   vacuum e analyze e a situação (`ok`, `vacuum atrasado` ou `analyze atrasado`).
2. **Tabelas com inchaço acima de 20%** e o comando sugerido:
   - com linhas mortas: `VACUUM (ANALYZE, VERBOSE) public.<tabela>;`, que limpa sem bloquear a tabela;
   - só com espaço livre (linhas já limpas): o espaço é reaproveitado pelos próximos `INSERT`. A sugestão é
     `VACUUM FULL`, só se for preciso devolver espaço ao disco, **fora do expediente**, porque ele bloqueia a tabela
     inteira, inclusive o registro de lotes.
3. Com `-v executar=1`, executa os `VACUUM (ANALYZE)` da seção 2.

## Rotina sugerida

| Quando | O quê |
|---|---|
| Toda semana | Rodar o script e olhar a coluna `situacao`. `vacuum atrasado` com frequência quer dizer que o autovacuum não está dando conta |
| Depois de carga grande (importação, teste de carga num banco de teste) | Rodar com `-v executar=1` |
| Se uma tabela grande passar de 20% de inchaço só com espaço livre | Avaliar `VACUUM FULL` numa janela sem uso, depois de um backup (`database/backup.sh`) |

O banco publicado fica no Neon, que é gerenciado: o autovacuum roda sozinho, e a V13 chega lá pelo Flyway como as
outras migrações. O script pode ser rodado pelo `psql` com a conexão do dono do banco (ver
[banco-remoto.md](banco-remoto.md)); o `pgstattuple` depende de o Neon oferecer a extensão.

## Teste em 17/11/2026

Num banco descartável no PostgreSQL 18.6 local: V1 a V13 aplicadas, 200 mil lotes do script de desempenho
(`database/desempenho/popula-lotes.sql`) e dois `UPDATE` em todos os alertas, para gerar linhas mortas.

- **V13:** `lote`, `alerta_lote` e `alerta` ficaram com os parâmetros da tabela acima.
- **Seção 1:** `alerta` com 13.327 linhas mortas (66,65%), contra um gatilho de 384, marcada como `vacuum atrasado`.
  `lote`, com 200 mil linhas e 38 MB, sem linhas mortas e com gatilho de inserção de ~11 mil.
- **Seção 2, com pgstattuple:** `alerta` com 31% de linhas mortas e 64% de inchaço, com o `VACUUM (ANALYZE)` sugerido.
  Uma tabela particionada de teste apareceu por partição (`telemetria_teste_2026_11`, partição de `telemetria_teste`).
- **Com `-v executar=1`:** o vacuum zerou as linhas mortas; a `alerta` ficou só com espaço livre (reaproveitável), e a
  sugestão passou a ser o `VACUUM FULL` comentado, que o script não executa.
- **Sem pgstattuple:** o script avisou e usou a estimativa pelas estatísticas (50% de linhas mortas na `alerta`).
