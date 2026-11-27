# Águas do Capibaribe: API (back-end)

API REST em Java 25 (LTS) + Spring Boot 3.5 + Maven. Ela atende o front-end React deste repositório e usa
um PostgreSQL cujo esquema é versionado com Flyway ([`../database/LEIA-ME.md`](../database/LEIA-ME.md)).

> Na inicialização, o **Flyway** aplica as migrações pendentes de `src/main/resources/db/migration/`
> (e confere o checksum das já aplicadas). Depois, o Hibernate roda com `ddl-auto=validate`: só confere
> se tabelas e colunas batem com as entidades e, se não baterem, a API não sobe. O Hibernate nunca
> cria nem altera tabelas.

## Requisitos

- JDK 25 (LTS)
- Maven 3.9 ou superior
- Acesso de rede a um PostgreSQL 18 (o esquema vem das migrações Flyway)
- Opcional, para os testes de integração: Docker **ou** um PostgreSQL local descartável (ver [Testes](#testes))

## Estrutura

```
backend/
├── pom.xml
├── .env.example                  modelo de configuração (copie para .env)
└── src/
    ├── main/java/br/com/aguas/
    │   ├── AguasApiApplication.java
    │   ├── config/               SecurityConfig (JWT, CORS, rotas por perfil), contas iniciais, cache, Swagger
    │   ├── security/             JwtService, ConversorJwt (usuário ativo a cada requisição), limite de requisições
    │   ├── controller/           Auth, Usuario, Processo, Lote, Alerta, Relatorio, Auditoria
    │   ├── notificacao/          aviso de alerta aberto no Telegram, depois do commit e em outra thread
    │   ├── service/              regras de negócio; RegraDeAlerta é a regra pura dos 3 lotes
    │   ├── repository/           Spring Data JPA
    │   ├── entity/               mapeamento 1:1 das tabelas criadas pelas migrações
    │   ├── dto/                  contratos JSON (mesmos nomes de src/services/tipos.ts do front)
    │   ├── exception/            erros no formato {codigo, mensagem, campos}
    │   └── ferramentas/          GerarHashSenha (hash BCrypt para o primeiro gestor)
    ├── main/resources/application.yml
    ├── main/resources/db/migration/  migrações Flyway (V1__..., V2__...), aplicadas em ordem
    └── test/java/br/com/aguas/   testes unitários, web (MockMvc) e de integração (PostgreSQL)
```

## Configuração

Copie `.env.example` para `.env` (nesta pasta) e preencha. Na inicialização, a API lê o `.env`
automaticamente. Variáveis definidas no sistema têm prioridade sobre ele.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DB_HOST` | sim | Endereço (IP ou nome) do servidor PostgreSQL |
| `DB_PORT` | não (5432) | Porta do PostgreSQL |
| `DB_NAME` | sim | Nome do banco |
| `DB_USER` / `DB_PASSWORD` | sim | Usuário e senha da API no banco |
| `DB_SSLMODE` | não (`prefer`) | `disable`, `prefer`, `require` ou `verify-full` |
| `DB_POOL_MAX` | não (20) | Máximo de conexões simultâneas (no Render, 3) |
| `FLYWAY_USER` / `FLYWAY_PASSWORD` | sim, com `DB_USER=aguas_api` | Dono do banco, usado só para as migrações. Sem elas, o Flyway usa `DB_USER`, que não pode criar tabelas |
| `FLYWAY_ATIVO` | não (true) | `false`: a API não aplica migrações (rode `mvn flyway:migrate` à mão) |
| `FLYWAY_BASELINE` | não (false) | `true` **uma vez**, no banco que já existia antes do Flyway ([detalhes](../database/LEIA-ME.md#banco-que-já-existia-antes-do-flyway-o-aguas)) |
| `JWT_SECRET` | sim | Pelo menos 32 caracteres aleatórios. Gere com `openssl rand -base64 48`. Sem ele, a API não sobe |
| `JWT_EXPIRACAO` | não (`8h`) | Validade do login, sem renovação automática |
| `CORS_ORIGINS` | sim, para o navegador | Origens do front, separadas por vírgula. `*` é recusado |
| `SERVER_PORT` | não (8080) | Porta HTTP da API |
| `SWAGGER_ATIVO` | não (true) | `false` desliga o Swagger UI e a especificação OpenAPI (ex.: em produção) |
| `ADMIN_SENHA` | só na 1ª inicialização | Senha (8 a 72 bytes) do administrador principal, usada apenas para criá-lo |
| `ADMIN_LOGIN` / `ADMIN_NOME` | não | Login (`capibaribe.admin`) e nome do administrador principal |
| `LIMITE_LOGIN_POR_MINUTO` / `LIMITE_LOTES_POR_MINUTO` | não (5 / 60) | Tentativas de login por IP e lotes por usuário, por minuto. Acima disso, a API responde 429 |
| `LIMITE_LOGIN_POR_CONTA_POR_MINUTO` | não (10) | Tentativas de login de cada conta por minuto, somando todos os IPs (0 desliga). Acima disso, a API responde 429 |
| `LIMITE_CABECALHO_IP` | atrás de proxy | Cabeçalho com o IP real, que o proxy sempre sobrescreve: `X-Real-IP` no Docker, `CF-Connecting-IP` no Render. Sem ele, todos os usuários dividem o mesmo limite de login |
| `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_ID` | não | Token do bot e id da conversa que recebe o aviso de alerta aberto. Sem os dois, o aviso fica desligado. Como criar o bot: [`../docs/tecnico/telegram.md`](../docs/tecnico/telegram.md) |
| `SITE_URL` | não | Endereço do site; com ele, o aviso do Telegram leva o link do alerta |
| `GESTOR_SENHA` | não | Senha (8 a 72 bytes) da conta `capibaribe.gestor`, usada apenas para criá-la. Sem ela, a conta não é criada |
| `SENSOR_SENHA` | não | Senha (8 a 72 bytes) da conta `sensor.wokwi`, usada apenas para criá-la. Sem ela, a conta não é criada |

**Banco oficial.** O banco em uso é o `aguas` (veja a situação atual em
[`../docs/tecnico/banco-remoto.md`](../docs/tecnico/banco-remoto.md#6-situação-atual)). A API
conecta com o usuário próprio `aguas_api` (sem `DELETE`, `TRUNCATE`, `DROP` nem `ALTER`), criado por
[`../database/seguranca-usuario-api.sql`](../database/seguranca-usuario-api.sql), e não com o
superusuário `postgres` (no banco oficial desde 27/10/2026). Os testes de integração também rodam
conectados como `aguas_api` (`TESTE_PG_USER=aguas_api`).

**CORS em desenvolvimento.** O Vite deste projeto roda fixo na porta **8443** (`vite.config.ts`,
`strictPort`). A origem local é, portanto, `http://localhost:8443`. Se você abrir o front por
`http://127.0.0.1:8443` ou pelo IP da máquina, inclua essa origem exata também. Em produção, use o
endereço real do front (por exemplo `https://agua.suaempresa.com.br`), sem barra no final.

Todas as rotas ficam sob o prefixo `/api` (ex.: `http://localhost:8080/api/auth/login`).

## Executar

```bash
cd backend
mvn spring-boot:run            # desenvolvimento
mvn clean package              # gera target/aguas-api-<versão>.jar (ex.: aguas-api-2.0.0.jar)
java -jar target/aguas-api-2.0.0.jar
```

Com o `java -jar`, rode o comando dentro de `backend/` para o `.env` ser encontrado, ou defina as
variáveis no sistema.

### Documentação interativa (Swagger)

Com a API no ar, abra **http://localhost:8080/api/swagger-ui.html**. A página lista as 19 rotas por
grupo (Auth, Processos, Lotes, Alertas, Usuários, Relatórios, Auditoria e Monitoramento), com o formato de cada pedido e
resposta, e permite testá-las:

1. Em **POST /auth/login**, clique em *Try it out*, informe usuário e senha e clique em *Execute*.
2. Copie o `token` da resposta, clique em **Authorize** (cadeado no topo), cole o token e confirme.
3. As outras rotas passam a ser chamadas com `Authorization: Bearer <token>`.

A especificação OpenAPI em JSON fica em `/api/v3/api-docs` (dá para importar no Postman ou Insomnia).
Para desligar as duas páginas, use `SWAGGER_ATIVO=false`. A versão exibida vem do `pom.xml`.

### Front-end apontando para a API

O front usa a API por padrão, em `http://localhost:8080/api`. Para outro endereço, crie o `.env.local`
na raiz a partir do `.env.example` (UTF-8 sem BOM):

```
VITE_API_URL=http://localhost:8080/api
```

Depois rode `pnpm install` e `pnpm dev` (Node 22, conforme `.mise.toml`). O site precisa da API no ar: não há mais
modo simulado.

## Perfis e contas iniciais

| Perfil | O que pode fazer |
|---|---|
| `admin` | tudo o que o gestor faz, mais usuários (`POST /usuarios`, `PATCH /usuarios/{id}/ativo` e `/senha`) e `GET /auditoria` |
| `gestor` | dashboard, alertas, relatórios, processos e lotes de todos; só lê a lista de usuários (`GET /usuarios`) |
| `operador` | registra lotes, vê os próprios e altera a própria conta |
| `sensor` | só `GET /processos` e `POST /lotes`; o site recusa essa conta no login |

| Conta | Perfil | Criada na inicialização se |
|---|---|---|
| `capibaribe.admin` (`ADMIN_LOGIN`) | admin | não existir; sem ela e sem `ADMIN_SENHA`, a API não sobe |
| `capibaribe.gestor` | gestor | não existir e `GESTOR_SENHA` estiver definida |
| `sensor.wokwi` | sensor | não existir e `SENSOR_SENHA` estiver definida |

Em todas, a senha só é usada para criar a conta: se ela já existe, nada muda, e a senha trocada pelo site continua
valendo. Num banco anterior à V6, o administrador principal é promovido de gestor para admin na subida, sem trocar a
senha.

## Administrador principal

O sistema sempre tem um administrador principal (perfil admin), por padrão com o login
`capibaribe.admin`. Não existe cadastro público: os demais usuários são criados por um administrador na
tela **Usuários**.

- Na inicialização, se esse login não existe no banco, a API o cria com a senha de `ADMIN_SENHA`
  (de 8 a 72 bytes). Sem o administrador e sem `ADMIN_SENHA`, a API não sobe.
- Se ele já existe, a API não altera nada: a senha trocada pelo site continua valendo. Depois da
  primeira inicialização, `ADMIN_SENHA` pode ser removida do ambiente.
- A senha nunca fica no código nem nas migrações; vem só do `backend/.env` ou das variáveis do
  servidor. Troque-a pelo site no primeiro acesso.
- O administrador principal não pode ser desativado. Login e nome podem ser mudados com
  `ADMIN_LOGIN` e `ADMIN_NOME`.

### Esqueci a senha

Quem esquece a senha pede a um administrador, que usa **Redefinir senha** na tela **Usuários** e entrega a
nova senha à pessoa (a antiga deixa de valer na hora). O administrador não redefine a própria senha por ali
(ela se troca em **Configurações**, com a senha atual) nem a do administrador principal. Se ninguém
consegue entrar (por exemplo, esqueceu a senha do `capibaribe.admin`), redefina direto no banco, com
`psql` conectado ao banco da API:

```sql
UPDATE public.usuario SET senha_hash = crypt('NOVA-SENHA-AQUI', gen_salt('bf', 10))
WHERE login = 'capibaribe.admin';
```

Troque o login para redefinir outra conta. Se o banco disser que `crypt` não existe, rode antes
`CREATE EXTENSION IF NOT EXISTS pgcrypto;`. A senha precisa ter pelo menos 8 caracteres. Depois,
entre no site e troque-a de novo em **Configurações**, para ela não ficar no histórico do `psql`.

### Usuário extra direto no banco (opcional)

Para inserir outro administrador ou gestor sem passar pelo site:

1. Gere o hash BCrypt da senha (nesta pasta). A senha é digitada no terminal e não aparece no
   histórico:
   ```bash
   mvn -q compile exec:java
   ```
   A última linha impressa é o hash, que começa com `$2a$` e tem 60 caracteres. A senha precisa ter
   pelo menos 8 caracteres.
2. Conecte-se ao banco com `psql` e execute o comando abaixo, trocando os valores entre aspas. O
   login deve ter de 3 a 60 caracteres: letras minúsculas sem acento, números, `.`, `-` ou `_`.
   ```sql
   \set nome  'Nome Completo do Gestor'
   \set login 'login.do.gestor'
   \set hash  'COLE_AQUI_O_HASH_GERADO'
   INSERT INTO public.usuario (nome, login, senha_hash, perfil)
   VALUES (:'nome', :'login', :'hash', 'gestor');   -- ou 'admin'
   ```
   Use `\set` numa sessão interativa (ou num arquivo com `psql -f`): o `psql -c` não substitui
   variáveis. As aspas simples evitam que o shell interprete o `$` do hash.
3. Entre no sistema com esse login e a senha digitada no passo 1. Não guarde a senha em arquivos nem
   em mensagens.

## Regras implementadas

- **Esperado do lote:** calculado pelo trigger `trg_lote_esperado` do banco. A API não envia esse
  valor e o lê de volta após o INSERT. O desvio usa a mesma fórmula da view `v_historico_lotes`.
- **Lote imutável:** a entidade é `@Immutable` e o banco bloqueia UPDATE e DELETE.
- **Reenvio sem duplicar:** com o cabeçalho `Idempotency-Key` (UUID), um reenvio da mesma chave devolve o lote já
  gravado (200), em vez de criar outro (201). A mesma chave com outros dados ou de outro usuário dá 409.
- **Alertas:** "acima da meta" significa `litros > esperado`, sem tolerância. Como `alerta_lote` tem
  PK apenas em `lote_id`, cada lote pertence a no máximo um alerta. Ao registrar um lote acima:
  1. se o lote anterior do processo também está acima e pertence a um alerta `aberto` ou `analise`,
     o novo lote entra nesse alerta;
  2. senão, se os 3 lotes mais recentes do processo estão acima e nenhum tem alerta, é criado um
     alerta `aberto`;
  3. lotes de alertas `resolvido` nunca são reaproveitados: é preciso uma nova sequência de 3.

  Registros do mesmo processo são serializados com `SELECT ... FOR UPDATE` no processo. Quando um alerta é
  aberto, a API publica um evento; depois do commit, o `AvisoDeAlerta` manda a mensagem ao Telegram em outra
  thread, com fila limitada. Se o envio falhar, o lote e o alerta continuam gravados e o log só diz o tipo do erro.
- **Status do alerta:** só são aceitos `aberto → analise`, `aberto → resolvido` e
  `analise → resolvido`. `atualizado_em` é preenchido quando o status muda.
- **Usuários:** login gravado em minúsculas e comparado sem diferenciar maiúsculas. Senhas de 8 a 72
  bytes, armazenadas só como hash BCrypt. Para trocar a própria senha é preciso informar a senha
  atual. Cada pessoa só altera a própria conta; o administrador pode redefinir a senha de outra pessoa
  (`PATCH /usuarios/{id}/senha`), exceto a do administrador principal, e não pode desativar a si mesmo.
- **Auditoria:** criar, redefinir a senha, desativar ou reativar outra pessoa grava em `auditoria_usuario`
  quem fez (`gestor_id`), em quem (`usuario_afetado_id`), a ação e a hora, na mesma transação da
  mudança (se uma falhar, as duas são desfeitas). Ações recusadas não geram registro. A tabela não
  tem coluna de senha, e o banco bloqueia UPDATE e DELETE nela (`trg_auditoria_imutavel`); a API
  também escreve uma linha `Auditoria: ...` no log, só com ids. O administrador consulta os registros em
  `GET /auditoria`, com filtro por período e ação e paginação.
- **Sessão:** JWT HS256 válido por 8 horas. A cada requisição autenticada, a API consulta o usuário
  no banco: se ele foi desativado, recebe 401 na hora, e o perfil considerado é sempre o do banco.
- **Relatório mensal:** o mês é definido no fuso `America/Recife`.
- **Limite de requisições:** 5 tentativas de login por minuto por IP e 60 lotes por minuto por usuário (bucket4j);
  acima disso, 429 com `Retry-After`.
- **Cache:** a lista de processos (`GET /processos`) fica em memória e sai do cache depois de cada cadastro ou edição.
- **Monitoramento:** `GET /actuator/health` é aberto e só diz `UP` ou `DOWN`; `GET /actuator/metrics` é só do admin.
  Nenhum outro endpoint do Actuator fica exposto.
- **Faixas ok / atenção / crítico:** cada lote sai da API com `statusConformidade`
  (`DENTRO_DA_META` se desvio ≤ 0%, `ATENCAO` se ≤ 8%, `CRITICO` acima), calculado por
  `StatusConformidade.de`. Totais e
  médias (relatório, dashboard, média do alerta) são classificados no front, com os mesmos limites.

Endpoints: [`../docs/tecnico/api.md`](../docs/tecnico/api.md). Dados que o responsável pelo banco
precisa fornecer: [`../docs/tecnico/banco-remoto.md`](../docs/tecnico/banco-remoto.md).

## Testes

```bash
mvn clean compile
mvn test
```

| Conjunto | Precisa de banco? | O que cobre |
|---|---|---|
| `RegraDeAlertaTest`, `RegrasSimplesTest` | não | regra dos 3 lotes, transições de status, fórmula do desvio, faixas de conformidade, CORS, JWT |
| `SegurancaWebTest` | não (serviços simulados) | 401/403 por perfil, usuário desativado, validações (422), formato de erro, CORS |
| `LimiteDeRequisicoesTest` | não | limite de login por IP e de lotes por usuário (429) |
| `ProcessoControllerTest` | não (repositório simulado) | cadastro e edição de processos: meta zero ou negativa, campos faltando, nome repetido (US-02) |
| `ProcessoServiceCacheTest` | não | cache da lista de processos e saída do cache ao cadastrar ou editar |
| `AuditoriaUsuarioTest`, `AuditoriaServiceTest` | não | registro das ações e consulta da auditoria |
| `AdminInicialTest`, `GestorInicialTest`, `SensorInicialTest` | não | contas criadas na inicialização |
| `AvisoDeAlertaTest` | não | mensagem do Telegram e falha no envio sem afetar quem registrou o lote |
| `IntegracaoPostgresContainerTest` | Docker | todos os testes de integração num PostgreSQL 18 descartável, que começa vazio: o Flyway aplica todas as migrações na subida |
| `IntegracaoPostgresLocalTest` | PostgreSQL local descartável | os mesmos testes, sem Docker |
| `CicloCompletoLavanderiaE2ETest` | herdado pelas duas classes acima | aceitação: a jornada da lavanderia por HTTP, do login ao relatório do mês (issue #12) |

Dois desses testes conferem o Flyway: `flywayAplicouTodasAsMigracoesEmOrdem` (banco vazio recebe V1 a
V16, com os processos iniciais) e `reinicioValidaChecksumsENaoRecriaNada` (uma nova subida valida os
checksums e não executa nada).

Os testes de integração **nunca usam o banco real**. O aviso do Telegram é testado com um servidor HTTP falso
(`TelegramFalso`), sem chamar o Telegram de verdade. Sem Docker, a classe de contêiner aparece como
*skipped*. Antes de desistir, o Testcontainers procura o Docker por cerca de 3 minutos.

Sem Docker, com um PostgreSQL 18 instalado localmente, dá para criar um cluster temporário:

```bash
initdb -D /tmp/pg-teste -U postgres --auth=trust -E UTF8 --locale=C
pg_ctl -D /tmp/pg-teste -o "-p 55432 -c listen_addresses=localhost" -l /tmp/pg-teste.log start
psql -h localhost -p 55432 -U postgres -c "create database aguas_teste"   # vazio: o Flyway cria o esquema
TESTE_PG_URL=jdbc:postgresql://localhost:55432/aguas_teste mvn test
pg_ctl -D /tmp/pg-teste stop                # depois, apague a pasta /tmp/pg-teste
```

Como trava de segurança, `IntegracaoPostgresLocalTest` só roda se `TESTE_PG_URL` apontar para
`localhost` **e** para um banco cujo nome termine em `_teste`. Esses testes inserem dados (e lotes não
podem ser apagados), então o banco de teste é **temporário**: crie, rode e apague. Não existe banco de
teste permanente, e o banco oficial `aguas` nunca deve ser usado aqui.

No mesmo PostgreSQL da máquina, sem cluster separado (PowerShell, dentro de `backend/`):

```powershell
psql -U postgres -c "create database aguas_verificacao_teste"
$env:TESTE_PG_URL = "jdbc:postgresql://localhost:5432/aguas_verificacao_teste"
$env:TESTE_PG_PASSWORD = "<senha do postgres>"
mvn test
psql -U postgres -c "drop database aguas_verificacao_teste"
```

Para testar conectado como `aguas_api`, use `TESTE_PG_USER=aguas_api` e informe o dono do esquema
para as migrações em `TESTE_FLYWAY_USER` / `TESTE_FLYWAY_PASSWORD`.

Logins e nomes criados pelos testes mudam a cada rodada, então rodar duas vezes no mesmo banco
temporário também funciona (na segunda, o Flyway só valida). Resultado com JDK 25 e o Docker
ligado: **253 testes, todos passando** (209 unitários e de web + 44 de integração e de sistema), na CI de 26/11/2026. Os 44 de
`IntegracaoPostgresLocalTest` aparecem como *skipped* quando `TESTE_PG_URL` não está definida: são os mesmos testes
de integração, na versão com banco local.
