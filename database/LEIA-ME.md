# Banco de dados

O esquema do sistema é versionado com **Flyway**. As migrações ficam em
[`../backend/src/main/resources/db/migration/`](../backend/src/main/resources/db/migration/) e a API
as aplica sozinha ao subir, em ordem, antes de o Hibernate conferir as tabelas. Cada banco guarda o que
já recebeu na tabela `flyway_schema_history`; uma migração nunca roda duas vezes.

| Tabela | Guarda |
|---|---|
| `usuario` | pessoas que entram no sistema (gestor ou operador), com a senha só como hash BCrypt |
| `processo` | tipos de processo de lavagem e a meta de cada um (litros por lote ou por peça) |
| `lote` | cada lote registrado: processo, peças, litros usados e litros esperados |
| `alerta` / `alerta_lote` | alertas de 3 lotes seguidos acima da meta e os lotes de cada alerta |
| `auditoria_usuario` | quem (gestor) redefiniu a senha, desativou ou reativou quem, e quando; sem nenhuma senha |

Regras que moram no próprio banco:

- `trg_lote_esperado` calcula o esperado do lote a partir da meta do processo no momento do registro.
- `trg_lote_imutavel` impede alterar ou apagar lotes: o histórico de consumo é a prova do que
  aconteceu.
- `trg_auditoria_imutavel` faz o mesmo com os registros de auditoria.
- As views `v_historico_lotes` e `v_alertas` entregam o desvio já calculado.

## Migrações

| Versão | Arquivo | O que faz |
|---|---|---|
| V1 | `V1__cria_tabelas_principais.sql` | `usuario`, `processo`, `lote`, `alerta`, `alerta_lote`, índices e views |
| V2 | `V2__cria_triggers_esperado_e_bloqueio.sql` | funções PL/pgSQL e triggers do esperado e da imutabilidade do lote |
| V3 | `V3__cria_processos_iniciais.sql` | processos iniciais com metas de referência (Amaciamento, Estonagem, Tingimento, Alvejamento) |
| V4 | `V4__cria_auditoria_usuario.sql` | `auditoria_usuario` e seu trigger de imutabilidade (issue #16) |
| V5 | `V5__auditoria_registra_criacao_usuario.sql` | a auditoria passa a aceitar a criação de usuário (issue #57) |
| V6 | `V6__perfis_admin_e_sensor.sql` | perfis `admin` e `sensor`; a conta `sensor.wokwi` passa para o perfil sensor (issue #66) |
| V7 | `V7__cria_chave_envio_do_lote.sql` | coluna `chave_envio` do lote, única, para reenvio sem duplicar (issue #54) |
| V8 | `V8__cria_indices_performance.sql` | índices da regra de alerta e dos lotes de um alerta (issue #59, ver [`desempenho/`](desempenho/)) |
| V9 | `V9__cria_token_de_api.sql` | coluna `token_hash` do usuário (SHA-256 do token de API do sensor) e ação `ROTACAO_TOKEN` na auditoria (issue #103) |
| V10 | `V10__cria_aviso_pendente.sql` | `aviso_pendente`: aviso do Telegram que não chegou depois de 3 tentativas (issue #97) |
| V11 | `V11__aviso_pendente_enviado_em.sql` | coluna `enviado_em` e permissão de UPDATE só nas colunas do reenvio (issue #97) |
| V12 | `V12__cria_tabela_efluentes_descarte.sql` | `efluentes_descarte`: volume, pH, turbidez e reaproveitamento de cada descarte do lote, só leitura e inserção para o `aguas_api` (issue #162) |
| V13 | `V13__ajusta_autovacuum_tabelas_quentes.sql` | autovacuum e analyze mais frequentes em `lote`, `alerta_lote` e `alerta` (issue #163, ver [`manutencao-banco.md`](../docs/tecnico/manutencao-banco.md)) |
| V14 | `V14__cria_tabela_telemetria.sql` | `telemetria`: leituras de vazão do sensor (processo, usuário, vazão e hora do servidor), só leitura e inserção para o `aguas_api`, com índices pela data e por processo (issues #156 e #157) |
| V15 | `V15__cria_visao_efluentes_mensal.sql` | visão `v_efluentes_mensal`: por mês (fuso de Recife) e processo, o volume descartado, o pH, a turbidez, o índice de reúso e os descartes com pH fora da faixa de lançamento da CONAMA 430 (5 a 9), com índice na expressão do mês; só leitura para o `aguas_api` (issue #203, ver [`desempenho-indices.md`](../docs/tecnico/desempenho-indices.md)) |

V1, V2 e V4 reproduzem exatamente o antigo `banco.sql` (conferido com `pg_dump`: nenhuma diferença).
V1 e V4 já dão ao `aguas_api` as permissões das tabelas que criam, se ele existir.

## Banco novo

Crie o banco vazio, aplique as migrações com o dono do banco e só então crie o usuário da API
(o script de permissões precisa das tabelas). PowerShell, dentro de `backend/`:

```powershell
psql -U postgres -c "create database aguas"
$env:FLYWAY_URL = "jdbc:postgresql://localhost:5432/aguas"
$env:FLYWAY_USER = "postgres"
$env:FLYWAY_PASSWORD = "<senha do postgres>"
mvn flyway:migrate
mvn flyway:info          # confere: todas as migrações com State = Success
psql -U postgres -d aguas -v ON_ERROR_STOP=1 -v papel=aguas_api -v banco=aguas -v senha='<senha forte>' -f ../database/seguranca-usuario-api.sql
```

Depois, no `backend/.env`, `DB_USER=aguas_api` e, para a API aplicar sozinha as migrações futuras,
`FLYWAY_USER` e `FLYWAY_PASSWORD` com o dono do banco (o `aguas_api` não pode criar tabelas). Quem
preferir não deixar essa senha na máquina da API usa `FLYWAY_ATIVO=false` e roda `mvn flyway:migrate`
à mão a cada versão nova.

Na primeira vez que a API sobe num banco vazio, ela cria o administrador principal
(`capibaribe.admin`).

## Banco que já existia antes do Flyway (o `aguas`)

O banco oficial foi criado pelo antigo `banco.sql` e já tem tudo o que V1 a V4 criariam. Ele não pode
receber essas migrações (dariam "já existe"); em vez disso, recebe uma **baseline**: o Flyway cria o
`flyway_schema_history` e marca o banco como já estando na versão 4, sem mexer em nada. Por isso o
banco oficial **não** recebe os processos da V3: os processos reais continuam vindo da tela.

Uma única vez, na primeira subida da API nova, com o dono do banco em `FLYWAY_USER`/`FLYWAY_PASSWORD`:

```powershell
$env:FLYWAY_BASELINE = "true"
mvn spring-boot:run      # no log: "Successfully baselined schema with version: 4"
```

Depois, remova `FLYWAY_BASELINE` (ou deixe `false`). Sem a baseline, a API se recusa a subir num banco
com tabelas e sem histórico ("Found non-empty schema(s) ... but no schema history table"), em vez de
tentar recriá-las.

## Mudou o banco? Crie uma migração nova

1. Crie `V12__descricao_curta.sql` (o próximo número livre, dois sublinhados) na pasta de migrações. Confira a
   `develop` antes: se outra pessoa usar o mesmo número primeiro, troque o seu para o próximo.
2. **Nunca edite uma migração que já foi para a `develop`.** O Flyway guarda o checksum de cada uma e a
   API não sobe se o arquivo mudar. Para corrigir, crie outra migração.
3. Se a migração criar uma tabela, dê as permissões do `aguas_api` nela (veja o bloco `DO $$` da V4) e
   inclua a tabela em `seguranca-usuario-api.sql`.
4. Rode `mvn test`: os testes de integração começam de um banco vazio e aplicam todas as migrações.

## Backup e restore

`backup.sh` faz o backup com `pg_dump`, confere se ele restaura e guarda os últimos 7 dias. `restore.sh` restaura.
Rodam no Git Bash (Windows) ou em qualquer Linux. Sem `pg_dump` instalado, usam o Docker.

**1. Configure a conexão uma vez.** Copie [`env.backup.example`](env.backup.example) para `database/.env.backup` e
preencha com o **dono do banco** (o `aguas_api` não lê todas as tabelas). O arquivo é ignorado pelo Git. O exemplo
tem os três bancos: Docker, PC e Neon. Para guardar mais de um, crie um arquivo para cada e escolha com `BACKUP_ENV`.

**2. Faça o backup.**

```bash
bash database/backup.sh
BACKUP_ENV=database/.env.backup.neon bash database/backup.sh   # outro banco
```

O backup fica em `database/backups/` (ignorada pelo Git), com três arquivos:

| Arquivo | O que é |
|---|---|
| `<prefixo>_<data>.dump` | o backup, no formato do `pg_dump` já compactado |
| `.dump.sha256` | o código que confere se o arquivo não foi corrompido ou alterado |
| `.dump.contagens` | quantas linhas cada tabela tinha no início e no fim do backup |

O script para com erro, sem apagar nenhum backup antigo, se qualquer passo falhar. Os passos são:

1. Conta as linhas.
2. Roda o `pg_dump`.
3. Conta as linhas de novo.
4. Confere se o arquivo abre no `pg_restore`.
5. Restaura num PostgreSQL temporário (um contêiner apagado no fim) e confere se cada tabela voltou com as linhas
   esperadas.
6. Só então apaga os backups do mesmo prefixo com mais de 7 dias.

A API nunca apaga linhas, então as linhas de cada tabela no backup ficam entre a contagem do início e a do fim, mesmo
com lotes chegando durante o backup. `BACKUP_VERIFICAR=0` pula o passo 5. `BACKUP_RETENCAO_DIAS` muda os 7 dias.

**3. Para restaurar:**

```bash
bash database/restore.sh --verificar database/backups/<arquivo>.dump   # só testa, num banco temporário
bash database/restore.sh database/backups/<arquivo>.dump               # restaura no banco do .env.backup
```

O restore de verdade só aceita um banco **vazio**: crie um banco novo, aponte o `.env.backup` para ele e rode. Ele
nunca sobrescreve dados, e roda numa transação: se der erro, o banco continua vazio. Dono e permissões não vão junto,
porque o dono do Neon não existe no PC, por exemplo. Depois do restore, rode `seguranca-usuario-api.sql`, como em
[Banco novo](#banco-novo). O histórico do Flyway vem no backup, então a API reconhece as migrações já aplicadas.

**4. Automatize** (uma vez por dia, às 3h):

- **Windows:** no Agendador de Tarefas, crie uma tarefa diária com o programa `C:\Program Files\Git\bin\bash.exe`, o
  argumento `database/backup.sh` e "Iniciar em" na pasta do projeto. O Docker Desktop precisa estar aberto se o
  `pg_dump` não estiver instalado.
- **Linux:** no `crontab -e`, adicione
  `0 3 * * * cd /caminho/do/projeto && bash database/backup.sh >> database/backups/backup.log 2>&1`.

Guarde uma cópia dos backups fora do computador (por exemplo, num drive da equipe com acesso restrito). Eles têm os
dados reais, incluindo o hash das senhas, então nunca vão para o Git nem para o chat.

| Arquivo | Para quê |
|---|---|
| `seguranca-usuario-api.sql` | cria o usuário `aguas_api`, que a API usa, só com ler, inserir e atualizar (sem apagar nem mudar a estrutura) |
| `backup.sh` / `restore.sh` | backup com verificação e retenção de 7 dias, e restore só em banco vazio (veja acima) |
| `env.backup.example` | modelo da conexão do backup, para copiar para `.env.backup` |
| `demonstracao/massa-demonstracao.sql` | massa de dados da demonstração: 20 dias de lotes, 2 alertas tratados, descartes de efluentes e a Estonagem à espera do sensor, só num banco sem lotes (ver [roteiro](../docs/guia/roteiro-apresentacao.md#preparar-a-área-de-demonstração), issue #115) |
| `demonstracao/testar-massa.sh` | testa a massa e o reset do roteiro num PostgreSQL temporário no Docker: 64 lotes, 2 alertas e 34 descartes, recusa na segunda vez e reset idêntico em menos de 30 s (issue #210) |
| `manutencao/db-bloat-check.sql` | linhas mortas, inchaço e autovacuum de cada tabela, com o `VACUUM` sugerido (ver [`manutencao-banco.md`](../docs/tecnico/manutencao-banco.md)) |

Os testes automáticos usam bancos temporários terminados em `_teste`, criados e apagados na hora;
nunca rode os testes no `aguas`.
