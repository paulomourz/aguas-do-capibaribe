# Roteiro do banco de dados (plano C)

Como mostrar o **banco de dados funcionando com o sistema**, para a disciplina de Banco de Dados (issue #225). Cada
ação no site aparece na hora como SQL no log do PostgreSQL, e o banco pode ser aberto numa tela web para ver as
tabelas, as chaves, as regras e os dados.

**Não faz parte da apresentação do ProjetAÍ.** A feira usa os planos A e B do
[roteiro de apresentação](roteiro-apresentacao.md). O plano C é o plano B (Docker no computador) com duas coisas a mais:

| | O que muda | Onde ver |
|---|---|---|
| **Log de SQL** | O PostgreSQL escreve todo comando que recebe, com a hora, o usuário do banco e os valores enviados | Terminal, com `docker compose logs` |
| **Adminer** | Tela web para navegar no banco: tabelas, chaves, visões, dados e um editor de SQL | <http://localhost:8081> |

A configuração fica em [`docker-compose.banco.yml`](../../docker-compose.banco.yml), somada ao `docker-compose.yml`. O
banco é o mesmo do plano B: nada muda no site publicado nem no Neon.

## Preparar (uns 10 minutos, na véspera)

Precisa do Docker Desktop aberto. Use o **PowerShell**, na pasta do projeto: no Git Bash, o Docker Compose 5.6 recusa
o build (`additional privileges requested`). Os comandos usam a `main`, que tem o plano C a partir da v2.0.0.

**1. Subir com banco limpo.** O `down -v` apaga os dados e as senhas do Docker deste computador (só do Docker, não do
site publicado), para a massa poder rodar:

```powershell
git checkout main
git pull
docker compose -f docker-compose.yml -f docker-compose.banco.yml down -v
docker compose -f docker-compose.yml -f docker-compose.banco.yml up -d --build --wait
```

**2. Carregar a massa de dados** (64 lotes de 20 dias, 2 alertas e 34 descartes de efluentes):

```powershell
cmd /c "docker compose exec -T db psql -U postgres -d aguas -v ON_ERROR_STOP=1 < database\demonstracao\massa-demonstracao.sql"
```

**3. Anotar as senhas**, todas sorteadas na primeira subida e guardadas só no Docker deste computador:

```powershell
docker compose logs segredos
docker compose exec db cat /segredos/postgres
```

O primeiro comando mostra os logins do site (administrador e gestor). O segundo mostra a senha do usuário `postgres`
do banco, para o Adminer.

**4. Deixar três janelas abertas, lado a lado:**

| Janela | O quê |
|---|---|
| Navegador | O site em <http://localhost:3000>, com login do administrador |
| Navegador | O Adminer em <http://localhost:8081>: sistema **PostgreSQL**, servidor `db`, usuário `postgres`, a senha do passo 3 e base de dados `aguas` |
| PowerShell | O log de SQL, com o comando abaixo |

```powershell
docker compose logs -f --tail 0 --no-log-prefix db | Select-String -NotMatch 'statement: $'
```

O `Select-String` esconde a verificação de saúde da API, que manda um comando vazio a cada 5 segundos. Cada linha
mostra a hora, o usuário do banco entre colchetes e o comando:

```text
2026-11-24 19:57:27.153 -03 [aguas_api] LOG:  execute <unnamed>: insert into lote (chave_envio,litros,pecas,processo_id,usuario_id) values ($1,$2,$3,$4,$5) returning id,esperado,registrado_em
2026-11-24 19:57:27.153 -03 [aguas_api] DETAIL:  Parameters: $1 = '7b0e6f1e-...', $2 = '790', $3 = '100', $4 = '1', $5 = '1'
```

`aguas_api` é a API, com permissões mínimas. `postgres` é o dono do banco, usado só pelo Flyway, pelo Adminer e pelo
`psql`. A API usa comandos preparados: o SQL vem com `$1`, `$2`, e os valores chegam separados, na linha `DETAIL`.
Por isso não há SQL injection.

## O modelo

São 9 tabelas, criadas e alteradas só por migrações do Flyway
([`backend/src/main/resources/db/migration`](../../backend/src/main/resources/db/migration), V1 a V15). No Adminer, o
link **Esquema do banco de dados** (*Database schema*) desenha as tabelas com as chaves estrangeiras.

| Tabela | Guarda | Liga com |
|---|---|---|
| `usuario` | Contas: administrador, gestor, operador e sensor | — |
| `processo` | Os 4 processos de lavagem e a meta de água de cada um | — |
| `lote` | Cada lote lavado: peças, litros gastos e litros esperados | `processo`, `usuario` |
| `alerta` | Sequência de 3 lotes seguidos acima da meta, com o status do tratamento | `processo` |
| `alerta_lote` | Quais lotes formaram cada alerta (N para N) | `alerta`, `lote` |
| `aviso_pendente` | Avisos do Telegram que falharam e esperam reenvio | `alerta` |
| `efluentes_descarte` | Descarte da água de cada lote: volume, pH, turbidez e reúso | `lote` |
| `telemetria` | Leituras de vazão do sensor (ESP32 no Wokwi) | `processo`, `usuario` |
| `auditoria_usuario` | Quem criou, desativou ou trocou a senha de cada conta | `usuario` (2 vezes) |

Visões: `v_historico_lotes` (lote com desvio e status), `v_alertas` (alerta com o processo) e `v_efluentes_mensal`
(conformidade e reúso dos efluentes por mês e processo). A última migração aplicada fica em `flyway_schema_history`.

## Ação no site → SQL no log

Faça a ação no site e mostre a linha que aparece no log. A coluna da direita diz o que ela ensina.

| # | Ação no site | O que aparece no log | O que mostra |
|---|---|---|---|
| 1 | Login | `BEGIN READ ONLY`, depois `select ... from usuario where upper(login)=upper($1)` | Transação só de leitura; login sem diferenciar maiúsculas. A senha nunca vai no SQL: a API compara o hash bcrypt (`CHECK (length(senha_hash) = 60)`) |
| 2 | **Usuários**: o administrador cadastra um operador | `insert into usuario ...` e `insert into auditoria_usuario ...` na **mesma transação**, até o `COMMIT` | Atomicidade: as duas gravações acontecem juntas ou nenhuma. O `CHECK` de `perfil` só aceita os 4 perfis |
| 3 | **Registrar lote** de Amaciamento | `select ... from processo ... for no key update`, depois `select ... from lote where chave_envio=$1` e `insert into lote (...) returning id,esperado,...` | O `INSERT` vai **sem** o valor esperado: o trigger `trg_lote_esperado` calcula pela meta. O `for no key update` trava o processo enquanto o lote entra. A chave de envio, com índice único, impede lote duplicado quando o celular reenvia |
| 4 | Registrar o **mesmo** lote de novo, com a conexão caindo (o site reenvia) | Só o `select ... where chave_envio=$1`, sem `insert` | Idempotência pelo índice único `ux_lote_chave_envio` |
| 5 | 3 lotes seguidos acima da meta em Tingimento (meta de 1500 L por lote; registre 1700 L) | A cada lote: `select ... from lote where processo_id=$1 ...` (os 2 anteriores) e `select ... from alerta_lote where lote_id in (...)`. No 3º: `insert into alerta` e 3 `insert into alerta_lote`, antes do `COMMIT` | A regra do alerta lê os 2 lotes anteriores pelo índice `ix_lote_processo_data` e confere se eles já estão em outro alerta. O alerta e o lote entram na mesma transação |
| 6 | **Alertas**: mudar para Em análise e Resolvido | `update alerta set status=$1 ...` | O `CHECK` do status só aceita `aberto`, `analise` e `resolvido` |
| 7 | **Histórico → Descartes** de um lote: registrar um descarte | `insert into efluentes_descarte (...) returning id,data_descarte` | Chave estrangeira para `lote`; `CHECK` do pH entre 0 e 14; a data vem do `DEFAULT` da coluna |
| 8 | **Dashboard** e **Relatórios** | `select processo_id, sum(litros), sum(esperado), count(id), sum(pecas) from lote where registrado_em>=$1 and registrado_em<$2 group by processo_id` | Agregação feita no banco, não no navegador |
| 9 | **Relatórios → CSV** | `select ... from lote where registrado_em>=$1 and registrado_em<$2 and (registrado_em>$3 or id>$4) ... order by registrado_em, id`, uma vez por página | Paginação por cursor (keyset), sem `OFFSET`: cada página custa o mesmo |
| 10 | **Processos**: mudar a meta de um processo | `select ... from processo where upper(nome)=upper($1) and id<>$2` (nome repetido) e `update processo set meta=$1,...` | Os lotes antigos guardam o esperado da época: mudar a meta não reescreve o histórico |
| 11 | **Auditoria** (administrador) | `select ... from auditoria_usuario ...` | O registro do passo 2 |

Com o sensor (opcional, precisa do túnel do plano B): cada leitura do Wokwi aparece como `insert into telemetria`,
com o usuário `aguas_api`, e o lote do sensor como no passo 3.

**Não registre lote de Estonagem** se quiser mostrar depois o alerta ao vivo pelo sensor: a massa deixa a Estonagem
com 2 lotes acima da meta, à espera do 3º.

## No Adminer: as regras que moram no banco

Abra **Comando SQL** (*SQL command*) no Adminer e rode um bloco de cada vez. Os erros são o resultado esperado: mostram o banco
recusando.

**Lote não se altera nem se apaga**, nem pelo dono do banco (trigger `trg_lote_imutavel`):

```sql
UPDATE lote SET litros = 1 WHERE id = 1;
-- ERROR: Lote não pode ser alterado nem excluído.
```

**A API tem só as permissões de que precisa** (privilégio mínimo). `SET ROLE` faz o `postgres` agir como a API:

```sql
SET ROLE aguas_api;
DELETE FROM lote WHERE id = 1;        -- ERROR: permission denied for table lote
CREATE TABLE teste (id int);           -- ERROR: permission denied for schema public
RESET ROLE;
```

O que ela pode, tabela por tabela (em `aviso_pendente`, o `UPDATE` vale só para 3 colunas e aparece em `information_schema.column_privileges`):

```sql
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS pode
FROM information_schema.role_table_grants
WHERE grantee = 'aguas_api'
GROUP BY table_name
ORDER BY table_name;
```

**CHECK recusa dado impossível:**

```sql
INSERT INTO efluentes_descarte (lote_id, data_descarte, volume_litros, ph, turbidez_ntu, reutilizado_percentual)
VALUES (1, now(), 10, 15, 1, 0);
-- ERROR: ... violates check constraint "efluentes_descarte_ph_check"
```

**Índice em uso.** Com só 64 lotes, o PostgreSQL prefere ler a tabela inteira (Seq Scan), que é mais barato. Para ver
o plano com o índice, desligue a leitura sequencial só nesta sessão:

```sql
EXPLAIN ANALYZE
SELECT * FROM lote WHERE processo_id = 1 ORDER BY registrado_em DESC, id DESC LIMIT 20;

SET enable_seqscan = off;
EXPLAIN ANALYZE
SELECT * FROM lote WHERE processo_id = 1 ORDER BY registrado_em DESC, id DESC LIMIT 20;
RESET enable_seqscan;
```

A medição com 200 mil linhas está em [`docs/tecnico/desempenho-indices.md`](../tecnico/desempenho-indices.md).

**Visão de conformidade dos efluentes**, com o índice de reúso ponderado pelo volume:

```sql
SELECT * FROM v_efluentes_mensal ORDER BY mes DESC, processo_id;
```

**Histórico das migrações**, a versão do banco:

```sql
SELECT installed_rank, version, description, installed_on, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

## Se sobrar tempo

- **Backup e restore:** o ensaio da seção 4.3 do [runbook](../tecnico/runbook-disaster-recovery.md) apaga o banco do
  Docker e o restaura em menos de 1 minuto, conferindo o conteúdo de todas as tabelas.
- **Manutenção:** autovacuum ajustado nas tabelas mais escritas (V13) e o acompanhamento de inchaço, em
  [`docs/tecnico/manutencao-banco.md`](../tecnico/manutencao-banco.md).

## Ao terminar

Volte ao plano B, sem o log de SQL nem o Adminer. Os dados continuam:

```powershell
docker compose up -d --remove-orphans
```
