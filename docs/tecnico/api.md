# API REST: endpoints

> **Documentação interativa:** com a API no ar, abra `http://<host>:8080/api/swagger-ui.html` (Swagger UI).
> Lá estão as 21 rotas com exemplos, e dá para testá-las: faça o login em `POST /auth/login`, copie o
> `token`, clique em **Authorize** e cole. A especificação OpenAPI em JSON fica em `/api/v3/api-docs`.

Base: `https://aguas-api-a0vq.onrender.com/api` no sistema publicado e `http://localhost:8080/api` no computador. Corpo e respostas em JSON. Datas em ISO 8601 UTC (ex.:
`2026-10-15T00:03:58.229Z`). Números decimais vão como números JSON.

Autenticação: `Authorization: Bearer <token>`, com o token obtido em `POST /auth/login`. O token vale
8 horas e não é renovado automaticamente.

**Perfis:** `admin` (tudo, mais usuários e auditoria), `gestor` (operação; só lê a lista de usuários), `operador`
(registra lotes e vê os próprios) e `sensor` (só `GET /processos`, `POST /lotes` e `POST /telemetria`). Na tabela, "gestor" quer dizer
gestor ou admin.

## Erros

Todos os erros seguem o formato que o front já trata (`ErroApiDTO` em `src/services/tipos.ts`):

```json
{ "codigo": "VALIDACAO", "mensagem": "Verifique os campos destacados.", "campos": { "meta": "A meta deve ser maior que zero." } }
```

| HTTP | `codigo` | Quando |
|---|---|---|
| 400 | `REQUISICAO_INVALIDA` | JSON malformado ou tipo de parâmetro inválido |
| 400 | `TELEMETRIA_INVALIDA` | leitura de `POST /telemetria` com campo nulo, negativo ou fora da faixa (detalhes em `campos`) |
| 401 | `CREDENCIAIS_INVALIDAS` | login com usuário ou senha errados, ou usuário desativado |
| 401 | `NAO_AUTENTICADO` | sem token, token inválido ou expirado, ou usuário desativado depois do login |
| 403 | `ACESSO_NEGADO` | perfil sem permissão, ou tentativa de alterar a conta de outra pessoa |
| 404 | `NAO_ENCONTRADO` | recurso inexistente; o operador também recebe 404 para lote de outra pessoa |
| 405 | `METODO_NAO_PERMITIDO` | método HTTP que a rota não aceita |
| 409 | `USUARIO_DUPLICADO`, `PROCESSO_DUPLICADO`, `TRANSICAO_INVALIDA`, `OPERACAO_NAO_PERMITIDA`, `CHAVE_DE_ENVIO_REPETIDA`, `CONFLITO` | conflitos de regra ou de unicidade |
| 422 | `VALIDACAO` | campos inválidos (detalhes em `campos`) |
| 429 | `LIMITE_EXCEDIDO` | mais de 5 logins por minuto do mesmo IP, ou mais de 60 lotes por minuto do mesmo usuário; o cabeçalho `Retry-After` diz quantos segundos esperar |
| 503 | `BANCO_INDISPONIVEL` | sem conexão com o PostgreSQL |
| 500 | `ERRO_INTERNO` | erro inesperado (o detalhe fica só no log) |

## Endpoints

| Método e rota | Perfil | Entrada | Saída |
|---|---|---|---|
| `POST /auth/login` | público | `{usuario, senha}` | `200 {token, usuario: UsuarioDTO}` |
| `GET /auth/me` | autenticado | — | `UsuarioDTO` |
| `GET /usuarios` | gestor | — | `UsuarioDTO[]`; só o admin recebe o `usuario` (login) inteiro dos outros; para o gestor ele vem mascarado (ex.: `ca****in`), menos o próprio (LGPD, RNF27) |
| `POST /usuarios` | admin | `{nome, usuario, perfil, senha}` (`perfil`: `admin`, `gestor`, `operador` ou `sensor`) | `201 UsuarioDTO`; registra `CRIACAO_USUARIO` na auditoria |
| `PATCH /usuarios/{id}` | a própria pessoa | `{nome?, senha?, senhaAtual?}` (`senhaAtual` é obrigatória quando há `senha`) | `UsuarioDTO` |
| `PATCH /usuarios/{id}/senha` | admin (não em si mesmo nem no administrador principal) | `{senha}` (8 a 72 bytes) | `UsuarioDTO`; registra `REDEFINICAO_SENHA` na auditoria |
| `PATCH /usuarios/{id}/ativo` | admin (não em si mesmo nem no administrador principal) | `{ativo}` | `UsuarioDTO`; registra `DESATIVACAO_USUARIO` ou `REATIVACAO_USUARIO` na auditoria |
| `POST /usuarios/{id}/token/rotacao` | admin (só para contas de perfil `sensor`) | — | `{token, usuario: UsuarioDTO}`; `token` é a chave nova, com 64 caracteres alfanuméricos, mostrada só nesta resposta; a anterior é revogada na hora; registra `ROTACAO_TOKEN` na auditoria; conta de outro perfil → `409 OPERACAO_NAO_PERMITIDA` |
| `GET /processos` | autenticado, inclusive o sensor | — | `ProcessoDTO[]` (lista guardada em cache, atualizada a cada cadastro ou edição) |
| `POST /processos` | gestor | `{nome, unidade, meta}` | `201 ProcessoDTO` |
| `PUT /processos/{id}` | gestor | `{nome, unidade, meta}` | `ProcessoDTO` |
| `GET /lotes?processoId=&usuarioId=&inicio=&fim=` | gestor vê todos; operador, os próprios | filtros opcionais, combináveis (`inicio`/`fim` em ISO 8601 com fuso); `usuarioId` (quem registrou) vale para gestor e administrador, e para o operador é ignorado: ele continua vendo só os próprios (issue #107) | `LoteDTO[]`, do mais recente ao mais antigo |
| `GET /lotes/{id}` | mesma regra | — | `LoteDTO` |
| `POST /lotes` | autenticado, inclusive o sensor | `{processoId, pecas, litros}` (o usuário vem do token); cabeçalho opcional `Idempotency-Key: <UUID>` | `201 LoteDTO`; reenvio da mesma chave → `200` com o lote já gravado; mesma chave com outros dados ou de outro usuário → `409 CHAVE_DE_ENVIO_REPETIDA` |
| `POST /telemetria` | autenticado, inclusive o sensor | `{processoId, vazaoLitros}` (`processoId` ≥ 1; `vazaoLitros` de 0 a 10000, até 2 casas decimais) | `201 {id, processoId, vazaoLitros, data}`, a leitura gravada no nome de quem enviou (`data` é a hora do servidor); processo inexistente → `422` no campo `processoId`; campo nulo, negativo ou fora da faixa → `400 TELEMETRIA_INVALIDA` com o problema de cada campo em `campos` (issues #156 e #157, RF37) |
| `GET /alertas?status=` | gestor | `status` opcional: `aberto`, `analise` ou `resolvido` | `AlertaDTO[]` |
| `PATCH /alertas/{id}/status` | gestor | `{status}` | `AlertaDTO` |
| `GET /relatorios/resumo?mes=&ano=` | gestor | `mes` de 1 a 12; `ano` de 2000 a 2100 | `ResumoDTO[]` (só processos com lotes no mês) |
| `GET /relatorios/csv?inicio=&fim=&processoId=` | gestor | `inicio` e `fim` em `AAAA-MM-DD` (inclusivos, fuso America/Recife), no máximo 1 ano; `processoId` opcional | arquivo `text/csv` em streaming, no formato do CSV do Histórico (ver [Exportação em CSV](#exportação-em-csv-issue-99)); período invertido, maior que 1 ano ou processo inexistente → `422` |
| `GET /auditoria?inicio=&fim=&acao=&pagina=&tamanho=` | admin | todos opcionais: `inicio`/`fim` em ISO 8601 com fuso, `acao` (`CRIACAO_USUARIO`, `REDEFINICAO_SENHA`, `DESATIVACAO_USUARIO`, `REATIVACAO_USUARIO` ou `ROTACAO_TOKEN`), `pagina` a partir de 0, `tamanho` de 1 a 100 (padrão 20) | `{itens: [{id, acao, data, gestor, usuarioAfetado}], total, pagina, tamanho}`, do mais recente ao mais antigo; `gestor` e `usuarioAfetado` com `{id, nome, usuario}`, o `usuario` (login) mascarado (ex.: `ca****in`, LGPD, RNF27); sem senha nem hash |
| `GET /auditoria/seguranca` | admin | — | `{desde, loginsAceitos, loginsRecusados, bloqueiosLogin, bloqueiosLotes, senhasTrocadas, senhasRedefinidas, bloqueios: [{rota, ip, primeiro, ultimo, tentativas}]}`; contado em memória desde `desde` (o último início da API), zera quando ela reinicia; `rota` é `login` ou `lotes`; `ip` mascarado (ex.: `200.17.33.***`, LGPD); no máximo 100 linhas em `bloqueios`, do bloqueio mais recente ao mais antigo; sem senha (issue #109) |
| `GET /actuator/health` | público | — | `200 {status: "UP"}` ou `503 {status: "DOWN"}`; o admin vê também `components` (banco, disco) |
| `GET /actuator/health/sensor` | admin, gestor e operador | — | `200 {status: "UP", components: {sensorWokwi: {status, details}}}` se a última telemetria chegou há menos de 60 s; senão `503` com `DOWN` (ver [Monitoramento](#monitoramento-actuator)) |
| `GET /actuator/metrics` | admin | — | `{names: [...]}`, a lista de métricas |
| `GET /actuator/metrics/{nome}?tag=` | admin | `tag` opcional, `chave:valor` | `{name, measurements, availableTags}` |

### Monitoramento (Actuator)

Issue #51. O Spring Boot Actuator expõe só `health` e `metrics`. Os outros endpoints (`env`, `beans`, `heapdump`,
`loggers` etc.) mostrariam senhas e a memória da API: eles nem são ligados e, se fossem, a segurança responde `403`.

- **Saúde:** `GET /api/actuator/health` responde `UP` quando a API e o banco estão no ar e `503 DOWN` se o banco
  cair. É aberto para o Render e serviços de monitoramento (como o UptimeRobot) consultarem sem token. Sem token, só
  diz o status.
- **Saúde do sensor (issue #158, RNF20):** `GET /api/actuator/health/sensor` (admin, gestor e operador) traz o
  componente `sensorWokwi`. Ele fica `UP` se a última telemetria (`POST /telemetria`) chegou há menos de 60 s e `DOWN`
  (HTTP 503) se passou disso ou se o sensor nunca enviou nada. Os detalhes trazem `ultimaLeitura`,
  `segundosDesdeUltimaLeitura`, `limiteSemLeituraSegundos`, `motivo` (quando `DOWN`) e `linhasAtivas`: cada processo
  com leitura nas últimas 24 h, com a sua última leitura e o seu status. O limite muda com `SENSOR_LIMITE_SEM_LEITURA`.
  O sensor **não** entra no `/actuator/health` raiz (`SaudeDoSensorForaDaRaiz`): o Render e o healthcheck do Docker
  reiniciam a API quando a raiz dá 503, e um sensor parado não é motivo para isso.
- **Métricas (só admin):**

| Métrica | O que mostra |
|---|---|
| `http.server.requests?tag=uri:/lotes` | chamadas (`COUNT`), tempo total (`TOTAL_TIME`) e maior tempo (`MAX`) de uma rota; o tempo médio é `TOTAL_TIME / COUNT` |
| `http.server.requests?tag=status:500` | quantas respostas com erro |
| `jvm.memory.used?tag=area:heap` | memória em uso pela API, em bytes |
| `hikaricp.connections.active` | conexões com o banco em uso |
| `aguas.seguranca.login?tag=resultado:falha` | logins recusados desde o início da API (`resultado:sucesso` para os aceitos) |
| `aguas.seguranca.limite?tag=rota:login` | requisições bloqueadas pelo limite (429) no login (`rota:lotes` no registro de lotes) |
| `aguas.seguranca.senha?tag=tipo:redefinicao` | senhas redefinidas pelo administrador (`tipo:troca_propria` para as trocadas pela própria pessoa) |

```bash
curl https://aguas-api-a0vq.onrender.com/api/actuator/health
curl -H "Authorization: Bearer <token do admin>" \
  "https://aguas-api-a0vq.onrender.com/api/actuator/metrics/http.server.requests?tag=uri:/lotes"
```

**Memória:** medida num contêiner limitado a 512 MB, como no plano grátis do Render (05/11/2026). Sem o Actuator, a
API usava 287,7 MiB depois de 1.000 requisições; com ele, 291,5 MiB. A diferença fica dentro da variação entre uma
execução e outra.

### Exportação em CSV (issue #99)

`GET /relatorios/csv` devolve todos os lotes do período num arquivo CSV, para auditoria fiscal e ambiental (CPRH). O
formato é o mesmo do botão "Exportar CSV" do Histórico (RF29, `src/services/historicoCsv.ts`): UTF-8 com BOM,
separador `;`, quebra de linha CRLF, vírgula decimal sem separador de milhar, data e hora de Recife e também em UTC,
e as mesmas 12 colunas. Textos digitados (nome do processo e de quem registrou) começando com `=`, `+`, `-` ou `@`
ganham um apóstrofo na frente, para a planilha não executar como fórmula. De quem registrou, vai só o nome, sem login
(LGPD, RNF27).

- **Streaming:** o BOM e o cabeçalho saem antes da primeira consulta, então o download começa na hora. Os lotes são
  lidos de 1.000 em 1.000 e cada página é enviada assim que fica pronta; a memória da API não cresce com o tamanho
  do período.
- **Paginação por cursor:** cada página continua depois do último lote enviado (data e hora de registro, desempatada
  pelo id), em vez de `OFFSET`. Assim a página 50 custa o mesmo que a primeira, nenhum lote se repete ou fica de fora
  entre as páginas, e a consulta usa o índice `ix_lote_data`.
- **Medido no teste de integração** (`csvComMilharesDeLotesNaMesmaHoraNaoRepeteNemPulaNenhum`, PostgreSQL 18 no
  Docker, 13/11/2026): 50.000 lotes, todos no mesmo instante, saíram completos e em ordem; o arquivo inteiro
  (cerca de 6 MB) ficou pronto em 2,5 s.
- **Tempo limite:** respostas em streaming podem durar até 2 minutos (`spring.mvc.async.request-timeout`).

```bash
curl -H "Authorization: Bearer <token do gestor>" -o lotes-2026.csv   "https://aguas-api-a0vq.onrender.com/api/relatorios/csv?inicio=2026-01-01&fim=2026-12-31"
```

### Reenvio sem duplicar (`Idempotency-Key`)

O site gera um UUID para cada lote e o manda no cabeçalho `Idempotency-Key`. Se a Wi-Fi cair depois que a API
gravou, mas antes da resposta chegar, o site reenvia o mesmo lote com a mesma chave e recebe `200` com o lote
original: nada é gravado de novo e a regra de alerta não roda outra vez. A chave fica em `lote.chave_envio`
(migração `V5`, índice único). Sem o cabeçalho (o sensor ESP32), cada `POST` continua sendo um lote novo.


## Token de API do sensor

O sensor pode enviar lotes sem passar pelo login, com um token de API no mesmo cabeçalho do JWT:
`Authorization: Bearer <chave de 64 caracteres>`. A chave dá o acesso do perfil `sensor` (consultar processos e
registrar lotes) e não expira: vale até a próxima rotação ou até a conta ser desativada.

- **Rotação:** o administrador chama `POST /usuarios/{id}/token/rotacao`. A API sorteia uma chave nova (letras e
  números, 64 caracteres) e troca o hash guardado na mesma transação. A chave anterior deixa de valer na requisição
  seguinte (`401 NAO_AUTENTICADO`), porque a conta é procurada no banco pelo hash a cada chamada.
- **Guarda:** a chave aparece uma única vez, na resposta da rotação. O banco guarda só o SHA-256 dela
  (`usuario.token_hash`, migração `V9`); a auditoria e o log registram quem rotacionou, sem a chave.
- **Primeira chave:** a conta de sensor começa sem token; a primeira rotação cria o primeiro.

```bash
curl -X POST -H "Authorization: Bearer <token do admin>" \
  https://<api>/api/usuarios/<id do sensor>/token/rotacao
# {"token":"<64 caracteres>","usuario":{"id":7,"nome":"Sensor de vazão (Wokwi)","usuario":"sensor.wokwi","perfil":"sensor","ativo":true}}
```

## Tipos

```ts
UsuarioDTO  = { id, nome, usuario, perfil: 'gestor' | 'operador', ativo }
ProcessoDTO = { id, nome, unidade: 'lote' | 'peca', meta }
LoteDTO     = { id, processoId, pecas, litros, esperado, desvio, statusConformidade, data, usuarioId }  // desvio em %, 2 casas
              // statusConformidade: 'DENTRO_DA_META' (≤ 0%) | 'ATENCAO' (≤ 8%) | 'CRITICO' (> 8%)
AlertaDTO   = { id, processoId, loteIds: number[], detectado, status }
ResumoDTO   = { processoId, real, esperado, lotes, pecas, litrosPorPeca }   // litrosPorPeca = real ÷ pecas, 2 casas; null sem peças (#116)
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
