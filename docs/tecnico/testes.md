# Documentação de testes

Plano, casos, procedimentos e relatório de testes do Águas do Capibaribe, organizados conforme a norma
**ISO/IEC/IEEE 29119** (parte 3, documentação de testes), que substituiu a IEEE 829.

| Campo | Descrição |
|---|---|
| Versão | 1.2, 20 de novembro de 2026 (versão 1.2.0 do sistema) |
| Objeto de teste | Site (React), API (Spring Boot), banco (PostgreSQL 18), Docker Compose e sensor simulado (Wokwi), na branch `develop` |
| Base | [ERS v2.6](../gestao/ERS.md): cada requisito tem o método de verificação na seção 4 e no Apêndice C |
| Responsáveis | Equipe Águas do Capibaribe; revisão e teste das entregas com o DevOps |

## 1. Plano de testes

### 1.1 Escopo

**Dentro:** autenticação e perfis, processos e metas, registro de lote (inclusive sem conexão), cálculo do desvio,
regra de alertas, aviso no Telegram (com o disjuntor), relatórios, PDF e planilha Excel, histórico e CSV, usuários e
auditoria, limites de requisição, monitoramento e saúde do sensor, telemetria, acessibilidade, migrações do banco,
execução com Docker e envio de lotes pelo sensor.

**Fora:** sensor físico em lavanderia real e desempenho do sistema publicado (plano grátis).

### 1.2 Níveis e tipos de teste

| Nível / tipo | O que verifica | Ferramenta | Onde está |
|---|---|---|---|
| Unidade (back-end) | Regras isoladas: desvio, faixas de status, regra de alerta, JWT, CORS, contas iniciais, cache, auditoria e aviso | JUnit 5 | `backend/src/test/java` |
| Web (back-end) | Rotas, segurança, validação e formato dos erros, com a camada web real | Spring MockMvc | `SegurancaWebTest`, `ProcessoControllerTest`, `LimiteDeRequisicoesTest` |
| Integração | API completa com PostgreSQL 18 real: migrações, triggers, regra de alerta, perfis, auditoria, chave de envio, Actuator | Testcontainers | `IntegracaoPostgresBase` |
| Sistema (back-end) | Jornada do login ao relatório | JUnit + PostgreSQL | `CicloCompletoLavanderiaE2ETest` |
| Unidade (site) | Fila do aparelho, sincronização, CSV, tema e glossário | Vitest | `src/**/__testes__` |
| Ponta a ponta (site) | Site de produção com service worker: conexão caindo e voltando sem duplicar lote, envio em segundo plano com a aba fechada, fluxo do alerta crítico até Resolvido, planilha, aviso de privacidade, limite de login e carregamento sem saltos | Playwright | `e2e/*.spec.ts` |
| Acessibilidade | WCAG 2.1 A e AA nas telas principais, nos temas claro e escuro; violação séria ou crítica falha o CI | axe-core (`@axe-core/playwright`) | `e2e/acessibilidade.spec.ts` |
| Mutação (back-end) | Se os testes percebem quando o código muda: o PIT altera as regras de negócio, a segurança e os avisos (`service`, `security`, `notificacao`) e roda os testes; sobrevivência de mutantes abaixo de 20% | PIT (pitest) | `backend/pom.xml`; workflow "Teste de mutação" |
| Implantação | Docker Compose sobe e responde: login, processos e registro de lote pelo Nginx | GitHub Actions | job `docker-compose` do CI |
| Segurança das dependências | Vulnerabilidades conhecidas no `pom.xml` e no `pnpm-lock.yaml`; bloqueia CVSS 7,0 ou mais | OSV-Scanner | job `dependencias` do CI; exceções em `osv-scanner.toml` |
| Análise estática e cobertura | Problemas novos, cobertura e duplicação do código novo (Quality Gate) | SonarQube, JaCoCo e Vitest (`@vitest/coverage-v8`) | workflow "Qualidade"; `sonar-project.properties` |
| Cadeia de suprimentos | Lista de componentes (SBOM) da API e do site, com hash e licença | CycloneDX (plugin Maven e cdxgen) | workflow "SBOM" |
| Desempenho | 50 e 100 sensores ao mesmo tempo; turno industrial com 120 sensores e picos; índices e autovacuum do banco | k6, EXPLAIN ANALYZE | [teste de carga](teste-carga.md), [índices](desempenho-indices.md), [manutenção](manutencao-banco.md) |
| Continuidade | Backup, banco apagado e restauração até o sistema voltar | Docker e scripts de `database/` | [runbook](runbook-disaster-recovery.md) |
| Usabilidade | Pessoas de fora da equipe registrando lotes, com o roteiro e o questionário SUS; avaliação heurística (Nielsen) dos fluxos de lote, gauge e alerta | Roteiro, ficha e heurísticas | [`docs/validacao/`](../validacao/LEIA-ME.md), [avaliação heurística](../gestao/avaliacao-heuristica-usabilidade.md) |
| Demonstração | Telas e sensor funcionando | Navegador e Wokwi | seção 4 |

### 1.3 Ambientes

| Ambiente | Uso |
|---|---|
| GitHub Actions | Todos os testes automáticos, a cada push e pull request para `develop` e `main`. |
| Docker local | Integração e demonstrações sem tocar no banco publicado. |
| Sistema publicado (Render e Neon) | Só demonstrações. Os testes automáticos **nunca** usam o banco oficial (`conectaSomenteAoBancoDeTeste`). |
| Wokwi | Sensor simulado, com o projeto local ou público. |

### 1.4 Critérios

- **Entrada:** o pull request compila e aponta para a `develop`.
- **Aprovação:** todos os jobs do CI verdes (`backend-test`, `frontend-build`, `docker-compose`, `dependencias`), o
  SBOM gerado e o Quality Gate do SonarQube aprovado.
- **Suspensão:** CI vermelho bloqueia o merge, e o Render não publica.
- **Conclusão da versão:** todos os requisitos implementados com verificação feita (ERS, Apêndice C).

### 1.5 Riscos dos testes

| Risco | Tratamento |
|---|---|
| Integração lenta ou sem Docker na máquina | Roda sempre no CI; localmente, `IntegracaoPostgresLocalTest` usa um banco de teste indicado em `TESTE_PG_URL`. |
| Erro temporário no CI | Rodar de novo (Re-run failed jobs) e anotar no pull request. |
| Simulador lento no Wokwi (abaixo de 100%) | A conexão segura cai; fechar programas pesados e reiniciar a simulação (`iot/LEIA-ME.md`). |

## 2. Projeto e casos de teste

Os casos ficam no código: cada método de teste é um caso, com nome que diz o comportamento esperado. Casos principais
por função:

| Função (ERS) | Caso de teste | Resultado esperado |
|---|---|---|
| Login (RF01, RF02) | `loginMeESenhaErrada` | Senha certa devolve token; errada devolve 401 com mensagem genérica. |
| Limite de login (RNF19) | `LimiteDeRequisicoesTest`, `mesmaContaTentadaDeMuitosIpsRecebe429` | Da 6ª tentativa do IP no minuto, ou da 11ª da conta somando os IPs, 429 com `Retry-After`. |
| Perfis (RF03) | `cadaPerfilAcessaSoOQueLheCabe`, `operadorNaoAcessaFuncoesDeGestor` | Rota fora do perfil devolve 403. |
| Desativação (RF18) | `usuarioDesativadoPerdeAcessoNaProximaRequisicao` | Token ainda válido passa a receber 401. |
| Processos (RF04 a RF06) | `ProcessoControllerTest`, `processoDuplicadoSemDiferenciarMaiusculas` | Meta ≤ 0 e nome repetido são recusados. |
| Esperado e desvio (RF09) | `esperadoVemDoTriggerEDesvioDaFormulaDaView` | Banco calcula o esperado; desvio igual ao da visão. |
| Lote imutável (RF10) | `loteNaoPodeSerAlteradoNemExcluido` | UPDATE e DELETE recusados pelo banco. |
| Sem conexão (RF28) | `e2e/offline.spec.ts`, `reenvioComAMesmaChaveNaoDuplicaOLote` | Lotes chegam uma vez só, na ordem. |
| Envio em segundo plano (RF28) | `e2e/backgroundSync.spec.ts`, `envioSegundoPlano.test.ts`, `sw.test.ts` | Com a aba fechada, o service worker envia a fila quando a rede volta, sem duplicar. |
| Alertas (RF11, RF12) | `regraDeAlertaTresConsecutivosEAnexacao`, `alertaResolvidoNaoReaproveitaLotesETransicoesSaoValidadas` | 3 lotes acima abrem alerta; transição inválida devolve 409. |
| Telegram (RF30) | `alertaAbertoAvisaNoTelegramDepoisDeGravar`, `telegramForaDoArNaoAtrapalhaORegistroDoLote` | Aviso sai depois do commit; falha não afeta o lote. |
| Disjuntor do Telegram (RF30) | `DisjuntorDoTelegramTest` (12 testes, com um Telegram de mentira local) | Com 50% de falhas nas últimas chamadas, abre; aberto, recusa em menos de 1 s sem tocar na rede; 401 e 400 não abrem; volta depois da espera. |
| Fluxo do alerta (RF11, RF12) | `e2e/alerta-fluxo.spec.ts` | Três lotes críticos abrem o alerta, que passa a Em análise e a Resolvido, com vídeo e capturas de tela. |
| Relatório (RF13, RF14) | `resumoMensalUsaFusoDeRecife`, `mesInvalidoNoRelatorioRetorna422` | Mês fecha no fuso de Recife; mês inválido devolve 422. |
| Planilha Excel (RF36) | `exportToExcel.test.ts`, `e2e/planilha.spec.ts` | O .xlsx abre com as duas abas, as fórmulas e os valores certos; sem lotes, o botão fica desabilitado. |
| Auditoria (RF27) | `AuditoriaUsuarioTest`, `auditoriaListaAsAcoesComFiltrosEPaginacao` | Cada ação gera registro, sem senha, que não pode ser apagado. |
| CSV (RF29) | `historicoCsv.test.ts` | Arquivo com BOM, ";" e CRLF, hora de Recife, ordem cronológica e fórmulas neutralizadas. |
| CSV da API (RF33) | `CsvDeLotesTest`, `csvDoPeriodoUsaFusoDeRecifeFiltraPorProcessoEProtegeTextos`, `csvComMilharesDeLotesNaMesmaHoraNaoRepeteNemPulaNenhum`, `csvConfereOPeriodoEOProcessoAntesDeComecarESoParaGestor` | Mesmo formato do site; período fecha no fuso de Recife; 50.000 lotes na mesma hora saem todos, uma vez, em ordem; período inválido devolve 422 e operador recebe 403. |
| Faixas (RF24) | `faixaDeConformidadeRespeitaAsFronteiras` | 0% = dentro; 8% = atenção; acima de 8% = crítico. |
| Telemetria (RF37) | `TelemetriaControllerTest`, `sensorRegistraTelemetriaQueFicaGravadaNoNomeDeleENaoPodeSerAlterada` | Leitura válida → 201 e gravada no nome do sensor; nula, negativa ou acima de 10000 → 400 `TELEMETRIA_INVALIDA`; sem token → 401. |
| Monitoramento (RNF20) | `saudeAbertaMostraSoOStatusSemToken`, `metricasSoParaOAdmin` | Saúde aberta; métricas só para o administrador. |
| Saúde do sensor (RNF20) | `SensorWokwiHealthIndicatorTest`, `saudeDoSensorWokwiPelaUltimaTelemetriaSemAfetarARaiz` | UP com leitura de até 59 s; DOWN (503) com 60 s ou sem leitura; a saúde principal não muda. |
| Acessibilidade (RNF13) | `e2e/acessibilidade.spec.ts` | Nenhuma violação séria ou crítica do WCAG 2.1 AA, nos dois temas. |
| Carregamento (RNF29) | `e2e/carregamento.spec.ts`, `esqueletos.test.ts` | Esqueletos no lugar dos dados e CLS abaixo de 0,1 com rede 3G simulada. |
| Migrações | `flywayAplicouTodasAsMigracoesEmOrdem`, `reinicioValidaChecksumsENaoRecriaNada` | V1 a V14 aplicadas uma vez, na ordem. |

## 3. Procedimentos

| O que rodar | Comando | Precisa de |
|---|---|---|
| Back-end completo | `cd backend` e `mvn test` (cobertura em `backend/target/site/jacoco`) | JDK 25, Maven e Docker (integração) |
| Mutação (back-end) | `cd backend`, `mvn test-compile` e `mvn org.pitest:pitest-maven:mutationCoverage`; relatório em `backend/target/pit-reports/index.html`. No GitHub: Actions > Teste de mutação (o resumo mostra a sobrevivência e os mutantes vivos) | JDK 25 e Docker (integração); sem Docker, os testes de integração são pulados e a sobrevivência sobe |
| Site, unidade | `pnpm test`; com cobertura, `pnpm test:cobertura` (`coverage/lcov.info`) | Node.js e pnpm |
| Site, ponta a ponta e acessibilidade | `pnpm exec playwright install chromium` (1ª vez) e `pnpm test:e2e` | Node.js e pnpm |
| Qualidade (SonarQube) | No GitHub: Actions > Qualidade; o resultado fica em `https://sonar.fchicout.dev` | Segredo `SONAR_TOKEN` |
| Docker | `docker compose up -d --build` e abrir `http://localhost:3000` | Docker |
| Carga | ver [teste-carga.md](teste-carga.md) | k6 e Docker |
| Sensor | ver [`iot/LEIA-ME.md`](../../iot/LEIA-ME.md) | Wokwi e a senha do sensor |
| Usabilidade | ver [roteiro](../validacao/roteiro-teste-usabilidade.md) | Um operador e a ficha do observador |

## 4. Relatório de testes

### 4.1 Testes automáticos

Última execução da `develop`: **20/11/2026, commit `0accc03` (merge do PR #195), todos os jobs verdes**, com o
Quality Gate do SonarQube aprovado (cobertura do código novo de 92,3% e duplicação de 0%).

| Conjunto | Executados | Falhas |
|---|---|---|
| Back-end: unidade e web | 180 | 0 |
| Back-end: integração e sistema com PostgreSQL 18 | 41 | 0 |
| Site: unidade (Vitest) | 286 | 0 |
| Site: ponta a ponta e acessibilidade (Playwright) | 24 | 0 |
| Docker Compose | 1 job | 0 |
| **Total** | **531 testes + Docker, vulnerabilidades, mutação, SBOM e Quality Gate** | **0** |

No log do Maven aparecem 262 testes, com 41 ignorados: são os mesmos testes de integração na variante que usa um
banco local, que não roda no CI.

### 4.2 Testes manuais e medições

| Data | Teste | Resultado |
|---|---|---|
| 03/11/2026 | Carga com 50 sensores simultâneos (local) | p95 de 68 ms, cerca de 1.000 lotes por segundo, nenhuma falha |
| 10/11/2026 | Carga com 100 sensores no GitHub Actions, pool 10 e 20 | 0 falhas; p95 de 377 ms (pool 10) e 262 ms (pool 20); padrão da API passou a 20 conexões |
| 17/11/2026 | Turno industrial com 120 sensores e picos de lavagem, 3 rodadas no GitHub Actions | Cerca de 50.700 leituras por turno, 0 respostas 5xx; p95 no pico entre 16 e 178 ms (meta: 250 ms) |
| 24/11/2026 | Massa de demonstração e reset do roteiro (`database/demonstracao/testar-massa.sh`) | 64 lotes, 2 alertas e 34 descartes; a 2ª execução recusa sem gravar nada; depois de um ensaio, `TRUNCATE` + massa em 0,4 a 0,6 s, sem erro de constraint e com o banco idêntico ao de antes (só o operador cadastrado ao vivo continua) |
| 17/11/2026 | Ensaio do runbook de recuperação no Docker | Backup, banco apagado e restauração: sistema de volta em 23 s, com todos os lotes |
| 24/11/2026 | Ensaio do runbook de recuperação no Docker com a massa da demonstração | Backup, banco apagado e restauração: sistema de volta em 35 s, com as 10 tabelas idênticas e a API gravando de novo; a verificação do backup passou a conferir também descartes, telemetria e avisos pendentes |
| 03/11/2026 | Índices com 200.000 lotes | Regra de alerta de 73,5 ms para 0,19 ms |
| 05/11/2026 | Aviso no Telegram com o sistema publicado | Alerta aberto e mensagem recebida no grupo |
| 06/11/2026 | Sensor no Wokwi com a API publicada | Lote de 19,55 L crítico, com LED vermelho; lote de 3,74 L dentro da meta, sem sinal |
| 06/11/2026 | Sensor no Wokwi com o computador carregado | A simulação caiu para 3% da velocidade, e o envio à API falhou (SSL EOF). Base do adiamento do RF31 (issue #47) |

### 4.3 Pendências

| Item | Situação |
|---|---|
| Teste de usabilidade com operador real (RNF25) | Não feito por falta de acesso a lavanderias no prazo. Foram feitos a avaliação simulada por inspeção (PR #140) e o teste com pessoas de fora da equipe, sem dificuldades relevantes; o kit está pronto para o teste real (issue #50 encerrada). |
| Desempenho do sistema publicado | Não medido, por ser plano grátis. |

### 4.4 Requisitos adiados

| Item | Situação |
|---|---|
| Vários sensores por linha de lavagem (RF31) | Adiado em 09/11/2026 (issue #47; Apêndice B da ERS). Sem casos de teste nesta versão. O limite é o simulador do Wokwi no navegador, não a API, que já aceita vários sensores ao mesmo tempo (teste de carga com 50, seção 4.2). |
