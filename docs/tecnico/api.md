# API REST: endpoints

> **Documentação interativa:** com a API no ar, abra `http://<host>:8080/api/swagger-ui.html` (Swagger UI).
> Lá estão as 16 rotas com exemplos, e dá para testá-las: faça o login em `POST /auth/login`, copie o
> `token`, clique em **Authorize** e cole. A especificação OpenAPI em JSON fica em `/api/v3/api-docs`.

Base: `https://aguas-api-a0vq.onrender.com/api` no sistema publicado e `http://localhost:8080/api` no computador. Corpo e respostas em JSON. Datas em ISO 8601 UTC (ex.:
`2026-10-15T00:03:58.229Z`). Números decimais vão como números JSON.

Autenticação: `Authorization: Bearer <token>`, com o token obtido em `POST /auth/login`. O token vale
8 horas e não é renovado automaticamente.

## Erros

Todos os erros seguem o formato que o front já trata (`ErroApiDTO` em `src/services/tipos.ts`):

```json
{ "codigo": "VALIDACAO", "mensagem": "Verifique os campos destacados.", "campos": { "meta": "A meta deve ser maior que zero." } }
```

| HTTP | `codigo` | Quando |
|---|---|---|
| 400 | `REQUISICAO_INVALIDA` | JSON malformado ou tipo de parâmetro inválido |
| 401 | `CREDENCIAIS_INVALIDAS` | login com usuário ou senha errados, ou usuário desativado |
| 401 | `NAO_AUTENTICADO` | sem token, token inválido ou expirado, ou usuário desativado depois do login |
| 403 | `ACESSO_NEGADO` | perfil sem permissão, ou tentativa de alterar a conta de outra pessoa |
| 404 | `NAO_ENCONTRADO` | recurso inexistente; o operador também recebe 404 para lote de outra pessoa |
| 409 | `USUARIO_DUPLICADO`, `PROCESSO_DUPLICADO`, `TRANSICAO_INVALIDA`, `OPERACAO_NAO_PERMITIDA`, `CONFLITO` | conflitos de regra ou de unicidade |
| 422 | `VALIDACAO` | campos inválidos (detalhes em `campos`) |
| 503 | `BANCO_INDISPONIVEL` | sem conexão com o PostgreSQL |
| 500 | `ERRO_INTERNO` | erro inesperado (o detalhe fica só no log) |

## Endpoints

| Método e rota | Perfil | Entrada | Saída |
|---|---|---|---|
| `POST /auth/login` | público | `{usuario, senha}` | `200 {token, usuario: UsuarioDTO}` |
| `GET /auth/me` | autenticado | — | `UsuarioDTO` |
| `GET /usuarios` | gestor | — | `UsuarioDTO[]` |
| `POST /usuarios` | gestor | `{nome, usuario, perfil, senha}` | `201 UsuarioDTO` |
| `PATCH /usuarios/{id}` | a própria pessoa | `{nome?, senha?, senhaAtual?}` (`senhaAtual` é obrigatória quando há `senha`) | `UsuarioDTO` |
| `PATCH /usuarios/{id}/senha` | gestor (não em si mesmo nem no administrador principal) | `{senha}` (8 a 72 bytes) | `UsuarioDTO`; registra `REDEFINICAO_SENHA` na auditoria |
| `PATCH /usuarios/{id}/ativo` | gestor (não em si mesmo) | `{ativo}` | `UsuarioDTO`; registra `DESATIVACAO_USUARIO` ou `REATIVACAO_USUARIO` na auditoria |
| `GET /processos` | autenticado | — | `ProcessoDTO[]` |
| `POST /processos` | gestor | `{nome, unidade, meta}` | `201 ProcessoDTO` |
| `PUT /processos/{id}` | gestor | `{nome, unidade, meta}` | `ProcessoDTO` |
| `GET /lotes?processoId=&inicio=&fim=` | gestor vê todos; operador, os próprios | filtros opcionais (`inicio`/`fim` em ISO 8601 com fuso) | `LoteDTO[]`, do mais recente ao mais antigo |
| `GET /lotes/{id}` | mesma regra | — | `LoteDTO` |
| `POST /lotes` | autenticado | `{processoId, pecas, litros}` (o usuário vem do token) | `201 LoteDTO` |
| `GET /alertas?status=` | gestor | `status` opcional: `aberto`, `analise` ou `resolvido` | `AlertaDTO[]` |
| `PATCH /alertas/{id}/status` | gestor | `{status}` | `AlertaDTO` |
| `GET /relatorios/resumo?mes=&ano=` | gestor | `mes` de 1 a 12; `ano` de 2000 a 2100 | `ResumoDTO[]` (só processos com lotes no mês) |

## Tipos

```ts
UsuarioDTO  = { id, nome, usuario, perfil: 'gestor' | 'operador', ativo }
ProcessoDTO = { id, nome, unidade: 'lote' | 'peca', meta }
LoteDTO     = { id, processoId, pecas, litros, esperado, desvio, statusConformidade, data, usuarioId }  // desvio em %, 2 casas
              // statusConformidade: 'DENTRO_DA_META' (≤ 0%) | 'ATENCAO' (≤ 8%) | 'CRITICO' (> 8%)
AlertaDTO   = { id, processoId, loteIds: number[], detectado, status }
ResumoDTO   = { processoId, real, esperado, lotes }
```

## Validações

Os limites vêm das colunas e restrições criadas pelas migrações (`V1__cria_tabelas_principais.sql`):

| Campo | Regra |
|---|---|
| `usuario` (login) | 3 a 60 caracteres: `a-z 0-9 . _ -`; único, sem diferenciar maiúsculas |
| `nome` do usuário | obrigatório; até 120 caracteres |
| `senha` | 8 a 72 bytes; guardada só como hash BCrypt |
| `nome` do processo | obrigatório; até 80 caracteres; único, sem diferenciar maiúsculas |
| `meta` | maior que 0; até 8 dígitos inteiros e 2 decimais |
| `pecas` | inteiro maior que 0 |
| `litros` | maior que 0; até 10 dígitos inteiros e 2 decimais |
