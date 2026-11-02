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
mvn flyway:info          # confere: V1 a V4 com State = Success
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

1. Crie `V5__descricao_curta.sql` (o próximo número livre, dois sublinhados) na pasta de migrações.
2. **Nunca edite uma migração que já foi para a `develop`.** O Flyway guarda o checksum de cada uma e a
   API não sobe se o arquivo mudar. Para corrigir, crie outra migração.
3. Se a migração criar uma tabela, dê as permissões do `aguas_api` nela (veja o bloco `DO $$` da V4) e
   inclua a tabela em `seguranca-usuario-api.sql`.
4. Rode `mvn test`: os testes de integração começam de um banco vazio e aplicam todas as migrações.

| Arquivo | Para quê |
|---|---|
| `seguranca-usuario-api.sql` | cria o usuário `aguas_api`, que a API usa, só com ler, inserir e atualizar (sem apagar nem mudar a estrutura) |

Os testes automáticos usam bancos temporários terminados em `_teste`, criados e apagados na hora;
nunca rode os testes no `aguas`.
