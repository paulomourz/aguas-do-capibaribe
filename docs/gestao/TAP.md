<p align="center"><img src="../assets/logo-referencia.png" width="120" alt="Logo do Águas do Capibaribe"></p>

# Águas do Capibaribe — Termo de Abertura do Projeto

**Sistema de Gestão de Consumo Hídrico por Lote em Lavanderias de Jeans do Agreste Pernambucano**

Termo de Abertura do Projeto (Project Charter) e Backlog de Histórias de Usuário · **Versão 3.5**, atualizada em 26 de
novembro de 2026. Versões anteriores: 1.0 (22/09/2026), 2.0 (12/10/2026), 2.1 (20/10/2026), 3.0 (05/11/2026), 3.1 (09/11/2026),
3.2 (14/11/2026), 3.3 (17/11/2026) e 3.4 (20/11/2026).

> **Sobre esta versão.** A versão 3.0 alinha o termo ao sistema publicado e às entregas feitas depois do parecer técnico de 27/10/2026: versão 1.0.0, hospedagem, segurança, novos perfis, modo offline, auditoria, avisos e desempenho. As mudanças estão listadas na seção 11. A versão 3.1 adota as normas ISO/IEC de documentação (seção 5.1), registra o glossário têxtil e o aviso de lote crítico no sensor e atualiza os números de testes. A versão 3.2 acompanha a versão 1.1.0 do sistema, com as entregas da sprint de 10 a 14/11/2026 (seção 11). A versão 3.3 registra o repositório público. A versão 3.4 atualiza o termo com as issues do parecer Week 03 (17/11/2026). A versão 3.5 fecha o projeto com a versão 2.0.0 do sistema, a final, no code freeze de 27/11/2026, com as issues do parecer Week 04 (24/11/2026) e as datas da feira ProjetAÍ (30/11 a 03/12/2026). Itens marcados com **[A CONFIRMAR]** dependem de decisão do orientador.

<!-- sumario -->

# Parte 1 — Termo de Abertura do Projeto

## 1. Identificação geral do projeto

| Campo | Descrição |
|---|---|
| Nome oficial do projeto | Águas do Capibaribe — Sistema de Gestão de Consumo Hídrico por Lote |
| Responsável / aluno | Pedro |
| Patrocinador / orientador | Fabio Cesar Figueiredo de Medeiros Chicout |
| Data de elaboração | 22 de setembro de 2026 (versão 1.0) |
| Última atualização | 26 de novembro de 2026 (versão 3.5) |
| Região de aplicação | Toritama, Caruaru e Santa Cruz do Capibaribe (PE) — Agreste Pernambucano |
| Tipo de solução | Sistema web em arquitetura REST: front-end em React com TypeScript, acessado pelo navegador e instalável como aplicativo (PWA); back-end em Java com Spring Boot, que expõe uma API REST; banco de dados PostgreSQL. |
| Endereço do sistema | Site: https://aguas-do-capibaribe.onrender.com · API: https://aguas-api-a0vq.onrender.com/api |
| Repositório GitHub oficial | https://github.com/paulomourz/aguas-do-capibaribe (público desde 17/11/2026, fluxo GitFlow, branch padrão develop) |
| Versão do sistema | 2.0.0, a final, no code freeze de 27/11/2026 (issue #207). Antes: 1.0.0 (02/11/2026) e 1.1.0 (14/11/2026). As apresentações na feira ProjetAÍ vão de 30/11 a 03/12/2026. |

## 2. Papéis no projeto

| Nome | Vínculo | Papel principal | Responsabilidades |
|---|---|---|---|
| Pedro | Aluno responsável | Desenvolvedor Full Stack / PO | Levantamento de requisitos, arquitetura REST, desenvolvimento do MVP web, modelagem do banco e validação com o usuário. |
| Abraão Filipe | Integrante da equipe | Back-End | Lógica de negócio e regras de comparação com a meta, expostas via API REST. |
| João Bezerra | Integrante da equipe | Back-End | Endpoints REST de cadastro, registro de lote e alertas. |
| Matheus Andrade | Integrante da equipe | Front-End Web | Telas web (login, cadastro, registro de lote e relatórios), consumindo a API REST. |
| Mateus Basilio | Integrante da equipe | Banco de Dados | Modelagem e manutenção do banco de processos, lotes, metas e histórico de consumo. |
| Paulo Moura | Integrante da equipe | DevOps | Ambiente, build, integração contínua, implantação (deploy) e revisão e teste das entregas. |
| Fabio Cesar Figueiredo de Medeiros Chicout | Patrocinador / orientador | Orientação acadêmica | Acompanhamento do escopo, governança do projeto e validação das entregas. |

A distribuição acima é a referência inicial. A equipe reveza atividades conforme quem se adapta melhor a cada uma; cada entrega fica registrada numa issue do GitHub, com responsável.

## 3. Visão do produto e problema a resolver

### 3.1 O problema real

As lavanderias industriais de jeans do Agreste Pernambucano — polo responsável por cerca de 14% a 16% de toda a produção nacional de jeans, com dezenas de unidades concentradas em Toritama — consomem água de forma cara (poço artesiano e caminhão-pipa) e sem controle sistemático por tipo de processo de lavagem. Mais de 77% da água utilizada retorna ao rio Capibaribe sem tratamento adequado, o que já motivou fiscalização ativa do Ministério Público de Pernambuco (MPPE) e da CPRH. Hoje não existe, no mercado local ou nacional, um sistema de gestão que trate esse consumo como dado comparável e auditável: o controle é feito "no olho", sem meta clara nem histórico confiável.

### 3.2 A solução proposta

Um sistema web, em arquitetura REST, que permite a lavanderias de jeans cadastrar metas de consumo de água por tipo de processo, registrar o consumo real por lote produzido, comparar automaticamente o realizado com a meta e gerar alertas, avisos e relatórios históricos que sustentem tanto a redução de custo quanto a comprovação de conformidade ambiental perante clientes e órgãos fiscalizadores. O back-end, em Java com Spring Boot, expõe uma API REST responsável pelas regras de negócio e pela persistência em PostgreSQL; o front-end, em React com TypeScript, consome essa API e funciona no computador e no celular, inclusive com a conexão oscilando.

### 3.3 Justificativa financeira e de impacto

- Uma lavanderia de porte médio (cerca de 70.000 litros por dia) pode gastar cerca de R$ 56 mil por mês em água comprada.
- Reúso consistente, em patamares já demonstrados na região (até 85%), pode gerar economia mensal superior a R$ 40 mil por lavanderia.
- Evita risco de embargo ou interdição por fiscalização ambiental (MPPE/CPRH), que hoje pode parar a produção sem aviso.
- Abre porta comercial com marcas compradoras que já exigem rastreabilidade hídrica de fornecedores.

*Nota: os dados de mercado e financeiros acima vêm da pesquisa documental e funcionam como estimativas; dores, comportamentos e disposição a pagar ainda dependem de validação direta com operadores e gestores (seção 8).*

## 4. Declaração do escopo

### 4.1 O que está incluso no MVP

- **Login** autenticado na API, com mensagem genérica para credenciais inválidas, bloqueio de todas as funcionalidades sem sessão e limite de tentativas por minuto.
- **Perfis de acesso:** administrador, gestor, operador e sensor (seção 4.4). Não há autocadastro: o administrador principal e, opcionalmente, o primeiro gestor e a conta do sensor são criados pela API na inicialização.
- **Gestão de usuários pelo administrador:** cadastro, desativação, reativação e redefinição da senha de quem esqueceu, com registro de auditoria que não pode ser alterado nem apagado.
- **Configurações da conta:** cada pessoa altera o próprio nome e a própria senha.
- **Processos e metas:** cadastro e edição de tipos de processo de lavagem com meta em litros por lote ou por peça, sem aceitar valor zero ou negativo.
- **Registro de lote** (processo, peças e litros), com confirmação antes de gravar e data, hora e autor automáticos. O lote não pode ser editado nem excluído. Sem conexão, o lote fica guardado no aparelho e é enviado sozinho quando a conexão volta, sem duplicar.
- **Comparação automática com a meta:** o banco calcula o esperado e a API, o desvio e o status, com cor, ícone e texto: dentro da meta (até 0%), atenção (até 8%) e crítico (acima de 8%).
- **Histórico de lotes:** o operador vê os próprios lotes; administrador e gestor veem todos, com quem registrou. Exportação em CSV do filtro atual, para auditoria externa.
- **Alertas:** 3 ou mais lotes seguidos do mesmo processo acima da meta abrem um alerta, com status aberto, em análise e resolvido, tela de detalhe e aviso opcional num grupo do Telegram.
- **Dashboard do gestor** com indicadores do mês, alertas ativos, resumo por processo e gráficos de meta e consumo.
- **Relatório mensal** de consumo, meta e desvio por processo, filtrável por mês e ano, com download em PDF e planilha Excel.
- **Descarte de efluentes** de cada lote, com volume, pH, turbidez e percentual reaproveitado, aviso de pH fora da faixa da CONAMA 430 (5 a 9) e visão mensal de conformidade e reúso.
- **Custo da água:** preço do m³ com vigência e custo da água e do excesso do mês, no total e por processo.

### 4.2 Trilha complementar: IoT em duas fases

**Fase 1 — simulação (concluída):** um sensor de vazão simulado no Wokwi (ESP32) mede o lote e o envia à API publicada, em HTTPS. **Fase 2 — protótipo físico de bancada:** especificado em docs/tecnico/hardware-bancada.md e sujeito ao ponto de verificação da seção 6. A trilha não substitui o registro manual e não altera os critérios de sucesso.

### 4.3 O que não está incluso

- Integração com sensores automáticos de vazão em operação real, instalados numa lavanderia.
- Tratamento físico do efluente (estações, filtros).
- Emissão de selo ou certificação com validade jurídica formal.

Tratamento definido em outro documento: o registro de volume de efluente e o índice de reúso seguem a decisão P7 do Registro de Decisões v1.

### 4.4 Perfis de acesso

| Perfil | O que faz |
|---|---|
| Administrador | Tudo o que o gestor faz, mais usuários e auditoria. |
| Gestor | Dashboard, alertas, relatórios, processos e metas, registro e histórico de todos os lotes; só consulta a lista de usuários. |
| Operador | Registra lotes e consulta o próprio histórico. |
| Sensor | Conta técnica do dispositivo: só consulta os processos e registra lotes; não entra no site. |

## 5. Tecnologias e arquitetura

| Camada | Tecnologia | Observação |
|---|---|---|
| Front-end | React 19, TypeScript, Vite 8, Tailwind CSS 4 | Protótipo gerado com apoio da IA do Figma. Instalável como aplicativo (PWA), com fila de lotes sem conexão no próprio aparelho. |
| Back-end | Java 25 (LTS) com Spring Boot 3.5 | API REST, Spring Data JPA, validação, Spring Security (JWT), limite de requisições, cache da lista de processos, monitoramento (Actuator) e aviso no Telegram. |
| Banco de dados | PostgreSQL 18 | Esquema versionado com migrações Flyway (V1 a V16). A API conecta com o usuário restrito aguas_api, sem permissão de apagar dados nem de alterar o esquema. |
| Comunicação | API REST em JSON | 19 endpoints sob /api, documentados no Swagger e em docs/tecnico/api.md. |
| Simulação de IoT | Wokwi (ESP32) | Projeto público em HTTPS, ligado à API publicada; projeto local para testes com o Docker. |
| Hospedagem | Render (site e API) e Neon (banco) | Planos gratuitos. O Render só publica depois que o CI passa e confere a saúde da API. |
| Execução local | Docker Compose | Sobe banco, API e site com um comando, com túnel opcional para o Wokwi (plano B de apresentação). |
| Qualidade | GitHub Actions | A cada pull request: 253 testes do back-end, 346 de unidade e 26 de ponta a ponta do front-end, build, teste do Docker (com o plano C e o script da aula de banco de dados), vulnerabilidades nas dependências, SBOM e Quality Gate do SonarQube; testes de mutação no workflow próprio. Teste de carga com até 100 sensores sob demanda. |
| Versionamento | GitHub | Repositório público desde 17/11/2026 (o plano grátis limita o GitHub Actions a 2.000 minutos por mês em repositório privado), com GitFlow (main, develop, feature, release, hotfix); develop é a branch padrão e a main só recebe versões. |

**Princípios de arquitetura.** O front-end nunca acessa o banco: toda operação passa pela API REST. O back-end concentra as regras de negócio (desvio, status, alertas, autorização por perfil); o banco calcula o esperado de cada lote e impede que um lote ou um registro de auditoria seja alterado ou apagado. Senhas são guardadas com hash BCrypt, e nenhuma senha ou token fica no repositório.

### 5.1 Documentação e normas

| Norma | Documento |
|---|---|
| ISO/IEC/IEEE 29148 (requisitos) | Especificação de Requisitos de Software v2.0 (docs/gestao/ERS.pdf) |
| ISO/IEC/IEEE 42010 (arquitetura) | Descrição da arquitetura (docs/tecnico/arquitetura.md) |
| ISO/IEC/IEEE 26514 (documentação do usuário) | Guia do sistema v2.1 (docs/guia/) |
| ISO/IEC/IEEE 29119 (testes) | Plano, casos e relatório de testes (docs/tecnico/testes.md) |
| ISO/IEC 12207 (ciclo de vida) | Processos do ciclo de vida (docs/gestao/ciclo-de-vida.md) |
| ISO/IEC 27001 (segurança da informação) | Política, análise de riscos e continuidade (docs/gestao/seguranca.md) |

Os documentos seguem a estrutura de cada norma, adaptada ao porte de um projeto acadêmico, sem certificação formal.

## 6. Estratégia de IoT

**Decisão da equipe (12/10/2026).** Seguir pelo caminho "simulado e depois físico", em linha com a recomendação do orientador, tratando o simulador como mais um cliente da mesma API.

**Fase 1 concluída.** Um ESP32 simulado no Wokwi mede a vazão (um potenciômetro faz o papel do sensor YF-S201), conta os litros do lote e envia o lote à API publicada, em HTTPS, conferindo a impressão digital do certificado. A conta do dispositivo (sensor.wokwi) tem perfil próprio, que só consulta processos e registra lotes; a senha é colada no simulador na hora do uso e não fica salva no projeto público.

| Caminho | Principais pontos | Situação |
|---|---|---|
| A — Simulado, depois físico (se viável) | Valida a lógica e a integração com a API a baixo custo; para a API, simulador e dispositivo são equivalentes, então o trabalho da simulação é reaproveitado. | Decidido pela equipe; fase 1 concluída. |
| C — Somente simulado | Menor risco e custo; entrega uma prova de conceito do fluxo de dados, descrita com clareza como simulação. | Plano de contingência, caso o ponto de verificação não seja atingido. |

**Ponto de verificação para o dispositivo físico.** O protótipo físico só começa se: (i) o núcleo do MVP estiver integrado (atendido); (ii) a simulação já enviar lotes à API (atendido); (iii) o hardware estiver disponível; (iv) houver margem de prazo; (v) o orientador concordar. A equipe propõe permanecer no simulado; a decisão precisa ser registrada em ata assinada pelo orientador. **[A CONFIRMAR]**

**Limite declarado.** Mesmo no físico, o dispositivo seria um protótipo de bancada, em escala reduzida, e não uma instalação em lavanderia industrial. Os resultados não devem ser apresentados como medição real.

## 7. Partes interessadas

| Parte interessada | Interesse / papel |
|---|---|
| Operador de máquina | Registra os dados de cada lote, inclusive sem conexão, e consulta os próprios lotes. |
| Gestor da lavanderia | Define metas, acompanha alertas, avisos e relatórios e toma decisões. |
| Administrador do sistema | Cadastra usuários e acompanha a auditoria das contas. |
| Confeccionista / marca compradora | Consome o relatório de conformidade como critério de compra. |
| Órgãos ambientais (MPPE / CPRH) | Referência indireta; motivam a rastreabilidade e podem receber a exportação em CSV. |

## 8. Critérios de sucesso

| Critério | Situação em 20/11/2026 |
|---|---|
| Sistema web funcional (front-end React com TypeScript e API REST em Spring Boot) com cadastro, registro de lote e comparação automática com a meta. | Atendido; sistema publicado. |
| Autenticação funcional e persistência dos dados em PostgreSQL. | Atendido. |
| Geração de pelo menos um relatório histórico consolidado a partir de dados de teste. | Atendido; relatório mensal com PDF e planilha Excel, e exportação em CSV. |
| Validação do conceito com pelo menos um cenário ou persona representativo do setor. | **Atendido em parte:** avaliação simulada por inspeção, teste com pessoas de fora da equipe, sem dificuldades relevantes, e avaliação heurística dos fluxos principais. O teste com um operador de lavanderia ficou como limitação, por falta de acesso no prazo; o kit está pronto (issue #50, encerrada). |
| Código organizado e documentado, com execução reproduzível pelos integrantes da equipe. | Atendido; Docker Compose, guia, roteiro de apresentação, CI com Quality Gate no SonarQube e documentação nas normas ISO/IEC (seção 5.1). |

## 9. Principais riscos

| Risco | Mitigação |
|---|---|
| Baixa adesão do operador ao registro manual por lote. | Tela simples, com poucos passos; registro funciona com a conexão oscilando; sensor como alternativa. |
| Meta de consumo mal calibrada por falta de dado técnico do processo real. | Valores de referência da literatura e de casos documentados, ajustáveis pelo gestor. |
| Prazo curto para a entrega. | Escopo reduzido ao essencial; trilha de IoT separada e sujeita a ponto de verificação. |
| Equipe iniciante em arquitetura REST e web. | Pilha conhecida, contrato REST documentado, revisão das entregas e CI com testes automatizados. |
| Uma mudança com erro chegar ao sistema publicado. | Pull request para a develop com CI obrigatório para publicar: o Render só publica depois que os testes passam. |
| A API do plano grátis dorme sem uso e leva cerca de 2 minutos para acordar. | Abrir o site antes de apresentar; plano B com Docker no computador. |
| Perda de dados do banco publicado. | Scripts de backup e restauração com verificação do backup; lotes e auditoria protegidos contra alteração pelo próprio banco; runbook de recuperação de desastres, ensaiado no Docker em 17/11/2026 (sistema de volta em 23 s) e em 24/11/2026 com a massa da demonstração (35 s, com as 10 tabelas idênticas). |
| O Telegram fora do ar atrasar os avisos. | Disjuntor nas chamadas: com o Telegram fora, o aviso vai direto para a fila de pendentes, sem esperar a rede, e é reenviado quando ele volta. |
| O certificado da API muda (o atual vale até 20/12/2026) e o sensor recusa a conexão. | Atualizar a impressão digital no sketch do sensor. |
| Vazamento do token do sensor, que é colado no simulador público. | Perfil sensor só consulta processos e envia lotes e leituras; o token não fica salvo no projeto, o banco guarda só o hash dele e o administrador pode trocá-lo a qualquer momento, o que invalida o anterior na hora. |
| A trilha de IoT consumir tempo do núcleo do MVP. | Começar pela simulação, manter a trilha separada e só iniciar o físico se o ponto de verificação for atingido. |

## 10. Marcos

Semanas contadas a partir de 12/10/2026, até o code freeze de 27/11/2026 e a feira ProjetAÍ (30/11 a 03/12/2026).

| Semana | Entregas | Situação |
|---|---|---|
| 1 | Fundação do back-end (Spring Boot, PostgreSQL, entidades, primeiro gestor); front-end no repositório; contrato da API. | Concluída |
| 2 | Login e segurança; usuários; conta; processos e metas, com as telas integradas. | Concluída |
| 3 | Lotes, desvio e status, histórico e alertas (regra de 3 lotes consecutivos). | Concluída |
| 4 | Dashboard e relatório mensal com PDF; integração completa do front-end. Ponto de verificação do IoT físico. | Concluída; ponto de verificação a formalizar |
| 5 | Testes dos fluxos completos, implantação e simulação de IoT com a API publicada. Versão 1.0.0 (02/11/2026). | Concluída |
| 6 | Itens do parecer técnico, documentação nas normas ISO/IEC, versão 1.1.0 (14/11/2026). | Concluída |
| 7 | Auditoria e cronograma (16/11); issues do parecer Week 03 (17 a 19/11); revisão final e correções (20 e 21/11); roteiro e massa de dados da demonstração (issue #115). | Concluída |
| 8 | Issues do parecer Week 04 (24 a 26/11): efluentes, custo da água, sinal de vida do sensor, acessibilidade e ponta a ponta dos efluentes, ensaio de restauração, plano C para a disciplina de Banco de Dados e deck da feira; code freeze e versão 2.0.0, a final (27/11/2026). Depois do freeze: ensaios, vídeo de contingência e apresentações na ProjetAÍ (30/11 a 03/12). | Em andamento |

## 11. Alterações desde a versão 2.1

| Tema | Versão 2.1 (20/10/2026) | Versão 3.0 (05/11/2026) |
|---|---|---|
| Status por cor | Calculado no front-end, com faixas provisórias. | Calculado pela API, com limites de 0% e 8%; totais e médias no site, com os mesmos limites. |
| Relatório | PDF pela impressão do navegador. | Download direto em PDF. |
| Perfis | Gestor e operador; o sensor usava uma conta de operador. | Administrador, gestor, operador e sensor; usuários e auditoria só com o administrador (issue #66). |
| Auditoria | Não prevista. | Tela e API de auditoria das ações sobre contas de usuário, com filtros (issue #57). |
| Registro de lote | Só com conexão. | Sem conexão, o lote fica no aparelho e é enviado depois, sem duplicar (issue #54). |
| Histórico | Só consulta. | Exportação em CSV para auditoria (issue #48). |
| Alertas | Só na tela. | Aviso opcional num grupo do Telegram (issue #52). |
| Dashboard | Indicadores e resumo. | Gráficos de meta e consumo por processo e por dia (issue #58). |
| Segurança | Login e perfis. | Limite de tentativas de login e de envio de lotes (issue #60); usuário restrito no banco; HTTPS. |
| Desempenho | Não medido. | Teste de carga (issue #56), índices medidos com EXPLAIN ANALYZE (issue #59) e cache da lista de processos (issue #46). |
| Operação | API não publicada. | Site e API no Render, banco no Neon; monitoramento de saúde e métricas (issue #51); backup e restauração com verificação (issue #53). |
| Banco | Script SQL; usuário postgres. | Migrações Flyway V1 a V11; usuário restrito aguas_api. |
| Execução local | PostgreSQL na máquina de DevOps. | Docker Compose com banco, API, site e túnel opcional. |
| Modo simulado do site | Dados de exemplo sem API. | Removido (issue #49); para demonstrar sem internet, usa-se o Docker. |
| Qualidade e entrega | Testes locais. | CI no GitHub Actions; o Render só publica depois do CI (issue #68). |
| IoT | Túnel temporário em HTTP. | Projeto público em HTTPS ligado à API publicada; projeto local para testes. |
| Validação com persona | Prevista. | Roteiro, questionário SUS e kit prontos (issue #50); aplicação pendente. |

Na versão 3.5 (26/11/2026), com as entregas da versão 2.0.0: descarte de efluentes de cada lote, com aviso de pH fora da CONAMA 430 e visão mensal de conformidade e reúso (issues #201 a #203), custo da água com o preço do m³ (issues #229 e #230), sinal de vida do sensor no Wokwi a cada 15 s (issue #218), auditoria de acessibilidade e teste de ponta a ponta dos efluentes (issues #212 e #213), teste da massa da demonstração (issue #210), ensaio de restauração com a massa (issue #219), auditoria de segurança antes do freeze (issue #216), Quality Gate depois dos efluentes (issue #211), README com badges (issue #217), plano C com o banco ao vivo para a disciplina de Banco de Dados (issues #225 e #227) e deck da feira ProjetAÍ (issue #215). Migrações Flyway V1 a V16.

Na versão 3.4 (20/11/2026), com as entregas das semanas de 17 a 21/11: relatório em planilha Excel (issue #159), telemetria do sensor validada e gravada (issues #156 e #157), saúde do sensor no monitoramento (issue #158), envio da fila offline em segundo plano (issue #160), carregamento sem saltos (issue #161), auditoria de descarte de efluentes no banco (issue #162), autovacuum das tabelas mais usadas (issue #163), turno industrial com 120 sensores (issue #165), Quality Gate no SonarQube (issue #168), SBOM da API e do site (issue #169), runbook de recuperação de desastres (issue #170), contêineres sem root (issue #171), auditoria de acessibilidade com axe-core (issue #172), disjuntor nos avisos do Telegram, teste de ponta a ponta do fluxo do alerta e avaliação heurística de usabilidade.

Na versão 3.3 (17/11/2026): o repositório passou a ser público, porque os minutos do GitHub Actions do plano grátis acabaram; antes, o histórico foi varrido atrás de senhas e tokens.

Na versão 3.2 (14/11/2026), com o sistema na versão 1.1.0: pegada hídrica por peça (issue #116), token de API do sensor (issues #103 e #129), reenvio dos avisos do Telegram (issue #97), gauge de tolerância (issue #98), filtros do histórico (issue #107), exportação em CSV pela API (issue #99), painel de eventos de segurança (issue #109), aviso de privacidade (LGPD, issue #117), contador do erro 429 (issue #101), contraste WCAG AA (issue #106), buffer do sensor sem Wi-Fi (issue #108), calibração do sensor (issue #114), vulnerabilidades e testes de mutação no CI (issues #112 e #102), imagem distroless e segredos como arquivos (issues #105 e #118), carga com 100 sensores (issue #113) e diagramas C4 (issue #111).

Na versão 3.1 (09/11/2026): glossário têxtil na interface (issue #55), aviso de lote crítico com buzzer e LED no sensor (issue #83), tema escuro (issue #82) e documentação nas normas ISO/IEC (seção 5.1), com a ERS migrada da IEEE 830 para a ISO/IEC/IEEE 29148. A US-15 (vários sensores por linha de lavagem, issue #47) foi adiada (seção 11.1).

### 11.1 Em aberto

- **Bancada física (seção 6):** a equipe propõe ficar no simulado; falta a ata assinada pelo orientador. **[A CONFIRMAR]**
- **Numeração das versões:** o parecer de 27/10/2026 orienta não declarar 1.0.0 antes da homologação; o parecer da Week 02 (10/11/2026) já cita a preparação da 1.1.0, lançada em 14/11/2026; a 2.0.0, a final, sai no code freeze de 27/11/2026, como pede o parecer da Week 04 (24/11/2026). A homologação com operador real segue como limitação registrada (issue #50). **[A CONFIRMAR]**
- **Regra de alerta:** hoje, cada nova sequência de 3 lotes acima da meta abre outro alerta, se a anterior foi interrompida; o parecer descreve o lote sendo anexado ao alerta já aberto. **[A CONFIRMAR]**
- **Item adiado:** vários sensores por linha de lavagem (US-15, RF31, issue #47). O sensor é simulado no Wokwi, que roda no navegador, e cada sensor a mais precisa de outra aba do simulador aberta ao mesmo tempo; no teste de 06/11/2026, com o computador carregado, um único sensor caiu para 3% da velocidade e a conexão segura com a API falhou. A API não é o limite: aceita lotes de vários dispositivos ao mesmo tempo (teste de carga com 50 sensores). Com sensores físicos, o caminho é uma conta de perfil sensor por linha de lavagem, sem mudar o banco. Detalhes no Apêndice B da ERS.
- **Numeração deste termo:** o parecer de 27/10/2026 cita um TAP v3.0 que não está no repositório; esta versão segue a numeração do repositório. **[A CONFIRMAR]**

## 12. Assinatura do Project Charter

Ao formalizar este documento, o aluno responsável e o orientador confirmam o compromisso com o escopo, a governança e as entregas do projeto.

| Papel | Nome | Assinatura e data |
|---|---|---|
| Aluno responsável | Pedro |  <br>  |
| Orientador | Fabio Cesar Figueiredo de Medeiros Chicout |  <br>  |

Equipe: Pedro, Abraão Filipe, João Bezerra, Matheus Andrade, Mateus Basilio e Paulo Moura.

# Parte 2 — Backlog de Histórias de Usuário

Backlog ágil no padrão INVEST, com critérios de aceitação no formato Given / When / Then. As histórias US-01 a US-05 vêm da versão 1.0; US-06 a US-09, das versões 2.0 e 2.1; US-10 a US-14 são novas nesta versão e vêm dos itens do parecer técnico de 27/10/2026. A situação de cada história é a de 05/11/2026.

## Épico 1: Confiabilidade e controle de acesso aos dados (AUTH)

### US-01 — Acesso autenticado e confiabilidade dos dados registrados

**Como** usuário da lavanderia, **quero** que apenas usuários autenticados possam registrar ou alterar dados de consumo, metas e lotes, **para que** os relatórios usados como comprovação de conformidade sejam confiáveis.

**Cenário 1 (login com sucesso):** Dado que sou um usuário cadastrado e ativo, quando informo usuário e senha corretos, então o sistema valida as credenciais na API e libera as funcionalidades do meu perfil.

**Cenário 2 (credencial inválida):** Dado que informo uma senha errada, quando aciono "Entrar", então o sistema exibe uma mensagem clara, sem expor detalhes, e nenhum dado de consumo fica acessível.

**Cenário 3 (usuário desativado):** Dado que meu acesso foi desativado, quando tento entrar, então o sistema exibe a mesma mensagem genérica, sem revelar que a conta está desativada.

**Cenário 4 (muitas tentativas):** Dado que alguém erra o login muitas vezes seguidas, quando passa do limite por minuto, então a API recusa novas tentativas por um tempo. *Novo na versão 3.0.*

**Rastreabilidade:** REQ-AUTH-01 (RF01, RF02, RF03; RNF19). **Situação:** implementada.

## Épico 2: Configuração de processos e metas (CORE)

### US-02 — Cadastro de meta por tipo de processo

**Como** gestor, **quero** cadastrar os tipos de processo de lavagem com uma meta de consumo de água para cada um, **para que** o sistema tenha uma referência para comparar o consumo de cada lote.

**Cenário 1 (cadastro válido):** Dado que informo o nome do processo e a meta em litros (por lote ou por peça), quando salvo, então o processo fica disponível no registro de lotes e a meta pode ser editada depois.

**Cenário 2 (meta inválida):** Dado que informo meta zero ou negativa, quando tento salvar, então o sistema impede o cadastro e exibe mensagem de erro.

**Rastreabilidade:** REQ-CORE-01 (RF04, RF05, RF06). **Situação:** implementada.

## Épico 3: Registro e monitoramento de consumo (OPS)

### US-03 — Registro de consumo por lote

**Como** operador, **quero** registrar, ao final de cada lote, o processo, as peças e os litros usados, **para que** o sistema calcule se o lote ficou dentro da meta.

**Cenário 1 (registro):** Dado que seleciono um processo e informo peças e litros, quando confirmo, então o sistema mostra na hora o desvio em relação à meta e salva o registro com data e hora.

**Cenário 2 (confirmação e imutabilidade):** Dado que preenchi o lote, quando aciono "Registrar lote", então o sistema pede confirmação com o resumo e informa que o lote não poderá ser editado.

**Rastreabilidade:** REQ-CORE-02 (RF07 a RF10). **Situação:** implementada.

### US-04 — Alerta por desvio recorrente

**Como** gestor, **quero** ser alertado quando uma sequência de lotes ficar acima da meta, **para que** eu investigue rapidamente problema de máquina, processo ou operação.

**Cenário 1 (disparo):** Dado que 3 ou mais lotes seguidos do mesmo processo passam da meta, quando o gestor acessa o sistema, então o alerta aparece de forma visível, com opção de marcá-lo como "em análise" ou "resolvido".

**Cenário 2 (detalhe):** Dado que existe um alerta aberto, quando o gestor abre o detalhe, então vê o processo e os lotes da sequência (data e hora, peças, litros, esperado e desvio) e pode alterar o status.

**Rastreabilidade:** REQ-CORE-03 (RF11, RF12). **Situação:** implementada.

## Épico 4: Relatórios e conformidade ambiental (REP)

### US-05 — Relatório histórico de consumo

**Como** gestor, **quero** um relatório mensal do consumo por processo, comparado à meta, **para que** eu tome decisões de eficiência e comprove conformidade perante clientes.

**Cenário 1 (geração):** Dado que escolhi o mês e o ano, quando peço o relatório, então vejo o total consumido, o total esperado e o desvio por processo, e posso baixá-lo em PDF.

**Rastreabilidade:** REQ-REP-01 (RF13, RF14, RF15). **Situação:** implementada.

## Épico 5: Gestão de usuários e conta (USR)

### US-06 — Gestão de usuários pelo administrador

**Como** administrador, **quero** cadastrar usuários e desativar ou reativar o acesso de quem sai ou volta à operação, **para que** somente pessoas autorizadas acessem o sistema e o histórico de quem registrou cada lote seja preservado.

**Cenário 1 (cadastro):** Dado que estou autenticado como administrador, quando cadastro um usuário com nome, usuário, senha e perfil, então ele passa a poder entrar, e não existe autocadastro na tela de login.

**Cenário 2 (desativar):** Dado que um usuário não deve mais acessar, quando o desativo e confirmo, então ele não consegue mais entrar, aparece como "Inativo" e seus lotes continuam no histórico.

**Cenário 3 (reativar):** Dado que existe um usuário inativo, quando o reativo, então ele volta a entrar com as mesmas credenciais.

**Cenário 4 (redefinir senha):** Dado que um usuário esqueceu a senha, quando a redefino, então a antiga deixa de valer na hora; a senha do administrador principal não pode ser redefinida por essa tela.

**Rastreabilidade:** RF17 a RF20. Na versão 3.0, essas ações passaram do gestor para o administrador. **Situação:** implementada.

### US-07 — Configurações da conta

**Como** usuário, **quero** alterar meu nome e minha senha, **para que** eu mantenha minha conta segura sem depender do administrador.

**Cenário 1 (alterar senha):** Dado que informo a senha atual, uma nova com no mínimo 8 caracteres e diferente da atual, e a confirmação, quando salvo, então a senha é atualizada.

**Cenário 2 (dados somente leitura):** Dado que abro as configurações, então posso editar o nome, enquanto usuário e perfil aparecem como definidos pelo administrador.

**Rastreabilidade:** RF21, RF22. **Situação:** implementada.

### US-10 — Auditoria das ações sobre contas

**Como** administrador, **quero** ver quem criou, desativou, reativou ou redefiniu a senha de cada conta, e quando, **para que** as ações administrativas sejam rastreáveis.

**Cenário 1 (registro):** Dado que alguém cria, desativa, reativa ou redefine a senha de uma conta, quando a ação é concluída, então fica um registro com a ação, quem fez, quem foi afetado e a data, que ninguém pode alterar nem apagar.

**Cenário 2 (consulta):** Dado que estou autenticado como administrador, quando abro a tela de Auditoria, então vejo os registros do mais recente ao mais antigo, com filtro por período e por ação; outros perfis não têm acesso.

**Rastreabilidade:** RF27; issues #16, #57 e #66. **Situação:** implementada.

## Épico 6: Histórico de lotes (HIS)

### US-08 — Consulta ao histórico de lotes

**Como** operador ou gestor, **quero** consultar os lotes registrados, com filtro por processo, **para que** o operador confira o que lançou e o gestor investigue desvios.

**Cenário 1 (operador):** Dado que sou operador, quando abro o histórico, então vejo só os lotes que registrei, com data e hora, processo, peças, litros, desvio e status.

**Cenário 2 (gestor):** Dado que sou gestor ou administrador, quando abro o histórico, então vejo todos os lotes, com quem registrou cada um.

**Rastreabilidade:** RF23. **Situação:** implementada.

### US-12 — Exportação do histórico em CSV

**Como** gestor, **quero** baixar os lotes do filtro atual numa planilha, **para que** eu entregue os dados a uma auditoria externa, como a da CPRH.

**Cenário 1 (exportação):** Dado que filtrei o histórico, quando clico em "Exportar CSV", então baixo um arquivo com todos os lotes do filtro (não só a página visível), em ordem cronológica, com data e hora de Recife, desvio e status por extenso, que abre corretamente no Excel.

**Rastreabilidade:** RF29; parecer item #20, issue #48. **Situação:** implementada.

## Épico 7: Operação em campo (OFF) — novo

### US-11 — Registro de lote com a conexão oscilando

**Como** operador, **quero** registrar o lote mesmo quando a Wi-Fi da lavanderia cai, **para que** nenhum lote se perca nem seja lançado em dobro.

**Cenário 1 (sem conexão):** Dado que estou sem conexão, quando registro um lote, então ele fica guardado no aparelho e aparece como pendente de envio.

**Cenário 2 (conexão volta):** Dado que há lotes guardados, quando a conexão volta, então eles são enviados sozinhos, na ordem em que foram feitos, e um reenvio não cria lote repetido.

**Rastreabilidade:** RF28; parecer item #26, issue #54. **Situação:** implementada.

## Épico 8: Alertas e acompanhamento (MON) — novo

### US-13 — Aviso de alerta fora do sistema

**Como** gestor, **quero** receber um aviso no celular quando um alerta for aberto, **para que** eu saiba do desvio sem precisar estar com o sistema aberto.

**Cenário 1 (aviso):** Dado que o aviso está configurado, quando um alerta é aberto, então chega uma mensagem no grupo do Telegram da lavanderia, com o processo, os lotes e o link do alerta.

**Cenário 2 (falha no aviso):** Dado que o Telegram está fora do ar, quando um alerta é aberto, então o lote e o alerta continuam gravados normalmente.

**Rastreabilidade:** RF30; parecer item #24, issue #52. **Situação:** implementada.

### US-14 — Gráficos no Dashboard

**Como** gestor, **quero** ver em gráficos a meta e o consumo por processo e por dia, **para que** eu enxergue rapidamente onde e quando o consumo saiu do previsto.

**Cenário 1 (gráficos):** Dado que há lotes no mês, quando abro o Dashboard, então vejo o gráfico de meta e consumo por processo e o de consumo por dia.

**Rastreabilidade:** RF16; issue #58. **Situação:** implementada.

## Épico 9: Simulação de IoT (IOT)

### US-09 — Simulação de sensor de vazão

**Como** equipe do projeto, **quero** simular um sensor de vazão que envie o consumo de cada lote à API, **para que** seja possível demonstrar o fluxo de dados de um dispositivo antes de decidir pelo físico.

**Cenário 1 (envio):** Dado que o simulador está em execução e a API está acessível, quando o lote é encerrado no simulador, então a API registra o lote como qualquer outro, e ele aparece no histórico como registrado por "Sensor de vazão (Wokwi)".

**Rastreabilidade:** RF25, RF26; trilha complementar da seção 6. **Situação:** implementada (fase 1), em HTTPS com a API publicada.

### US-15 — Vários sensores por linha de lavagem

**Como** gestor, **quero** identificar de qual linha de lavagem veio cada lote enviado por sensor, **para que** eu compare o consumo entre máquinas.

**Rastreabilidade:** RF31; parecer item #19, issue #47. **Situação:** **adiada** em 09/11/2026: o limite é o simulador do Wokwi, que roda no navegador, e não a API (seção 11.1 e Apêndice B da ERS).
