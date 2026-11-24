# Roteiro do banco de dados (plano C)

Como mostrar o **banco de dados funcionando com o sistema**, para a disciplina de Banco de Dados (issue #225). O
professor faz uma ação, por exemplo registra um lote pelo sensor no Wokwi, confere no site que o lote entrou e depois
abre o **próprio PostgreSQL, no pgAdmin**, para ver a mesma linha gravada na tabela. O SQL que a API mandou também
aparece na hora, no log do banco.

**Não faz parte da apresentação do ProjetAÍ.** A feira usa os planos A e B do
[roteiro de apresentação](roteiro-apresentacao.md). O plano C é o plano B (Docker no computador) com três coisas a mais:

| | O que muda | Onde ver |
|---|---|---|
| **Banco aberto ao pgAdmin** | O PostgreSQL do Docker atende na porta **5433** deste computador (a 5432 fica livre para um PostgreSQL instalado) | pgAdmin 4, ou `psql -h localhost -p 5433` |
| **Log de SQL** | O PostgreSQL escreve todo comando que recebe, com a hora, o usuário do banco e os valores enviados | PowerShell, com `docker compose logs` |
| **Adminer** | Tela web para navegar no banco, para quem não tem o pgAdmin | <http://localhost:8081> |

A configuração fica em [`docker-compose.banco.yml`](../../docker-compose.banco.yml), somada ao `docker-compose.yml`. O
banco é o mesmo do plano B: nada muda no site publicado nem no Neon. A porta 5433 e o Adminer só aceitam conexões
deste computador.

## Preparar (uns 15 minutos, na véspera)

Precisa do Docker Desktop aberto e, para o professor ver no PostgreSQL, do **pgAdmin 4** (vem com o instalador do
PostgreSQL). Use o **PowerShell**, na pasta do projeto: no Git Bash, o Docker Compose 5.6 recusa o build
(`additional privileges requested`). Os comandos usam a `main`, que tem o plano C a partir da v2.0.0.

**1. Subir com banco limpo e com o túnel do sensor.** O `down -v` apaga os dados e as senhas do Docker deste
computador (só do Docker, não do site publicado), para a massa poder rodar:

```powershell
git checkout main
git pull
docker compose -f docker-compose.yml -f docker-compose.banco.yml --profile tunel down -v
docker compose -f docker-compose.yml -f docker-compose.banco.yml --profile tunel up -d --build --wait
```

Sem o Wokwi, tire o `--profile tunel` dos dois comandos: os lotes passam a ser registrados só pelo site.

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
do banco, para o pgAdmin e o Adminer.

**4. Conectar o pgAdmin ao banco do Docker.** No pgAdmin, clique com o botão direito em **Servers > Register >
Server...** e preencha:

| Aba | Campo | Valor |
|---|---|---|
| General | Name | `Águas do Capibaribe (Docker)` |
| Connection | Host name/address | `localhost` |
| Connection | Port | `5433` |
| Connection | Maintenance database | `aguas` |
| Connection | Username | `postgres` |
| Connection | Password | a senha do passo 3 |

As tabelas ficam em **aguas > Schemas > public > Tables**. Para ver os dados: botão direito na tabela,
**View/Edit Data > All Rows**. Para rodar SQL: **Tools > Query Tool**. Se o Docker for recriado com `down -v`, a senha
muda: atualize em **Properties > Connection**.

**5. Ligar o sensor** no projeto local do Wokwi, como no plano B
([roteiro de apresentação](roteiro-apresentacao.md#plano-b-docker-no-computador), "Com o sensor", passos 1 a 4):
copie o endereço do túnel com `docker compose --profile tunel logs tunel`, cole em `API_URL` e gere o token do
`sensor.wokwi` no site local.

**6. Deixar as janelas abertas, lado a lado:**

| Janela | O quê |
|---|---|
| Navegador | O site em <http://localhost:3000>, com login do administrador |
| Navegador | O projeto local do Wokwi, com o monitor serial |
| pgAdmin | O servidor do passo 4, com o Query Tool aberto |
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

`aguas_api` é a API, com permissões mínimas. `postgres` é o dono do banco, usado pelo Flyway, pelo pgAdmin, pelo
Adminer e pelo `psql`. A API usa comandos preparados: o SQL vem com `$1`, `$2`, e os valores chegam separados, na
linha `DETAIL`. Por isso não há SQL injection.

## Do Wokwi ao PostgreSQL: um lote de ponta a ponta

É o centro da aula: o mesmo lote visto nos quatro lugares.

1. **No Wokwi:** clique em ▶, aperte o botão verde para começar o lote, gire o potenciômetro para dar vazão e aperte
   o botão de novo para encerrar. O sensor envia o lote à API, e o monitor serial mostra a resposta.
2. **No log de SQL (PowerShell):** aparecem na hora o `select ... from usuario where token_hash=$1`, que identifica o
   sensor, e o `insert into lote (...)`, com o usuário `[aguas_api]` e os litros medidos na linha `DETAIL`. O valor
   de `token_hash` é o hash SHA-256 do token: o token em si nunca chega ao banco.
3. **No site:** em **Histórico**, o lote está no topo, registrado pelo sensor.
4. **No pgAdmin (Query Tool):** a mesma linha, gravada no banco:

```sql
-- Os últimos lotes, com o processo e quem registrou
SELECT l.id, p.nome AS processo, u.nome AS registrado_por, l.pecas, l.litros, l.esperado,
       round((l.litros - l.esperado) / l.esperado * 100, 2) AS desvio_percentual,
       l.registrado_em AT TIME ZONE 'America/Recife' AS registrado_em_recife
FROM lote l
JOIN processo p ON p.id = l.processo_id
JOIN usuario u ON u.id = l.usuario_id
ORDER BY l.id DESC
LIMIT 5;
```

O `esperado` não veio do sensor: o trigger `trg_lote_esperado` calculou pela meta do processo na hora do `INSERT`
(tabela abaixo, passo 3). O mesmo vale para um lote registrado pelo site, em **Registrar lote**.

**Não registre lote de Estonagem pelo site** se quiser mostrar o alerta ao vivo: a massa deixa a Estonagem com 2 lotes
acima da meta, e o lote crítico do sensor (vazão no máximo por uns 40 s) é o 3º, que abre o alerta. Aí o pgAdmin
mostra a linha nova em `alerta` e as 3 em `alerta_lote`.

## O modelo

São 9 tabelas, criadas e alteradas só por migrações do Flyway
([`backend/src/main/resources/db/migration`](../../backend/src/main/resources/db/migration), V1 a V15). No pgAdmin,
botão direito em **aguas > ERD For Database** desenha as tabelas com as chaves estrangeiras.

| Tabela | Guarda | Liga com |
|---|---|---|
| `usuario` | Contas: administrador, gestor, operador e sensor | — |
| `processo` | Os 4 processos de lavagem e a meta de água de cada um | — |
| `lote` | Cada lote lavado: peças, litros gastos e litros esperados | `processo`, `usuario` |
| `alerta` | Sequência de 3 lotes seguidos acima da meta, com o status do tratamento | `processo` |
| `alerta_lote` | Quais lotes formaram cada alerta (N para N) | `alerta`, `lote` |
| `aviso_pendente` | Avisos do Telegram que falharam e esperam reenvio | `alerta` |
| `efluentes_descarte` | Descarte da água de cada lote: volume, pH, turbidez e reúso | `lote` |
| `telemetria` | Leituras de vazão enviadas pela rota `POST /telemetria` | `processo`, `usuario` |
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



## No pgAdmin: as regras que moram no banco

Abra o **Query Tool** no pgAdmin (ou **Comando SQL** no Adminer) e rode um bloco de cada vez. Os erros são o resultado esperado: mostram o banco
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

Desligue o túnel e volte ao plano B, sem a porta 5433, o log de SQL nem o Adminer. Os dados continuam:

```powershell
docker compose --profile tunel stop tunel
docker compose up -d --remove-orphans
```
