# Águas do Capibaribe: API (back-end)

API REST em Java 25 (LTS) + Spring Boot 3.5 + Maven. Ela atende o front-end React deste repositório e usa o
PostgreSQL definido em [`../database/banco.sql`](../database/banco.sql).

> O banco **não é criado nem alterado** pela API. O Hibernate roda com `ddl-auto=validate`: na
> inicialização ele só confere se tabelas e colunas batem com as entidades e, se não baterem, a API
> não sobe.

## Requisitos

- JDK 25 (LTS)
- Maven 3.9 ou superior
- Acesso de rede ao PostgreSQL 18 com o esquema de `database/banco.sql` já aplicado
- Opcional, para os testes de integração: Docker **ou** um PostgreSQL local descartável (ver [Testes](#testes))

## Estrutura

```
backend/
├── pom.xml
├── .env.example                  modelo de configuração (copie para .env)
└── src/
    ├── main/java/br/com/aguas/
    │   ├── AguasApiApplication.java
    │   ├── config/               AppProperties (app.*), SecurityConfig (JWT, CORS, rotas por perfil)
    │   ├── security/             JwtService, ConversorJwt (confere usuário ativo a cada requisição)
    │   ├── controller/           Auth, Usuario, Processo, Lote, Alerta, Relatorio
    │   ├── service/              regras de negócio; RegraDeAlerta é a regra pura dos 3 lotes
    │   ├── repository/           Spring Data JPA
    │   ├── entity/               mapeamento 1:1 das tabelas do banco.sql
    │   ├── dto/                  contratos JSON (mesmos nomes de src/services/tipos.ts do front)
    │   ├── exception/            erros no formato {codigo, mensagem, campos}
    │   └── ferramentas/          GerarHashSenha (hash BCrypt para o primeiro gestor)
    ├── main/resources/application.yml
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
| `DB_POOL_MAX` | não (10) | Máximo de conexões simultâneas |
| `JWT_SECRET` | sim | Pelo menos 32 caracteres aleatórios. Gere com `openssl rand -base64 48`. Sem ele, a API não sobe |
| `JWT_EXPIRACAO` | não (`8h`) | Validade do login, sem renovação automática |
| `CORS_ORIGINS` | sim, para o navegador | Origens do front, separadas por vírgula. `*` é recusado |
| `SERVER_PORT` | não (8080) | Porta HTTP da API |
| `SWAGGER_ATIVO` | não (true) | `false` desliga o Swagger UI e a especificação OpenAPI (ex.: em produção) |
| `ADMIN_SENHA` | só na 1ª inicialização | Senha (8 a 72 bytes) do administrador principal, usada apenas para criá-lo |
| `ADMIN_LOGIN` / `ADMIN_NOME` | não | Login (`capibaribe.admin`) e nome do administrador principal |

**Banco oficial.** O banco em uso é o `aguas` (veja a situação atual em
[`../docs/tecnico/banco-remoto.md`](../docs/tecnico/banco-remoto.md#6-situação-atual)). A API
conecta com o usuário próprio `aguas_api` (sem `DELETE`, `TRUNCATE`, `DROP` nem `ALTER`), criado por
[`../database/seguranca-usuario-api.sql`](../database/seguranca-usuario-api.sql), e não com o
superusuário `postgres` (no banco oficial desde 27/10/2026). Os 15 testes de integração também passam
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
mvn clean package              # gera target/aguas-api-<versão>.jar (ex.: aguas-api-0.1.0-alpha.jar)
java -jar target/aguas-api-0.1.0-alpha.jar
```

Com o `java -jar`, rode o comando dentro de `backend/` para o `.env` ser encontrado, ou defina as
variáveis no sistema.

### Documentação interativa (Swagger)

Com a API no ar, abra **http://localhost:8080/api/swagger-ui.html**. A página lista as 16 rotas por
grupo (Auth, Processos, Lotes, Alertas, Usuários e Relatórios), com o formato de cada pedido e
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

Depois rode `pnpm install` e `pnpm dev` (Node 22, conforme `.mise.toml`). O modo simulado, sem API,
só liga com `VITE_USAR_MOCK=true` e mostra uma faixa de aviso no topo.

## Administrador principal

O sistema sempre tem um administrador principal (perfil gestor), por padrão com o login
`capibaribe.admin`. Não existe cadastro público: os demais usuários são criados por ele na tela
**Usuários**.

- Na inicialização, se esse login não existe no banco, a API o cria com a senha de `ADMIN_SENHA`
  (de 8 a 72 bytes). Sem o administrador e sem `ADMIN_SENHA`, a API não sobe.
- Se ele já existe, a API não altera nada: a senha trocada pelo site continua valendo. Depois da
  primeira inicialização, `ADMIN_SENHA` pode ser removida do ambiente.
- A senha nunca fica no código nem no `banco.sql`; vem só do `backend/.env` ou das variáveis do
  servidor. Troque-a pelo site no primeiro acesso.
- O administrador principal não pode ser desativado. Login e nome podem ser mudados com
  `ADMIN_LOGIN` e `ADMIN_NOME`.

### Esqueci a senha

Quem esquece a senha pede a um gestor, que usa **Redefinir senha** na tela **Usuários** e entrega a
nova senha à pessoa (a antiga deixa de valer na hora). O gestor não redefine a própria senha por ali
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

### Gestor extra direto no banco (opcional)

Para inserir outro gestor sem passar pelo site:

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
   VALUES (:'nome', :'login', :'hash', 'gestor');
   ```
   Use `\set` numa sessão interativa (ou num arquivo com `psql -f`): o `psql -c` não substitui
   variáveis. As aspas simples evitam que o shell interprete o `$` do hash.
3. Entre no sistema com esse login e a senha digitada no passo 1. Não guarde a senha em arquivos nem
   em mensagens.

## Regras implementadas

- **Esperado do lote:** calculado pelo trigger `trg_lote_esperado` do banco. A API não envia esse
  valor e o lê de volta após o INSERT. O desvio usa a mesma fórmula da view `v_historico_lotes`.
- **Lote imutável:** a entidade é `@Immutable` e o banco bloqueia UPDATE e DELETE.
- **Alertas:** "acima da meta" significa `litros > esperado`, sem tolerância. Como `alerta_lote` tem
  PK apenas em `lote_id`, cada lote pertence a no máximo um alerta. Ao registrar um lote acima:
  1. se o lote anterior do processo também está acima e pertence a um alerta `aberto` ou `analise`,
     o novo lote entra nesse alerta;
  2. senão, se os 3 lotes mais recentes do processo estão acima e nenhum tem alerta, é criado um
     alerta `aberto`;
  3. lotes de alertas `resolvido` nunca são reaproveitados: é preciso uma nova sequência de 3.

  Registros do mesmo processo são serializados com `SELECT ... FOR UPDATE` no processo.
- **Status do alerta:** só são aceitos `aberto → analise`, `aberto → resolvido` e
  `analise → resolvido`. `atualizado_em` é preenchido quando o status muda.
- **Usuários:** login gravado em minúsculas e comparado sem diferenciar maiúsculas. Senhas de 8 a 72
  bytes, armazenadas só como hash BCrypt. Para trocar a própria senha é preciso informar a senha
  atual. Cada pessoa só altera a própria conta; o gestor pode redefinir a senha de outra pessoa
  (`PATCH /usuarios/{id}/senha`), exceto a do administrador principal, e não pode desativar a si mesmo.
- **Auditoria:** redefinir a senha, desativar ou reativar outra pessoa grava em `auditoria_usuario`
  quem fez (`gestor_id`), em quem (`usuario_afetado_id`), a ação e a hora, na mesma transação da
  mudança (se uma falhar, as duas são desfeitas). Ações recusadas não geram registro. A tabela não
  tem coluna de senha, e o banco bloqueia UPDATE e DELETE nela (`trg_auditoria_imutavel`); a API
  também escreve uma linha `Auditoria: ...` no log, só com ids.
- **Sessão:** JWT HS256 válido por 8 horas. A cada requisição autenticada, a API consulta o usuário
  no banco: se ele foi desativado, recebe 401 na hora, e o perfil considerado é sempre o do banco.
- **Relatório mensal:** o mês é definido no fuso `America/Recife`.
- **Faixas ok / atenção / crítico:** continuam só no front (`src/domain/regras.ts`) e são
  **ilustrativas**. A API não classifica lotes.

Endpoints: [`../docs/tecnico/api.md`](../docs/tecnico/api.md). Dados que o responsável pelo banco
precisa fornecer: [`../docs/tecnico/banco-remoto.md`](../docs/tecnico/banco-remoto.md).

## Testes

```bash
mvn clean compile
mvn test
```

| Conjunto | Precisa de banco? | O que cobre |
|---|---|---|
| `RegraDeAlertaTest`, `RegrasSimplesTest` | não | regra dos 3 lotes, transições de status, fórmula do desvio, CORS, JWT |
| `SegurancaWebTest` | não (serviços simulados) | 401/403 por perfil, usuário desativado, validações (422), formato de erro, CORS |
| `IntegracaoPostgresContainerTest` | Docker | todos os testes de integração num PostgreSQL 18 descartável criado com `banco.sql` |
| `IntegracaoPostgresLocalTest` | PostgreSQL local descartável | os mesmos testes, sem Docker |

Os testes de integração **nunca usam o banco real**. Sem Docker, a classe de contêiner aparece como
*skipped*. Antes de desistir, o Testcontainers procura o Docker por cerca de 3 minutos.

Sem Docker, com um PostgreSQL 18 instalado localmente, dá para criar um cluster temporário:

```bash
initdb -D /tmp/pg-teste -U postgres --auth=trust -E UTF8 --locale=C
pg_ctl -D /tmp/pg-teste -o "-p 55432 -c listen_addresses=localhost" -l /tmp/pg-teste.log start
psql -h localhost -p 55432 -U postgres -c "create database aguas_teste"
psql -h localhost -p 55432 -U postgres -d aguas_teste -v ON_ERROR_STOP=1 -f ../database/banco.sql
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
psql -U postgres -d aguas_verificacao_teste -v ON_ERROR_STOP=1 -f ../database/banco.sql
$env:TESTE_PG_URL = "jdbc:postgresql://localhost:5432/aguas_verificacao_teste"
$env:TESTE_PG_PASSWORD = "<senha do postgres>"
mvn test
psql -U postgres -c "drop database aguas_verificacao_teste"
```

Logins e nomes criados pelos testes mudam a cada rodada, então rodar duas vezes no mesmo banco
temporário também funciona. Resultado em 27/10/2026, com JDK 25: **46 testes, todos passando** (30
unitários e de web + 16 de integração). Os 16 de `IntegracaoPostgresContainerTest` aparecem como
*skipped* sem Docker: são os mesmos testes de integração, na versão com contêiner.
