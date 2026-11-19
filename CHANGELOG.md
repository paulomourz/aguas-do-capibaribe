# Histórico de versões

Todas as mudanças relevantes do projeto ficam registradas aqui. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Disjuntor nos avisos do Telegram

- **Circuit breaker do Resilience4j** (`resilience4j-circuitbreaker` 2.3.0) nas chamadas à Bot API: o `Telegram`
  passou a executar o POST dentro de um disjuntor. Ele olha as últimas 10 chamadas e, a partir de 5 nessa conta,
  abre se mais de 50% tiverem falhado. É porcentagem na janela, não falhas seguidas: 6 em 10 abrem, 3 em 10 não.
- **Aberto, a chamada volta na hora:** antes, com o Telegram fora do ar, cada aviso gastava até 15 s de espera de
  rede (5 s para conectar + 10 s de resposta) e repetia isso 3 vezes, entupindo a fila de avisos. Agora a chamada é
  recusada localmente com `CallNotPermittedException`, sem abrir conexão, e o `AvisoDeAlerta` manda o aviso direto
  para a fila local (`aviso_pendente`), sem repetir e sem as pausas de 1 s e 2 s. Em `ultimo_erro` fica
  `DisjuntorAberto`.
- **Volta sozinho:** depois de 1 minuto aberto, uma única chamada testa se o Telegram voltou. Como o reenvio dos
  pendentes roda a cada 5 minutos, é ele que faz esse teste. Com o disjuntor aberto a rodada de reenvio para sem
  contar tentativa, já que nenhuma chamada chegou a sair.
- **Respostas 4xx não abrem o disjuntor** (fora 408 e 429): `401` (token errado) e `400` (grupo errado) são recusa da
  nossa requisição, e abrir o disjuntor esconderia o status HTTP que diz o que corrigir.
- **Configuração** em `app.telegram.disjuntor` (`janela`, `minimo-chamadas`, `limite-falhas`, `espera-aberto`).
  O estado sai no log a cada mudança e nas métricas `resilience4j.circuitbreaker.*` de `/api/actuator/metrics`
  (`resilience4j-micrometer`).
- **Testes** (`DisjuntorDoTelegramTest`, 11 testes): um Telegram de mentira num `HttpServer` local conta as
  requisições que chegam de verdade, mostrando que o disjuntor aberto não toca na rede e que a chamada recusada volta
  em menos de 1 s mesmo com o servidor demorando 2 s para responder. Mais um teste em `AvisoDeAlertaTest` (vai direto
  para os pendentes, sem pausa) e outro em `ReenvioDeAvisosTest` (a rodada para sem contar tentativa).
- Documentação em `docs/tecnico/telegram.md` (seção "Disjuntor" e três linhas novas na tabela de log).

### Saúde do sensor Wokwi no Actuator

- **`GET /actuator/health/sensor`** (issue #158, RNF03): o `SensorWokwiHealthIndicator` (componente `sensorWokwi`)
  consulta a última telemetria gravada. `UP` se ela chegou há menos de 60 s, com a hora da leitura; `DOWN` (503) se
  passou disso ou se nunca houve leitura, com os segundos decorridos. Os detalhes listam cada linha de lavagem ativa
  (processo com leitura nas últimas 24 h) com a sua última leitura e o seu status. Para admin, gestor e operador; o
  limite muda com `SENSOR_LIMITE_SEM_LEITURA` (padrão `60s`). Erro no banco deixa o sensor `DOWN`, sem quebrar o endpoint.
- **A raiz `/actuator/health` não depende do sensor:** o `SaudeDoSensorForaDaRaiz` tira o `sensorWokwi` do grupo
  principal. O Render e o healthcheck do Docker reiniciam a API quando a raiz dá 503, e um sensor parado não pode
  causar isso.
- **Testes:** `SensorWokwiHealthIndicatorTest` (relógio fixo: 10 s, 59 s, exatamente 60 s, 185 s, sem leitura, linhas
  com status diferentes, janela de 24 h, banco fora do ar, limite configurável), `SaudeDoSensorForaDaRaizTest` e, na
  integração com PostgreSQL, `saudeDoSensorWokwiPelaUltimaTelemetriaSemAfetarARaiz` (401, 403, UP com a hora gravada e
  a raiz sem o componente).

### Telemetria gravada e testes da camada web

- **`POST /telemetria` grava a leitura e responde `201`** (issue #157). Nova tabela `telemetria` (migração V14:
  processo, usuário, vazão e hora do servidor; só recebe INSERT, com índices pela data e por processo e autovacuum
  mais frequente), entidade imutável `Telemetria` e `TelemetriaService`. A leitura fica no nome de quem enviou (o
  sensor, pelo token); processo inexistente → `422` no campo `processoId`, como em `POST /lotes`. O `aguas_api` só lê
  e insere (`database/seguranca-usuario-api.sql`).
- **Testes:** `TelemetriaControllerTest` virou slice `@WebMvcTest` com o `TelemetriaService` simulado (`@MockitoBean`)
  e sem banco: 201 (token de API do sensor e JWT), 400 (cada regra de validação; o serviço nunca é chamado) e 401
  (sem cabeçalho, token de sensor desconhecido, conta desativada, JWT inválido). Na integração com PostgreSQL,
  `sensorRegistraTelemetriaQueFicaGravadaNoNomeDeleENaoPodeSerAlterada` confere a linha gravada e as restrições da V14.

### Validação da telemetria do sensor

- **`POST /telemetria` recusa leitura inválida com 400** (issue #156, RNF04, ERS 4.1). O `TelemetriaRequestDTO` usa Bean
  Validation: `processoId` obrigatório e maior que zero; `vazaoLitros` obrigatória, sem valor negativo, até 10000 e com
  no máximo 2 casas decimais. O `@Valid` no controller barra a leitura antes da regra de negócio, e o
  `TelemetriaExceptionHandler` devolve `400 TELEMETRIA_INVALIDA` com a mensagem em português de cada campo em `campos`.
  As outras rotas continuam com o `422 VALIDACAO` de sempre. O perfil `sensor` pode chamar a rota.
- **Testes:** `TelemetriaControllerTest` (vazão nula, ausente, negativa, acima do máximo, processo inválido e leitura válida).

### Limpeza apontada pelo SonarQube (back-end)

- **6 code smells críticos e bloqueantes:** o BOM do CSV virou `\uFEFF` escrito por extenso (S2479); os métodos que tinham
  o mesmo nome de uma constante passaram a `CsvDeLotes.linhaDeCabecalho()` e `OpenApiConfig.respostaDeErro()` (S1845);
  os perfis repetidos no `SecurityConfig` e a mensagem "Usuário não encontrado." no `UsuarioService` viraram
  constantes (S1192). Sem mudança de comportamento: o CSV, a documentação da API e as permissões continuam iguais.

### Envio da fila offline em segundo plano (Background Sync)

- **O service worker envia os lotes guardados sozinho** quando a conexão volta, mesmo com a aba fechada ou em
  segundo plano (issue #160, RNF12). Quando sobra lote sem conexão, o site registra a tag `sync-lotes` na Background
  Sync API; no evento `sync`, o service worker lê a fila do IndexedDB e envia pela mesma regra da página: na ordem do
  registro, com a mesma `Idempotency-Key` (não duplica) e com a mesma trava entre abas. Sem conexão de novo, o
  navegador repete o `sync` mais tarde.
- **Selo "Sincronizado"** no cabeçalho por 5 segundos quando a fila chega ao servidor, pela página ou pelo service
  worker. As abas abertas recebem o aviso do service worker por BroadcastChannel e mostram os lotes enviados.
- **Token só enquanto houver lote esperando.** O service worker não lê o `sessionStorage`, então o token vai para o
  IndexedDB (banco `aguas-offline` versão 2, store `credencial`) só nos navegadores com Background Sync (Chrome, Edge
  e Android). Ele sai quando a fila esvazia, ao sair, no 401 e quando o token expira. No Firefox e no Safari nada
  muda: a página continua enviando a fila quando está aberta.
- **Service worker próprio** (`src/sw.ts`, estratégia `injectManifest` do vite-plugin-pwa), com o mesmo cache de
  antes: casca do site para abrir sem conexão, API sempre pela rede.
- **Testes:** `src/services/__testes__/envioSegundoPlano.test.ts` (envio pelo service worker, token, avisos),
  `src/services/__testes__/sw.test.ts`, `src/components/__testes__/seloSincronizado.test.ts` e
  `e2e/backgroundSync.spec.ts`, que fecha a aba, devolve a rede e dispara o `sync` pelo DevTools Protocol.

### Correções apontadas pelo SonarQube

- **Os 2 bugs da primeira análise:** em `AvisoDeAlerta`, a pausa entre as tentativas do Telegram calcula o expoente já
  em `double` (regra S2184); em `Limitador`, o último uso de cada chave passou de `long[]` para `AtomicLong`, o que
  tira o array do `record` (regra S6218) e deixa a atualização segura com várias requisições ao mesmo tempo. Testes do
  limite, do aviso e do reenvio passando.

### Relatório em planilha Excel (.xlsx)

- **Botão "Exportar para Excel (.xlsx)"** na tela de Relatórios (issue #159, RF18), ao lado do PDF. Baixa
  `aguas-do-capibaribe-relatorio-AAAA-MM.xlsx` do período escolhido, gerado no navegador com o ExcelJS 4.4.0, que só
  é carregado no primeiro clique (pedaço separado do site, 260 KB comprimido).
- **Aba "Lotes"**: um lote por linha, em ordem cronológica (código, data e hora de Recife, processo, peças, meta,
  consumo real, diferença, desvio, status e água por peça), com a linha de total. **Aba "Resumo por processo"**: os
  totais de cada tipo de processo. As duas têm o cabeçalho da empresa (lavanderia, período, emissão e responsável),
  filtro e cabeçalho congelado.
- **Fórmulas de verdade** na planilha: soma do volume, das peças e das metas, diferença, desvio e pegada hídrica
  (litros por peça), com o resultado já guardado para quem abre sem recalcular.
- **Desvio colorido pelas faixas de status** do sistema (formatação condicional): verde até 0%, âmbar até 8% e
  vermelho acima. O status de cada lote usa as cores do site.
- **Dependências:** a `xlsx` (SheetJS) do npm foi descartada por ter vulnerabilidades altas sem correção, que o job
  `dependencias` bloqueia. O `uuid` usado pelo ExcelJS foi forçado para a 11.1.1 (override do pnpm), que corrige o
  GHSA-w5hq-g745-h8pq; o `pnpm audit` fica sem nenhum aviso.
- **Testes:** `src/services/__testes__/exportToExcel.test.ts` gera o arquivo e lê de volta célula por célula;
  `src/screens/__testes__/relatorios.test.ts` confere quando o botão fica habilitado; `e2e/planilha.spec.ts` clica
  no botão, baixa e abre o .xlsx.

### Repositório público

- **O repositório passou a ser público em 17/11/2026.** Privado, o plano grátis do GitHub dá 2.000 minutos por mês ao
  GitHub Actions, e eles acabaram com o CI ampliado (SBOM, Sonar, mutação e carga): todo job falhava em 2 segundos
  com aviso de cobrança, inclusive nos merges da `develop`. Público, os minutos são ilimitados. Antes da abertura, o
  histórico inteiro foi varrido atrás de tokens, chaves e senhas (só havia textos de exemplo); os segredos continuam
  só no GitHub, no Render e no Docker. Registrado no risco R01 de `docs/gestao/seguranca.md` (v1.3) e no TAP (v3.3).

### Carregamento sem saltos (skeleton screens)

- **Esqueletos no formato do conteúdo** (issue #161): `SkeletonCard` (indicadores) e `SkeletonChart` (colunas de
  água Meta x real, barras Real x esperado e linhas por dia) repetem a tipografia, os espaçamentos e a altura do
  componente real. O rótulo de cada indicador já aparece de verdade e os textos de legenda e rodapé ficam
  transparentes sobre o esqueleto, então quebram linha igual ao conteúdo carregado. A lista de alertas ativos do
  dashboard também ganhou esqueleto no formato de cada item.
- **Relatórios:** a seção de gráficos aparecia só depois dos dados e empurrava a tabela para baixo (CLS de 0,29
  no celular com 3G simulado). Agora ela ocupa o seu lugar desde o carregamento, com os esqueletos.
- **Teste de ponta a ponta** (`e2e/carregamento.spec.ts`): com rede 3G simulada e a API atrasada, confere os
  esqueletos no dashboard e nos relatórios e exige CLS < 0,1, no computador e no celular. Antes → depois:
  dashboard 0,065 → 0,026 (computador) e 0,075 → 0,004 (celular); relatórios 0,132 → 0,003 (computador) e
  0,288 → 0 (celular).
- **Testes de unidade** (`src/components/__testes__/esqueletos.test.ts` e `src/screens/__testes__/carregamento.test.ts`,
  26 testes): renderizam os esqueletos e as telas em HTML com o `react-dom/server`, sem dependência nova, e conferem
  o que o leitor de tela anuncia, os textos fantasmas e a troca pelos dados. Cobrem 96,6% das linhas e todas as
  condições do código novo, acima dos 80% do Quality Gate.
- Com movimento reduzido, os esqueletos ficam parados, como os outros efeitos do site.

### Qualidade (Quality Gate com SonarQube)

- **Cobertura de testes medida** (issue #168): JaCoCo 0.8.16 no `mvn test` (`backend/target/site/jacoco`) e
  `pnpm test:cobertura` no site (`coverage/lcov.info`, `@vitest/coverage-v8`). Em 17/11/2026: API com 93,7% das
  linhas e 80,3% das decisões cobertas; site com 13,8% nos testes de unidade (as telas são cobertas pelos testes de
  ponta a ponta, que não entram nessa conta).
- **Workflow "Qualidade"** com o SonarQube da disciplina (`https://sonar.fchicout.dev`, `sonar-project.properties`):
  analisa a API e o site com a cobertura e espera o Quality Gate `SENAC-PI-Quality-Gate`; se ele reprovar, o PR fica
  bloqueado. No código novo: nenhum problema bloqueante ou crítico, notas A em manutenção, confiabilidade e
  segurança, cobertura de pelo menos 80% e duplicação abaixo de 3%. Precisa do segredo `SONAR_TOKEN`; sem ele, o job
  só avisa.

### Acessibilidade (axe-core no CI)

- **Auditoria automática WCAG 2.1 A e AA** (issue #172, `e2e/acessibilidade.spec.ts`, `@axe-core/playwright` 4.14.0).
  Roda nos testes de ponta a ponta, nos temas claro e escuro, nas telas de acesso, aviso de privacidade, registro de
  lote, resultado com o gauge, histórico, dashboard e relatórios. Violação séria ou crítica falha o job
  `frontend-build`; o relatório de cada tela fica no artefato `acessibilidade`. A API falsa dos testes ganhou o
  perfil de gestor, com resumo, alertas e usuários.
- **Correção achada na primeira execução:** o link do logo no cabeçalho tinha um nome para leitor de tela diferente
  do texto visível (WCAG 2.5.3, `label-content-name-mismatch`). Agora o nome começa pelo texto que aparece na tela.
- O teste espera as animações de entrada terminarem antes de medir, para o contraste ser o das cores finais.

### Continuidade (runbook de recuperação de desastres)

- **Runbook** em `docs/tecnico/runbook-disaster-recovery.md` (issue #170): árvore de decisão, matriz de escalonamento
  e procedimentos para API ou site fora no Render, banco do Neon apagado ou com dados errados (restauração por ponto
  no tempo ou pelo último backup), plano B no Docker e troca de cada senha e token vazado. Metas RTO < 10 min e
  RPO < 1 min, com a situação de cada uma por ambiente.
- **Ensaio no Docker em 17/11/2026:** backup, banco apagado, restauração e sistema de pé em **23 segundos**, com os
  20 lotes de volta.
- **`database/seguranca-usuario-api.sql` pode rodar de novo:** se o `aguas_api` já existir (banco novo do Docker
  depois de um restore), ele só confirma as restrições e a senha, em vez de falhar no `CREATE ROLE`.

### Segurança da cadeia de suprimentos (SBOM)

- **SBOM CycloneDX 1.6 da API e do site** (issue #169). O `cyclonedx-maven-plugin` 2.9.3 gera `backend/target/bom.json`
  e `bom.xml` no `mvn package`, só com as dependências que vão para a imagem: 99 componentes, todos com hash e
  licença. O workflow novo "SBOM" gera também o do site (`cdxgen`, só dependências de produção), confere os dois,
  mostra o resumo no CI, guarda como artefato por 90 dias e, quando uma release é publicada, anexa `bom-api.json`,
  `bom-api.xml` e `bom-site.json` a ela. Só o job da release tem permissão de escrita.

### Docker com privilégios mínimos

- **Contêineres sem root** (issue #171). O site passa para `nginxinc/nginx-unprivileged:1.30-alpine` (uid 101, porta
  8080 dentro do contêiner; continua em `localhost:3000`), e o banco roda direto como `postgres` (uid 70), sem passar
  pelo root. A API já rodava como `nonroot`.
- **Privilégios mínimos em todos os serviços:** `cap_drop: [ALL]`, `no-new-privileges` e sistema de arquivos só de
  leitura, com `tmpfs` só onde precisa escrever. O serviço `segredos`, que cria os arquivos nos volumes novos, é o
  único que roda como root, sem nenhuma capability, e termina em seguida.
- **CI:** o job `docker-compose` confere, pelo host, que nenhum processo do banco, da API e do site roda como root e
  que as três opções estão ativas, com uma tabela no resumo. Testado localmente: subida, login, cabeçalhos do site e
  nova subida com os mesmos volumes.

### Documentação (validação e auditoria)

- **ERS v2.5:** RNF25 passa a parcial. A validação foi feita por avaliação simulada (PR #140) e com pessoas de fora da
  equipe, sem dificuldades relevantes; o teste com operador real de lavanderia fica como limitação (issue #50
  encerrada). Testes e README com a mesma situação.
- **Auditoria v1.1:** equipe em ordem alfabética, achado A13 (revisão de segurança, PR #153) e cronograma novo:
  17 a 19/11 últimas entregas, issues novas e feedbacks do professor; 20 e 21/11 revisão final e correções; 22/11
  congelar, limpeza do banco e ensaio; 23/11 prazo final, com o formato a confirmar com o professor. PDFs gerados de novo.

### Segurança (revisão de 14/11/2026)

- **Cabeçalhos de segurança no site do Docker** (`docker/cabecalhos-seguranca.conf`): Content-Security-Policy (só
  scripts do próprio site; estilos e fontes também do Google Fonts), `frame-ancestors 'none'` e `X-Frame-Options:
  DENY` contra clickjacking, `Referrer-Policy`, `Permissions-Policy` e `nosniff`, também no `sw.js` e no manifesto.
  O Nginx não mostra mais a versão. O job `docker-compose` do CI confere os cabeçalhos. No Render, os mesmos
  cabeçalhos vão nas configurações do site estático. Testado no Chrome com o site gerado: nenhuma violação, fontes e
  service worker carregando.
- **Limite de login por conta** (`LIMITE_LOGIN_POR_CONTA_POR_MINUTO`, padrão 10): soma as tentativas de cada conta
  vindas de qualquer IP, contra a tentativa de senhas espalhada por muitos IPs. Responde o mesmo 429 com
  `Retry-After`, então o contador do site continua funcionando.
- **Limitador sem zerar a memória:** com 10.000 chaves em uso no mesmo minuto, as novas dividem um balde só, em vez de
  apagar todos os limites. Antes, muitos IPs diferentes zeravam o limite de todo mundo, inclusive o de quem já estava
  bloqueado.
- **Testes:** `mesmaContaTentadaDeMuitosIpsRecebe429` e `memoriaCheiaNaoZeraOLimiteDeQuemJaEstaBloqueado`.

## [1.1.0] - 2026-11-14

Versão com as entregas dos pareceres das Weeks 01 e 02: perfis e auditoria, modo offline, avisos no Telegram com
reenvio, token de API do sensor, pegada hídrica, gauge, LGPD, segurança do contêiner e do CI, e documentação nas
normas ISO/IEC.

### Documentação da versão 1.1.0

- **Auditoria nas normas e cronograma** (`docs/gestao/auditoria.md` e PDF): resultado por norma, 12 achados com o
  ajuste e a evidência, participação por integrante e cronograma até 23/11/2026, para a aula de 16/11.
- **ERS v2.4, TAP v3.2, guia 2.2, arquitetura 1.2, testes 1.1 e segurança 1.2**, com as entregas de 10 a 14/11/2026:
  RF35 (token de API do sensor), reenvio dos avisos (RF30), gauge (RF24), buffer do sensor (RF26), contador do 429
  (RNF19), contraste WCAG AA (RNF13), carga com 100 sensores (RNF17), CI com vulnerabilidades e mutação (RNF24),
  RNF28 (imagem distroless e segredos como arquivos), migrações V9 a V11 e números de testes atuais (169 no back-end,
  199 de unidade e 10 de ponta a ponta no site). README, banco e guia com "React com TypeScript". PDFs gerados de novo.

### Relatórios (pegada hídrica)

- **Pegada hídrica por peça** (issue #116, RF34). O resumo mensal da API (`GET /relatorios/resumo`) passa a trazer
  `pecas` e `litrosPorPeca` (litros ÷ peças, 2 casas; null sem peças). O Dashboard ganha o indicador **Água por
  peça**, com a média do mês e a referência de 49 a 70 L por peça da lavanderia completa, e a coluna **L/peça** aparece
  no resumo do Dashboard, no Relatório, na pré-visualização e no PDF. Testes: `PegadaHidricaTest`, integração do
  resumo mensal e `pegada.test.ts`.

### Relatórios (exportação em CSV pela API)

- **`GET /api/relatorios/csv?inicio=&fim=&processoId=`** (issue #99, RF33), só gestor: todos os lotes de um período
  de até 1 ano, no mesmo formato do CSV do Histórico (UTF-8 com BOM, `;`, vírgula decimal, hora de Recife e UTC,
  textos protegidos contra fórmula, só o nome de quem registrou). Período invertido, maior que 1 ano ou processo
  inexistente → 422 antes de o arquivo começar.
  - **Streaming:** cabeçalho enviado na hora e lotes lidos de 1.000 em 1.000 por paginação por cursor
    (`registrado_em`, `id`), com flush a cada página; a memória não cresce com o período. 50.000 lotes em 2,5 s no
    teste de integração.
  - **Segurança:** os cabeçalhos de segurança do Spring Security passam a ser escritos no início da requisição, e não
    quando a resposta é confirmada; com o streaming, a confirmação acontece em outra thread e os dois disputavam os
    cabeçalhos (`ConcurrentModificationException`). As respostas continuam com os mesmos cabeçalhos.
  - Respostas em streaming podem durar até 2 minutos (`spring.mvc.async.request-timeout`).

### Testes e IoT (complementos)

- **Prints do teste de ponta a ponta no CI:** o job `frontend-build` guarda os prints de cada passo do fluxo do
  operador (`e2e/fluxo-operador.spec.ts`, issue #104) no artefato `screenshots-e2e`, por 14 dias.
- **Guia do buffer sem Wi-Fi** (issue #108) no `iot/LEIA-ME.md`: como o sensor guarda até 100 leituras, como evita
  duplicar no reenvio e como simular a queda com o comando Q no monitor serial.

### Avisos (reenvio)

- **Reenvio dos avisos pendentes do Telegram** (issue #97, RNF03). Uma rotina agendada (`ReenvioDeAvisos`, a cada
  5 minutos) tenta de novo os avisos gravados em `aviso_pendente`, uma vez por rodada, só de alertas ainda abertos.
  A mensagem começa com "Aviso atrasado". Quando chega, a coluna nova `enviado_em` recebe a hora e o aviso não sai de
  novo; se falhar, a tentativa e o erro são registrados e a rodada para. Depois de 24 horas pendente, a rotina desiste
  (a última tentativa que falhar fica no log). Intervalo e limite em `app.telegram.reenvio-a-cada` e
  `app.telegram.reenvio-limite`.
  - **Espera crescente** nas 3 tentativas imediatas: a pausa dobra a cada vez, 1 s antes da 2ª e 2 s antes da 3ª
    (`app.telegram.espera-entre-tentativas` passou a ser a primeira pausa, com padrão de 1 s em vez de 2 s fixos).
  - **Banco:** migração `V11` com `enviado_em`, um índice parcial dos não enviados e `GRANT UPDATE (enviado_em,
    tentativas, ultimo_erro)` para o `aguas_api`, que continua sem DELETE. `database/seguranca-usuario-api.sql`
    atualizado.
  - **Testes:** `ReenvioDeAvisosTest` e, na integração, Telegram fora do ar → pendente → Telegram volta → a rotina
    envia uma vez só e marca `enviado_em`; aviso vencido e alerta em análise não são reenviados.
  - **Documentação:** `docs/tecnico/telegram.md`, com a tabela de mensagens do log atualizada.

### Interface (gauge de tolerância)

- **Gauge de tolerância hídrica no resultado do lote** (issue #98, US04). O cartão de resultado mostra, ao lado do
  desvio, um semicírculo com as faixas oficiais (dentro da meta até 0%, atenção até 8%, crítico acima de 8%), lidas da
  mesma configuração de `statusDe` (`FAIXAS_DE_STATUS`, agora exportada). Os números dos limites não aparecem na tela.
  - O desvio e o status vêm da API; o ponteiro gira com transição suave quando o lote muda no estado global, e a faixa
    crítica pulsa quando ativa. As duas animações ficam desligadas com `prefers-reduced-motion`.
  - Cor nunca sozinha (RNF13): o selo com ícone e o texto do desvio ficam ao lado; no cartão o gauge é decorativo
    para o leitor de tela, para não repetir a informação.
  - **Testes:** `src/domain/__testes__/gauge.test.ts` (ângulo do ponteiro e arcos alinhados com `statusDe`).

### Correções

- **Números com ponto de milhar** (issue #139, achada na avaliação simulada da #50). No registro de lote, digitar
  `1.590` litros gravava **2 L**, e na tela de processos uma meta de `1.500` virava 1,5. A nova `lerNumeroBR`
  (`src/domain/formatacao.ts`) lê o padrão brasileiro: `1.590` = 1590, `1.590,5` e `12,5` como decimais. Um ponto
  ambíguo, como `1.59`, é recusado com mensagem, em vez de gravar um valor errado.
  - **Campos:** peças, litros e meta deixaram de ser `type="number"`, então as setas não cobrem mais os dígitos.
  - **Celular:** peças e litros ficam em uma coluna, para o número aparecer inteiro.
  - **Testes:** `numeroBR.test.ts` e `e2e/numeros.spec.ts`.

### Interface (limite de requisições)

- **Erro 429 com contagem regressiva** (issue #101, RNF19). Quando a API responde 429 (`LIMITE_EXCEDIDO`), o
  `src/services/http.ts` lê o cabeçalho `Retry-After`, guarda o prazo da ação (login ou envio de lotes, em
  `src/services/limite.ts`) e não dispara a mesma ação de novo até ele acabar. Se o cabeçalho não vier, espera 60 s.
  - **Login** (5 tentativas por minuto por IP): o botão **Entrar** fica desabilitado, mostrando "Aguarde N segundos",
    com uma faixa de aviso.
  - **Registro de lotes** (60 por minuto por usuário): **Registrar lote** e **Enviar agora** ficam desabilitados
    durante a contagem.
  - **Fila offline:** o lote que recebeu 429 continua na fila, sem aparecer como "sem conexão", e é enviado sozinho
    quando a espera acaba, com a mesma `Idempotency-Key`.
  - **Backend:** o CORS passou a expor o `Retry-After` (`setExposedHeaders`). Sem isso, o site em outra origem lia
    `null`.
  - **Testes:** `limite.test.ts`, novos casos em `sincronizacao.test.ts`, `e2e/limite.spec.ts` e
    `LimiteDeRequisicoesTest`.

### Acessibilidade

- **Contraste WCAG 2.1 AA medido nos dois temas** (issue #106, continuação da #82). Novo teste
  `src/services/__testes__/contraste.test.ts` lê as cores do `src/index.css` e confere 4,5:1 para texto e 3:1 para
  barras, linhas dos gráficos e bordas de campo, no tema claro e no escuro. A barra "esperado pela meta" do gráfico meta
  x real no tema claro estava em 1,52:1 sobre o cartão branco e passou para 3,57:1 (`--color-meta: #5b8db0`).

### IoT (token)

- **Sensor do Wokwi com token de API** (issue #129, continuação da #103). O `iot/sketch.ino` não faz mais login com
  senha: manda o token da conta `sensor.wokwi` (`TOKEN_API`, gerado em **Usuários > Rotacionar token**) direto em
  `GET /processos` e `POST /lotes`. Se o token for trocado, o monitor serial avisa como gerar outro. Guias do IoT,
  roteiro de apresentação, guia do sistema e segurança atualizados.

### Avisos

- **Novas tentativas e aviso pendente no Telegram.** Quando o envio do aviso de alerta falha (erro de rede, Telegram
  fora do ar ou recusando), a API tenta de novo, até 3 envios no total, com 2 segundos de pausa. Se a falha
  persistir, o aviso fica gravado como pendente na tabela `aviso_pendente` (migração `V10`), com o número de
  tentativas e o último erro, sem o token. O registro do lote continua sem esperar o Telegram.

### Testes

- **Teste de mutação com PIT.** `mvn org.pitest:pitest-maven:mutationCoverage` (depois de `mvn test-compile`) muda o
  código das regras de negócio, da segurança e dos avisos e roda todos os testes, inclusive os de integração. O
  build falha se menos de 81% dos mutantes morrerem, ou seja, se a sobrevivência não ficar abaixo de 20%. O workflow
  "Teste de mutação" roda sob demanda e em PRs que mudem o backend, mostra a sobrevivência e os mutantes vivos no
  resumo e guarda o relatório HTML.

### Arquitetura

- **Diagramas C4** (issue #111): contexto, contêineres e componentes da API em Mermaid e SVG
  (`docs/tecnico/diagramas/`), com a segurança (JWT e limite de requisições por token bucket), os avisos assíncronos
  no Telegram e o sensor IoT. A descrição da arquitetura (ISO/IEC/IEEE 42010) foi para a versão 1.1, com a imagem
  distroless, os segredos como arquivos e o pool de 20 conexões.

### Desempenho

- **Teste de carga com 100 sensores e pool do banco** (issue #113). O teste ganhou a etapa de 100 sensores e lê no
  Actuator a espera por conexão do HikariCP. Roda também no GitHub Actions (workflow "Teste de carga", sob demanda
  e em PRs que mudem o teste), comparando pool 10 e 20. Com 100 sensores e 20 conexões, o p95 caiu 31% (377 para
  262 ms) e a vazão subiu 15%, sem falhas; o padrão da API passou de 10 para 20 conexões.

### Segurança

- **Rotação do token de API do sensor.** `POST /api/usuarios/{id}/token/rotacao`, só para o administrador e só em
  contas de perfil `sensor`, gera uma chave de 64 caracteres alfanuméricos e revoga a anterior na hora. O sensor a
  envia em `Authorization: Bearer <chave>`, sem login. A chave aparece só na resposta; o banco guarda o SHA-256 dela
  (migração `V9`, coluna `usuario.token_hash`) e a auditoria registra `ROTACAO_TOKEN`. O login com usuário e senha
  do sensor continua funcionando.
- **Botão "Rotacionar token" na tela Usuários.** Aparece nas contas de perfil sensor, para o administrador. Pede
  confirmação (a chave atual para de valer na hora) e mostra a chave nova uma única vez, com botão de copiar. A chave
  não fica guardada no navegador.
- **Privacidade e LGPD** (issue #117, RNF27). A tela de login ganhou o link **Aviso de privacidade**
  (`/#/privacidade`, aberto sem entrar e também no rodapé), que diz quais dados pessoais o sistema guarda, para quê,
  por quanto tempo, quem vê e com quem falar. O login de outras pessoas passou a sair mascarado da API (ex.:
  `ca****in`), com o nome inteiro: na auditoria e na lista de usuários pedida pelo gestor. Só o administrador, na
  tela Usuários, e a própria pessoa veem o login inteiro. O CSV e o PDF foram conferidos: levam só o nome. Aviso e
  conferência na seção 6 de `docs/gestao/seguranca.md` (v1.1); ERS v2.1.
- **Imagem distroless da API** (issue #105). O contêiner da API (Docker e Render) passa a usar
  `gcr.io/distroless/java25-debian13:nonroot`, presa por digest: só o Java 25 e o jar, sem shell, sem gerenciador de
  pacotes e sem root. O healthcheck do Docker virou uma classe Java (`backend/docker/Saude.java`) que chama
  `/api/actuator/health`. O CI mostra o tamanho da imagem e falha se ela tiver shell.
- **Segredos do Docker como arquivos** (issue #118). No Docker Compose, a API lê as senhas e a chave JWT como
  arquivos só de leitura em `/run/secrets/aguas` (configtree do Spring Boot, no padrão do Docker Secrets), num
  volume que só ela monta. Nenhuma senha aparece mais nas variáveis de ambiente do contêiner nem do processo, e o
  job `docker-compose` do CI confere isso. Sem a pasta (Render, PC), as variáveis de ambiente continuam valendo.
- **Vulnerabilidades das dependências no CI** (issue #112). O job novo `dependencias` roda o OSV-Scanner
  (versão fixa, com checksum) no `backend/pom.xml` e no `pnpm-lock.yaml` e bloqueia o merge com vulnerabilidade alta
  ou crítica (CVSS 7,0 ou mais), mostrando a tabela no resumo do CI. Na primeira execução, encontrou 16; foram
  corrigidas com Tomcat 10.1.61, driver PostgreSQL 42.7.14, Jackson 2.21.8, Vite 8.3 e source-map-js 1.2.2. Duas do
  Spring Framework 6.2 sem correção nessa linha (SSE com fragmentos de view e XsltView, recursos que a API não usa)
  ficaram como exceção em `osv-scanner.toml`, com motivo e revisão em 31/12/2026.

### Documentação nas normas ISO/IEC

- **ERS v2.0 na ISO/IEC/IEEE 29148**, que substitui a IEEE 830: estrutura nova, necessidades de negócio e dos
  stakeholders, conceito de operação, método de verificação em cada requisito, seção de verificação, conformidade com
  normas e matriz de rastreabilidade com a verificação.
- **Documentos novos:** arquitetura (`docs/tecnico/arquitetura.md`, ISO/IEC/IEEE 42010), testes
  (`docs/tecnico/testes.md`, ISO/IEC/IEEE 29119), segurança da informação (`docs/gestao/seguranca.md`, ISO/IEC
  27001) e ciclo de vida (`docs/gestao/ciclo-de-vida.md`, ISO/IEC 12207).
- **Guia 2.1 (ISO/IEC/IEEE 26514)** com a seção "Sobre este guia" (público, convenções e como usar), glossário,
  aviso de lote crítico e testes atuais; **TAP v3.1** com a tabela das normas.

### IoT

- **Aviso de lote crítico no sensor do Wokwi, com som e luz.** Quando a API classifica o lote enviado como
  crítico (desvio acima de 8%), o buzzer (pino 26) apita 3 vezes e o LED vermelho (pino 33) pisca e fica aceso
  até o próximo lote começar. O sensor lê o `statusConformidade` da resposta do `POST /lotes`, então segue a mesma
  regra do site. O monitor serial passa a mostrar o status e o desvio de todo lote enviado. Circuito e guia
  atualizados em `iot/`.

### Interface

- **Glossário têxtil e nomes padronizados dos processos** (issue #55, item #27 do parecer). Dica acessível por
  teclado ao lado do processo em **Processos e metas** e no **Registro de lote**, com o que a etapa faz e por que
  gasta água. O cadastro de processo sugere o nome padrão (Estonagem, Amaciamento, Alvejamento, Tingimento) quando
  alguém digita um sinônimo como "stone wash" ou "branqueamento". Termos e fontes em
  `docs/tecnico/glossario-textil.md`.

### Documentação

- **TAP v3.0 e ERS v1.2** em `docs/gestao/`, em Markdown com PDF gerado: escopo, perfis, histórias US-10 a US-15,
  requisitos RF27 a RF31 e RNF19 a RNF26, riscos e pendências a confirmar com o orientador.
- **Guia 2.0** e READMEs atualizados com perfis, auditoria, modo offline, exportação em CSV, aviso no Telegram,
  monitoramento, backup, testes e o fluxo de pull request para a `develop`.

### Avisos

- **Aviso no Telegram quando um alerta é aberto** (issue #52, item #24 do parecer). A mensagem traz o processo, os
  3 lotes e o número do alerta, e o link dele quando `SITE_URL` está definido. O envio acontece depois que o lote foi
  gravado e em outra thread: o registro não espera o Telegram, e uma falha no envio só fica no log, sem o token. Usa
  HTTPS (porta 443), porque o plano grátis do Render bloqueia as portas de e-mail. Desligado sem `TELEGRAM_TOKEN` e
  `TELEGRAM_CHAT_ID`, que ficam só nas variáveis de ambiente.

### Monitoramento

- **Saúde e métricas da API com Spring Boot Actuator** (issue #51, item #23 do parecer). `GET /api/actuator/health`
  é aberto e, sem token, só diz `UP` ou `DOWN`; o admin vê o estado do banco. `GET /api/actuator/metrics` é só do
  admin e mostra o tempo de resposta por rota, a memória e as conexões com o banco. Nenhum outro endpoint do Actuator
  é exposto. Com 512 MB, como no Render, a memória ficou igual: 287,7 MiB sem o Actuator e 291,5 MiB com ele, depois
  de 1.000 requisições. Uso em `docs/tecnico/api.md#monitoramento-actuator`.

### Banco de dados

- **Backup e restore do PostgreSQL** (issue #53, item #25 do parecer): `database/backup.sh` faz o backup com
  `pg_dump` compactado e o restaura num banco temporário para conferir as linhas de cada tabela. Ele guarda 7 dias de
  backups e só apaga os antigos depois de um backup bom. `database/restore.sh` restaura só em banco vazio, nunca por
  cima de dados. Funciona com o banco do Docker, do PC e do Neon. Sem `pg_dump` instalado, usa o Docker. Uso em
  `database/LEIA-ME.md#backup-e-restore`.

### Desempenho

- **Índices da regra de alerta e dos lotes de um alerta** (issue #59): migração `V8` cria `ix_lote_processo_data`
  (substitui `ix_lote_processo`) e `ix_alerta_lote_alerta`. Com 200.000 lotes, a busca da regra de alerta num processo
  pouco usado cai de 73,5 ms para 0,19 ms, e a dos lotes de um alerta de 9,8 ms para 0,40 ms. Medição e scripts em
  `docs/tecnico/desempenho-indices.md` e `database/desempenho/`.

### Removido

- **Modo simulado do site** (item #21 do parecer): saem `src/mock/`, `src/services/mockUtil.ts`, a variável
  `VITE_USAR_MOCK` e a faixa amarela de aviso. Os serviços em `src/services/` passam a chamar só a API. Os dados e a
  senha de demonstração (`gestor.demo`, `operador01`) deixam de ir no bundle de produção, e o arquivo principal
  diminui de 337,7 kB para 331,2 kB (97,9 kB para 95,6 kB com gzip). Para demonstrar sem internet, use o Docker
  (plano B do roteiro de apresentação).

### Funcionalidades

- **Registro de lotes com a Wi-Fi oscilando (PWA):** o site vira PWA (`vite-plugin-pwa`) e abre sem conexão. Lote
  registrado sem conexão fica guardado no aparelho (IndexedDB) e é enviado sozinho quando a conexão volta, na ordem
  em que foi feito. O operador vê o que falta enviar no cabeçalho e em **Registro de lotes → Guardados neste
  aparelho**, com **Enviar agora**, **Tentar de novo** e **Descartar** (para lote recusado pela API).
- **`POST /lotes` aceita `Idempotency-Key`:** reenviar a mesma chave devolve o lote já gravado (`200`), sem duplicar
  nem reaplicar a regra de alerta. Migração `V5` cria `lote.chave_envio` com índice único. O sensor continua igual.

- **Sensor local no Wokwi:** o `iot/sketch.ino` aceita `http://` além de `https://`, e o projeto
  `aguas-capibaribe-local` fala com o Docker. O projeto público continua em HTTPS.
- **Túnel no Docker Compose:** `docker compose --profile tunel up -d --build` liga o túnel sem instalar o cloudflared.
  Ele fica desligado por padrão.

### Testes

- **Modo offline do site:** `pnpm test` (Vitest, 20 testes da fila e da sincronização) e `pnpm test:e2e`
  (Playwright, 3 testes com a conexão caindo e voltando no site de produção). 3 testes de integração novos na API
  para a `Idempotency-Key`.

### Documentação

- **Validação de usabilidade com operador** em `docs/validacao/` (item #22 do parecer): roteiro com 6 tarefas,
  questionário SUS em português, ficha do observador, kit em PDF para imprimir e modelo de resultado. Ainda não
  aplicado.
- **Roteiro de apresentação** em `docs/guia/roteiro-apresentacao.md`, com o plano A (site publicado) e o plano B (Docker).
- **ERS v1.1** e **atualização do TAP** em `docs/gestao/`, com o que mudou até a versão 1.0.0 e o que falta formalizar.
- `docs/tecnico/banco-remoto.md` e `docs/tecnico/api.md` com o banco e a API publicados.
- Guia, README e `iot/LEIA-ME.md` com o site publicado, o Docker e os dois projetos do Wokwi.

## [1.0.0] - 2026-11-02

Primeira versão completa, publicada na internet, com o sensor simulado enviando lotes por HTTPS.

### Funcionalidades

- **ESP32 em HTTPS com endereço fixo** (issue #13): o sensor confere a impressão digital do certificado da API publicada, reaproveita
  a conexão, tenta de novo enquanto a API acorda e renova o login quando a sessão vence.
- **Conta do sensor automática:** com `SENSOR_SENHA` definida, a API cria `sensor.wokwi` ao subir. O
  `iot/criar-sensor.sql` foi removido.
- **Sistema publicado:** site e API no Render, banco no Neon.
- **Docker Compose** (issue #10): `docker compose up -d --build` sobe banco, API e site em
  `http://localhost:3000`, com o Nginx encaminhando `/api`. As senhas são sorteadas na primeira subida,
  fora do Git.
- **Documentação interativa da API (Swagger UI)** em `/api/swagger-ui.html`, com as 16 rotas por grupo,
  exemplos, erros possíveis e login por token (botão Authorize). Desligável com `SWAGGER_ATIVO=false`.
- **Auditoria das ações do gestor** (issue #16): redefinir senha, desativar e reativar outra pessoa
  ficam registrados em `auditoria_usuario` (quem, em quem, o quê, quando), sem senha e sem poder ser
  alterados ou apagados. 46 testes (30 unitários e de web + 16 de integração).
- **Site usa a API real por padrão** (issue #5): sem `.env.local`, conecta em
  `http://localhost:8080/api`. O modo simulado só liga com `VITE_USAR_MOCK=true` e mostra uma faixa de
  aviso. Com a API fora do ar, o login e a recarga da página mostram "Não foi possível conectar ao
  servidor." (com "Tentar novamente"), em vez de "sessão expirada". Rodapé com a versão do
  `package.json`.
- **Status do lote calculado pela API** (issue #3): cada lote sai com `statusConformidade`
  (`DENTRO_DA_META`, `ATENCAO` ou `CRITICO`) e o site usa essa faixa no Histórico, nos lotes do alerta
  e no registro. Limites oficiais de 0% e 8%. Totais e médias são classificados no site, com os mesmos limites.
  57 testes (41 unitários e de web + 16 de integração).

### Testes

- **Teste de aceitação do ciclo completo** (issue #12): `CicloCompletoLavanderiaE2ETest` percorre por HTTP
  a jornada da lavanderia: login, processo, operador, lotes, alerta aberto e resolvido, e relatório do mês
  com os totais exatos. 60 testes (41 unitários e de web + 19 de integração).
- **Cadastro de processos coberto por testes** (issue #17): `ProcessoControllerTest` confere que meta zero
  ou negativa, unidade ou meta faltando e nome repetido (ao criar e ao editar) voltam com o erro no campo
  certo (422 ou 409) e não gravam nada. 56 testes (40 unitários e de web + 16 de integração).
- **CI no GitHub Actions** (issue #7): `backend-test` roda `mvn clean test` no Java 25 e falha se a
  integração for pulada; `frontend-build` roda `tsc --noEmit` e `pnpm build`. Badge no README.

### Banco de dados

- **Versionamento com Flyway** (issue #8): o esquema passa a ser criado e evoluído por migrações em
  `backend/src/main/resources/db/migration/`, aplicadas pela API ao subir: V1 (tabelas, índices e
  views), V2 (triggers do esperado e da imutabilidade do lote), V3 (processos iniciais) e V4
  (`auditoria_usuario`). O `database/banco.sql` e o `database/migracoes/` saem (V1, V2 e V4 reproduzem o
  mesmo esquema). Novas variáveis: `FLYWAY_USER`, `FLYWAY_PASSWORD`, `FLYWAY_ATIVO`, `FLYWAY_BASELINE`.
  **Banco oficial:** subir uma vez com `FLYWAY_BASELINE=true` (ver `database/LEIA-ME.md`).
  59 testes (41 unitários e de web + 18 de integração).
- **Migração obrigatória** para bancos já existentes, antes de subir a API nova:
  `database/migracoes/001-auditoria-usuario.sql` (hoje V4 do Flyway).

### Segurança

- Usuário restrito `aguas_api` para a API (`database/seguranca-usuario-api.sql`): lê, insere e
  atualiza, sem `DELETE`, `TRUNCATE`, `DROP` nem `ALTER`. O `backend/.env.example` já vem com ele.

### Documentação

- **Bancada física** (issue #14): `docs/tecnico/hardware-bancada.md`, com peças, preços pesquisados, circuito,
  calibração do YF-S201 e mudanças no sketch.
- Passo do `aguas_api` no "Como rodar" do README, no guia e no `database/LEIA-ME.md`.
- README e guia: passo a passo para começar num PC novo (clonar e usar a `develop`).
- README: como trabalhar numa issue (fechar à mão depois do merge na `develop`, migrações quando o
  banco muda) e próximos passos apontando para as Issues do GitHub.
- Guia: auditoria nas regras de acesso, migrações no "Como rodar" e o erro de esquema nos problemas
  comuns.

## [0.1.0-alpha] - 2026-10-27

Primeira versão preliminar: baseline das semanas 1 a 3 do cronograma do TAP.

### Funcionalidades

- **Acesso:** login com JWT, perfis gestor e operador, mesma mensagem para senha errada e usuário
  desativado; o administrador principal é criado pela API na primeira inicialização.
- **Usuários e conta:** o gestor cadastra, desativa, reativa e redefine a senha de outras pessoas;
  cada usuário altera o próprio nome e senha.
- **Processos e metas:** meta em litros por lote ou por peça, sem valores zero ou negativos.
- **Lotes:** registro com confirmação, esperado calculado pelo banco, desvio calculado pela API e lote
  imutável; histórico por perfil (operador vê os seus, gestor vê todos).
- **Alertas:** abertos quando 3 lotes seguidos do mesmo processo passam da meta, com status aberto,
  em análise e resolvido.
- **Dashboard e relatório mensal** por processo, com download direto em PDF
  (`aguas-do-capibaribe-relatorio-AAAA-MM.pdf`).
- **IoT fase 1:** ESP32 simulado no Wokwi mede a vazão e registra o lote pela API, encontrando o
  processo pelo nome.
- **Interface:** identidade visual "sertão e água", site em pt-BR, navegação por teclado nos modais e
  contraste conforme WCAG 2.1 AA.

### Técnico

- Front-end React 19 + Vite + Tailwind CSS 4; API Java 25 (LTS) + Spring Boot 3.5; PostgreSQL 18.
- 40 testes automatizados passando (25 unitários e de web + 15 de integração em banco temporário).

### Documentação

- README, guia em PDF, Termo de Abertura v2.1 e Especificação de Requisitos de Software (IEEE 830).

[1.1.0]: https://github.com/paulomourz/aguas-do-capibaribe/releases/tag/v1.1.0
[1.0.0]: https://github.com/paulomourz/aguas-do-capibaribe/releases/tag/v1.0.0
[0.1.0-alpha]: https://github.com/paulomourz/aguas-do-capibaribe/releases/tag/v0.1.0-alpha
