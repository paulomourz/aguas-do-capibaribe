# PostgreSQL remoto: o que o responsável pelo banco precisa fornecer

A API roda num computador e o PostgreSQL em outro. Este guia lista o que precisa ser combinado.
Nenhuma credencial deve ser enviada por chat nem gravada no Git: os valores vão só para o arquivo
`backend/.env` (ignorado pelo Git) ou para variáveis de ambiente do servidor.

## 1. Esquema

- O esquema vem das migrações Flyway (`backend/src/main/resources/db/migration/`). Num banco vazio,
  aplique-as com o dono do banco (`mvn flyway:migrate`, passo a passo em
  [`../../database/LEIA-ME.md`](../../database/LEIA-ME.md#banco-novo)); depois, a API aplica sozinha as
  migrações novas ao subir, usando `FLYWAY_USER` / `FLYWAY_PASSWORD`.
- Mudança de esquema é sempre uma migração nova, nunca um comando à mão no banco. Na inicialização, a
  API confere tabelas e colunas e não sobe se algo divergir.

## 2. Dados a informar à equipe da API

| Item | Variável | Observação |
|---|---|---|
| Endereço do servidor | `DB_HOST` | IP fixo ou nome DNS acessível a partir da máquina da API |
| Porta | `DB_PORT` | normalmente 5432 |
| Nome do banco | `DB_NAME` | |
| Usuário da aplicação | `DB_USER` | **não** use o superusuário `postgres` |
| Senha desse usuário | `DB_PASSWORD` | entregue por canal seguro |
| Exigência de SSL | `DB_SSLMODE` | `require` ou `verify-full` se a conexão sair da rede local |

## 3. Usuário da aplicação (permissões mínimas)

A API precisa ler e gravar dados, mas não alterar a estrutura. O script
[`../../database/seguranca-usuario-api.sql`](../../database/seguranca-usuario-api.sql) cria o usuário
`aguas_api` com essas permissões e, no fim, mostra uma tabela do que ele pode fazer em cada tabela.
Execute como dono do banco (psql 18+). A senha entra pela linha de comando e não fica no arquivo:

```powershell
psql -U postgres -d aguas -v ON_ERROR_STOP=1 -v papel=aguas_api -v banco=aguas -v senha='<senha forte>' -f database/seguranca-usuario-api.sql
```

Depois, no `backend/.env`, troque `DB_USER=aguas_api` e `DB_PASSWORD=<a mesma senha>` e reinicie a API.
O `application.yml` não muda: ele só lê `DB_USER` e `DB_PASSWORD`.

Por que esses privilégios:

- `UPDATE` em `processo` e `usuario` cobre a edição de metas, de nome e de senha e a
  ativação/desativação de acesso. Em `processo`, ele também é exigido pelo `SELECT ... FOR UPDATE`
  que serializa os registros de lote.
- Em `alerta`, o `UPDATE` serve para mudar o status.
- `lote` só precisa de `INSERT`, porque o trigger já impede alterações.
- A API não faz `DELETE` em nenhuma tabela.
- Sem `DELETE`, `TRUNCATE` e `CREATE`, um erro ou invasão na API não consegue apagar dados nem alterar
  o esquema. `DROP` e `ALTER` já são barrados porque as tabelas pertencem ao `postgres`: só o dono
  altera a estrutura.

## 4. Rede

- **Firewall do servidor do banco:** libere a porta do PostgreSQL (5432) **apenas** para o IP da
  máquina da API.
- **`postgresql.conf`:** `listen_addresses` precisa incluir a interface de rede usada (não só
  `localhost`).
- **`pg_hba.conf`:** adicione uma linha restrita ao IP da API, por exemplo
  `hostssl  <banco>  aguas_api  <IP_DA_API>/32  scram-sha-256`. Use `host` em vez de `hostssl` só
  numa rede local confiável e sem SSL configurado. Depois, recarregue o PostgreSQL.
- Para testar a partir da máquina da API, antes de subir a aplicação:
  `psql "host=<host> port=5432 dbname=<banco> user=aguas_api sslmode=require"`
  (ou `Test-NetConnection <host> -Port 5432` no PowerShell, para testar só a porta).

## 5. Primeiro gestor

Não é preciso inserir ninguém à mão. Na primeira inicialização num banco vazio, a API cria o
administrador principal (`capibaribe.admin`, perfil gestor) com a senha de `ADMIN_SENHA`, guardada só
como hash BCrypt. Detalhes em [`../../backend/README.md`](../../backend/README.md#administrador-principal).

## 6. Situação atual

- **Sistema publicado:** site em <https://aguas-do-capibaribe.onrender.com> e API em
  <https://aguas-api-a0vq.onrender.com/api>, no Render, com o banco `aguas` no Neon (PostgreSQL 18, Ohio). O banco da
  hospedagem é separado do banco do PC e do banco do Docker. Os valores ficam em `docs/privado/hospedagem.md`, fora do Git.

- **Banco da máquina de DevOps:** `aguas`, no PostgreSQL 18 (`DB_HOST=localhost`). Não é o banco do site publicado.
  Ele tem os usuários fixos `capibaribe.admin` (perfil admin) e `sensor.wokwi` (perfil sensor, usado pelo sensor
  no Wokwi). As senhas estão em
  `docs/privado/acessos-e-senhas.md`, fora do Git. Não há processos, lotes nem alertas: os testes
  foram apagados (com a trava `trg_lote_imutavel` desligada só durante a limpeza). Os processos reais
  são cadastrados pela tela **Processos e metas**.
- **Não existe mais banco de teste permanente.** O antigo `aguas_teste` foi apagado. Os testes de
  integração usam um banco descartável criado só na hora e apagado ao final (ver
  [`../../backend/README.md`](../../backend/README.md#testes)). Nunca rode os testes no `aguas`.
- **Usuário da API:** desde 27/10/2026 a API da máquina de DevOps conecta como `aguas_api` (script da
  seção 3). Conferido: login, processos, lotes, usuários, relatório e Swagger funcionam, e
  `DELETE FROM lote` é recusado. O `postgres` fica só para administrar o banco. A senha está em
  `docs/privado/acessos-e-senhas.md`, fora do Git.
- **Migrações aplicadas no banco da máquina de DevOps:** baseline na V4 (02/11/2026) e, depois, V5 a V8, à mão. A
  tabela `auditoria_usuario` registra as ações sobre outros usuários.
- **Flyway no banco da máquina de DevOps:** baseline feita em 02/11/2026, na versão 4. O `backend/.env` dessa máquina usa
  `FLYWAY_ATIVO=false`, para a senha do `postgres` não ficar no arquivo. Uma migração nova roda à mão, com
  `mvn flyway:migrate`, como `postgres`.
- **Banco publicado:** a API no Render conecta ao Neon como `aguas_api`, com `DB_SSLMODE=require`, e o Flyway usa o dono do
  banco, aplicando as migrações novas sozinho a cada publicação. Contas: `capibaribe.admin`, `capibaribe.gestor` e
  `sensor.wokwi`. O Render só publica depois do CI e confere a saúde da API em `/api/actuator/health`. O aviso de
  alerta no Telegram usa as variáveis `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` e `SITE_URL` do Render.
- **Backup:** `database/backup.sh` faz o backup de qualquer um dos bancos e confere se ele restaura
  ([`../../database/LEIA-ME.md`](../../database/LEIA-ME.md#backup-e-restore)).
- **Banco do Docker:** separado dos outros dois, é criado na primeira subida. As senhas são sorteadas e aparecem em
  `docker compose logs segredos`.
