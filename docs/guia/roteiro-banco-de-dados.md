# Roteiro do banco de dados (plano C)

Como mostrar o **banco de dados funcionando com o sistema**, para a disciplina de Banco de Dados (issue #225). O
professor faz uma ação, por exemplo registra um lote pelo sensor no Wokwi, confere no site que o lote entrou e depois
abre o **próprio PostgreSQL, no pgAdmin**, para ver a mesma linha gravada na tabela. O SQL que a API mandou também
aparece na hora, no log do banco. E um script de aula mostra, bloco a bloco, triggers, `DELETE`,
restrições, transações, permissões e o resto, sem estragar os dados.

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

0. **Antes do lote:** com o sensor ligado, o log já mostra a cada 15 s o sinal de vida (issue #218): o `select` do
   sensor pelo `token_hash` e um `insert into telemetria (...)` com a vazão do potenciômetro. Espere
   `Sinal de vida OK` no monitor serial.
1. **No Wokwi:** clique em ▶, espere `Sinal de vida OK`, aperte o botão verde para começar o lote, gire o potenciômetro para dar vazão e aperte
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

-- O sinal de vida do sensor: as leituras de vazão dos últimos 2 minutos, a cada 15 s
SELECT t.id, p.nome AS processo, t.vazao_litros,
       t.registrado_em AT TIME ZONE 'America/Recife' AS registrado_em_recife
FROM telemetria t
JOIN processo p ON p.id = t.processo_id
WHERE t.registrado_em > now() - interval '2 minutes'
ORDER BY t.id DESC;
```

O `esperado` não veio do sensor: o trigger `trg_lote_esperado` calculou pela meta do processo na hora do `INSERT`
(tabela abaixo, passo 3). O mesmo vale para um lote registrado pelo site, em **Registrar lote**.

**Não registre lote de Estonagem pelo site** se quiser mostrar o alerta ao vivo: a massa deixa a Estonagem com 2 lotes
acima da meta, e o lote crítico do sensor (vazão no máximo por uns 40 s) é o 3º, que abre o alerta. Aí o pgAdmin
mostra a linha nova em `alerta` e as 3 em `alerta_lote`.

## O modelo

São 10 tabelas, criadas e alteradas só por migrações do Flyway
([`backend/src/main/resources/db/migration`](../../backend/src/main/resources/db/migration), V1 a V16). No pgAdmin,
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
| `telemetria` | Sinal de vida do sensor: a vazão do momento, a cada 15 s sem lote em andamento (`POST /telemetria`) | `processo`, `usuario` |
| `auditoria_usuario` | Quem criou, desativou ou trocou a senha de cada conta | `usuario` (2 vezes) |
| `preco_m3` | Preço do m³ da água comprada, com a data de vigência, base do custo da água | `usuario` |

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

## Teste guiado: criar um usuário no site e tentar apagá-lo no banco

É o teste que o professor costuma pedir: uma ação no site, a linha gravada no banco e o banco protegendo os dados.
Leva uns 3 minutos. Use um login novo, por exemplo `teste.aula`.

**1. No site** (<http://localhost:3000>, como administrador): em **Usuários**, cadastre um operador com o login
`teste.aula`.

**2. No pgAdmin** (**Tools > Query Tool**), confira o usuário e a auditoria, gravados na mesma transação:

```sql
SELECT id, login, perfil, ativo FROM usuario ORDER BY id DESC LIMIT 3;
SELECT * FROM auditoria_usuario ORDER BY id DESC LIMIT 3;
```

O usuário aparece com `ativo = true`, e a auditoria tem uma linha `CRIACAO_USUARIO`, com o administrador em
`gestor_id` e o usuário novo em `usuario_afetado_id`.

**3. Tente apagar o usuário:**

```sql
DELETE FROM usuario WHERE login = 'teste.aula';
```

O banco recusa:

```text
ERROR: update or delete on table "usuario" violates foreign key constraint "auditoria_usuario_usuario_afetado_id_fkey"
DETAIL: Key (id)=(...) is still referenced from table "auditoria_usuario".
```

A linha da auditoria aponta para o usuário pela chave estrangeira, e o trigger `trg_auditoria_imutavel` impede apagar
ou alterar a auditoria. Resultado: um usuário com histórico não some do banco. É integridade referencial protegendo a
trilha de auditoria.

**4. Desative o usuário**, que é o jeito certo de tirar alguém do sistema:

```sql
UPDATE usuario SET ativo = false WHERE login = 'teste.aula';
SELECT id, login, perfil, ativo FROM usuario WHERE login = 'teste.aula';
```

**5. Confira o efeito no site:** em **Usuários**, aperte F5 e ele aparece como inativo. Tente entrar com
`teste.aula`: o login é recusado.

O `UPDATE` feito direto no banco não grava auditoria, porque quem grava é a API. Pelo botão **Desativar** do site, entra
também uma linha `DESATIVACAO_USUARIO` em `auditoria_usuario`. Vale mostrar os dois para comparar.

## Comandos de teste

**Todos os testes do banco num arquivo só:**
[`database/demonstracao/testes-banco-plano-c.sql`](../../database/demonstracao/testes-banco-plano-c.sql). Abra no
Query Tool do pgAdmin e rode bloco a bloco (selecione e aperte F5). São 10 partes:

| Parte | O que testa |
|---|---|
| 0 | Versão, tabelas com a quantidade de linhas e as migrações do Flyway |
| 1 | Ver usuários: todos, ativos e inativos, por perfil, pelo login, auditoria com os nomes e quem registrou mais lotes |
| 2 | `INSERT`, `UPDATE` e `DELETE` de um usuário de teste criado pelo SQL; login repetido, perfil inventado, login curto e senha sem hash são recusados |
| 3 | Usuário criado pelo site: `DELETE` recusado, auditoria imutável, desativar, lote de usuário inativo recusado e reativar |
| 4 | Processos: `INSERT`, `UPDATE` da meta e `DELETE`; meta zero, unidade inventada, nome repetido e apagar processo com lotes são recusados |
| 5 | Lotes: consultas, consumo por processo e por dia, `INSERT` com o trigger calculando o esperado; alterar, apagar e valores inválidos são recusados |
| 6 | Alertas: a visão, os lotes de cada alerta e a mudança de status; status inventado e lote repetido no alerta são recusados |
| 7 | Efluentes: descartes, pH fora de 5 a 9, o resumo mensal e o `INSERT`; pH 15, turbidez negativa, reúso acima de 100% e lote inexistente são recusados |
| 8 | Preço do m³ (imutável), sinal de vida do sensor e avisos do Telegram pendentes |
| 9 | Permissões do `aguas_api`: lê, mas não apaga nem cria tabela |
| 10 | Conferência: os registros de teste foram apagados |

As partes 2 e 4 gravam de verdade só em registros de teste e os apagam no fim. A parte 3 desativa e reativa o usuário
que você criou no site: troque `'teste.aula'` pelo login dele. Os blocos de lote, alerta, descarte e preço rodam
dentro de `BEGIN ... ROLLBACK` e não deixam nada gravado. Para o lote ou o descarte aparecer no site, troque o
`ROLLBACK` por `COMMIT`.

**No PowerShell**, na pasta do projeto, com o plano C no ar:

**O sistema está no ar?**

| Comando | Resultado esperado |
|---|---|
| `docker compose -f docker-compose.yml -f docker-compose.banco.yml ps` | `db`, `backend`, `frontend` e `adminer` em `Up`; `db` e `backend` em `healthy` |
| `curl.exe http://localhost:3000/api/actuator/health` | `{"status":"UP",...}` |
| Abrir <http://localhost:3000> e <http://localhost:8081> | O site e o Adminer |

**O banco está certo?**

```powershell
# Tabelas e quantidade de linhas
docker compose exec -T db psql -U postgres -d aguas -c "SELECT relname AS tabela, n_live_tup AS linhas FROM pg_stat_user_tables ORDER BY relname;"

# Última migração do Flyway aplicada
docker compose exec -T db psql -U postgres -d aguas -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;"

# Usuários e auditoria
docker compose exec -T db psql -U postgres -d aguas -c "SELECT id, login, perfil, ativo FROM usuario ORDER BY id;"
docker compose exec -T db psql -U postgres -d aguas -c "SELECT * FROM auditoria_usuario ORDER BY id DESC LIMIT 5;"

# O script da aula inteiro: termina com "igual" em todas as tabelas
chcp 65001
cmd /c "docker compose exec -T db psql -U postgres -d aguas < database\demonstracao\aula-banco-de-dados.sql"
```

**O banco recusa o que deve recusar?** Cole no Query Tool do pgAdmin, um por vez. Cada um para com erro e não muda
nada:

```sql
DELETE FROM lote WHERE id = 1;                          -- trigger: lote não pode ser alterado nem excluído
UPDATE auditoria_usuario SET acao = 'X' WHERE id = 1;   -- trigger: auditoria é imutável
DELETE FROM usuario WHERE id = 1;                       -- chave estrangeira: o usuário tem lotes e auditoria
INSERT INTO efluentes_descarte (lote_id, volume_litros, ph, turbidez_ntu) VALUES (1, 100, 15, 10);  -- CHECK: pH entre 0 e 14
```

**A senha do banco para o pgAdmin ou o Adminer**, copiada direto para a área de transferência, sem aparecer na tela:

```powershell
docker compose exec -T db cat /segredos/postgres | Set-Clipboard
```

**Os testes automáticos do projeto** (precisam do Node com o pnpm e do Maven instalados):

| Comando | O que testa |
|---|---|
| `pnpm test` | Front-end (Vitest) |
| `cd backend; mvn test` | Back-end, com um PostgreSQL de teste em contêiner (Testcontainers) |
| `pnpm test:e2e` | O site no navegador (Playwright), fluxo de ponta a ponta |

O CI roda todos eles, e também o plano C com o script da aula, em todo pull request.

## Script da aula: tudo o que o banco faz

[`database/demonstracao/aula-banco-de-dados.sql`](../../database/demonstracao/aula-banco-de-dados.sql) mostra, em 12
partes, tudo o que dá para fazer no banco: consultas, `INSERT`, `UPDATE`, `DELETE`, triggers, restrições,
transações, permissões, índices e visões. Cada bloco tem um comentário explicando o que vai acontecer.

**Não estraga os dados da demonstração.** O que grava, altera ou apaga roda dentro de `BEGIN ... ROLLBACK`. O que o
banco recusa roda num bloco `DO` que mostra a mensagem de erro como aviso (`NOTICE: RECUSADO ...`), sem parar o
script. A última parte compara a quantidade de linhas de cada tabela com a do começo e mostra `igual` em todas.

**No pgAdmin** (o jeito da aula): **Tools > Query Tool**, abra o arquivo pelo ícone de pasta, selecione um bloco e
aperte **F5**. O resultado aparece em **Data Output**, e as recusas, em **Messages**. Rode primeiro a parte 0, que
guarda a "foto" do começo para a parte 12.

**Inteiro, no PowerShell** (para conferir antes da aula, uns 2 segundos):

```powershell
chcp 65001
cmd /c "docker compose exec -T db psql -U postgres -d aguas < database\demonstracao\aula-banco-de-dados.sql"
```

O `chcp 65001` faz o PowerShell mostrar os acentos certos.

| Parte | O que mostra | Como |
|---|---|---|
| 0 | Foto do começo | Uma tabela temporária com a quantidade de linhas de cada tabela |
| 1 | **Catálogo**: o banco descreve a si mesmo | Tabelas e visões, colunas de `lote`, todas as restrições (PK, FK, UNIQUE, CHECK), índices, triggers, o código PL/pgSQL das funções e a definição das visões |
| 2 | **Consultas** | `JOIN` de 3 tabelas; `GROUP BY` com `HAVING`; subconsulta correlacionada; **a regra do alerta escrita em SQL**, com CTE e `LAG` (encontra os mesmos alertas que a API abriu); acumulado por dia com `SUM() OVER` |
| 3 | **INSERT com trigger** | O lote entra sem o `esperado`, e o trigger `trg_lote_esperado` calcula (meta × peças). O mesmo trigger recusa lote de usuário desativado |
| 4 | **UPDATE** | Mudar a meta é permitido, e os lotes antigos guardam o esperado da época. Alterar lote ou auditoria é recusado pelos triggers `trg_lote_imutavel` e `trg_auditoria_imutavel` |
| 5 | **DELETE** | Apagar lote é recusado pelo trigger. Apagar processo com lotes é recusado pela chave estrangeira. Apagar um processo novo, sem lotes, funciona (`DELETE ... RETURNING`). `TRUNCATE` esvazia sem disparar os triggers de linha e volta com `ROLLBACK` |
| 6 | **Restrições** | O banco recusa pH 15 e litros negativos (`CHECK`), status inventado (`CHECK`), lote sem litros (`NOT NULL`), processo com nome repetido (`UNIQUE`), descarte de lote inexistente (`FOREIGN KEY`) e lote em dois alertas (`PRIMARY KEY`) |
| 7 | **Transações** | `SAVEPOINT` e `ROLLBACK TO SAVEPOINT` desfazem só uma parte; o `ROLLBACK` final desfaz tudo |
| 8 | **Sequências** | O id usado numa transação desfeita não volta: é por isso que os ids podem ter buracos |
| 9 | **Permissões** | O que o `aguas_api` pode em cada tabela. Com `SET LOCAL ROLE aguas_api`, ler funciona, mas apagar e criar tabela são recusados (privilégio mínimo) |
| 10 | **Índices** | `EXPLAIN ANALYZE` da consulta do Histórico, com e sem leitura sequencial, mostrando o índice `ix_lote_processo_data` |
| 11 | **Visões e versão** | `v_alertas`, `v_efluentes_mensal` e o histórico de migrações do Flyway |
| 12 | Conferência | A quantidade de linhas de cada tabela, no começo e agora: `igual` em todas |

Com a massa de demonstração, o script mostra 14 recusas. Sem ela, até duas recusas viram um aviso pedindo dados: a da
auditoria, que precisa de um usuário cadastrado pelo site, e a da chave primária de `alerta_lote`, que precisa de um
alerta. O CI roda o script inteiro em todo PR e confere que nada foi aceito indevidamente e que o banco terminou igual.

**Para ver um erro "de verdade"**, como o professor veria fora do script, rode um comando solto no Query Tool. Ele
para com o erro em vermelho:

```sql
DELETE FROM lote WHERE id = 1;
-- ERROR: Lote não pode ser alterado nem excluído.
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
