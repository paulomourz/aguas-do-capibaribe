<p align="center"><img src="../assets/logo-referencia.png" width="120" alt="Logo do Águas do Capibaribe"></p>

# Águas do Capibaribe — Especificação de Requisitos de Software (ERS)

**Sistema de Gestão de Consumo Hídrico por Lote em Lavanderias de Jeans do Agreste Pernambucano**

Elaborada conforme a norma ISO/IEC/IEEE 29148:2018 (Engenharia de requisitos), que substitui a IEEE Std 830-1998.

| Campo | Descrição |
|---|---|
| Versão | 2.6 |
| Data | 20 de novembro de 2026 |
| Base | Termo de Abertura do Projeto v3.4 (20/11/2026), pareceres técnicos do orientador (27/10, 03/11, 10/11 e 17/11/2026) e código do repositório em 20/11/2026 (branch develop, versão 1.2.0) |
| Equipe | Pedro (Full Stack / PO), Abraão Filipe (Back-end), João Bezerra (Back-end), Matheus Andrade (Front-end), Mateus Basilio (Banco de dados) e Paulo Moura (DevOps) |
| Orientador | Fabio Cesar Figueiredo de Medeiros Chicout |
| Instituição | Senac · Projeto Integrador |

### Histórico de revisões

| Versão | Data | Descrição | Autor |
|---|---|---|---|
| 1.0 | 27/10/2026 | Primeira versão da ERS, alinhada ao TAP v2.1 e ao sistema implementado. | Equipe Águas do Capibaribe |
| 1.1 | 02/11/2026 | Sistema publicado, versão 1.0.0 e issues do parecer: Flyway, HTTPS, usuário aguas_api, status na API, PDF e Docker. | Equipe Águas do Capibaribe |
| 1.2 | 05/11/2026 | Perfis de administrador e sensor, auditoria, registro sem conexão, exportação em CSV, aviso no Telegram, gráficos, limite de requisições, monitoramento, backup, desempenho medido, entrega contínua e remoção do modo simulado. | Equipe Águas do Capibaribe |
| 2.0 | 09/11/2026 | Migração da IEEE 830 para a ISO/IEC/IEEE 29148: estrutura nova, requisitos de negócio e dos stakeholders, conceito de operação, método de verificação em cada requisito, seção de verificação, conformidade com normas e matriz de rastreabilidade com a verificação. Glossário têxtil (RNF26) e aviso de lote crítico no sensor (RF26) implementados. RF31 (vários sensores por linha de lavagem) adiado (issue #47). | Equipe Águas do Capibaribe |
| 2.1 | 10/11/2026 | Adequação à LGPD (RNF27, issue #117): aviso de privacidade na tela de login, login de outras pessoas mascarado na API (auditoria e lista de usuários do gestor) e conferência dos dados pessoais do CSV e do PDF. Necessidade NS-05. | Equipe Águas do Capibaribe |
| 2.2 | 11/11/2026 | Painel de eventos de segurança na Auditoria (RF32, issue #109): logins aceitos e recusados, bloqueios por limite com o IP mascarado e trocas de senha, com exportação em JSON. | Equipe Águas do Capibaribe |
| 2.3 | 13/11/2026 | Exportação dos lotes de um período em CSV pela API (RF33, issue #99), em streaming e paginada, para a auditoria da CPRH. | Equipe Águas do Capibaribe |
| 2.4 | 14/11/2026 | Consolidação para a versão 1.1.0: pegada hídrica por peça (RF34, #116), token de API do sensor (RF35, #103 e #129), reenvio dos avisos pendentes do Telegram (RF30, #97), gauge de tolerância no resultado do lote (RF24, #98), buffer do sensor sem Wi-Fi (RF26, #108), contador do erro 429 (RNF19, #101), contraste WCAG AA (RNF13, #106), carga com 100 sensores e pool de 20 conexões (RNF17, #113), vulnerabilidades e testes de mutação no CI (RNF24, #112 e #102), proteção do ambiente de execução (RNF28, #105 e #118), migrações V1 a V11 e números de testes atuais. | Equipe Águas do Capibaribe |
| 2.5 | 14/11/2026 | Validação de usabilidade (RNF25, issue #50 encerrada): avaliação simulada por inspeção e teste com pessoas de fora da equipe; o teste com operador real de lavanderia fica registrado como limitação. | Equipe Águas do Capibaribe |
| 2.6 | 20/11/2026 | Consolidação para a versão 1.2.0, com as issues do parecer Week 03 (17/11/2026): relatório em planilha Excel (RF36, #159), telemetria do sensor validada e gravada (RF37, #156 e #157), saúde do sensor no Actuator (RNF20, #158), envio da fila em segundo plano (RF28, #160), carregamento sem saltos (RNF29, #161), disjuntor nos avisos do Telegram (RF30), auditoria de descarte de efluentes no banco (V12, #162), autovacuum das tabelas quentes (RNF22, #163), turno industrial com 120 sensores (RNF17, #165), Quality Gate no SonarQube e SBOM (RNF24, #168 e #169), runbook de recuperação de desastres (RNF21, #170), contêineres sem root (RNF28, #171), auditoria WCAG com axe-core (RNF13, #172), limite de login por conta (RNF19), migrações V1 a V14 e números de testes atuais. RNF28 passa para a seção 3.7.3. | Equipe Águas do Capibaribe |

<!-- sumario -->

# 1. Introdução

## 1.1 Propósito

Este documento especifica os requisitos do sistema Águas do Capibaribe: o que ele deve fazer, com que qualidade, sob quais restrições e como cada requisito é verificado. Serve de referência comum para a equipe de desenvolvimento, para o orientador na validação das entregas e para os testes de aceitação.

Público: orientador do projeto, integrantes da equipe e banca avaliadora.

## 1.2 Escopo

O Águas do Capibaribe é um sistema web que permite a lavanderias industriais de jeans cadastrar metas de consumo de água por tipo de processo de lavagem, registrar o consumo real de cada lote, comparar automaticamente o realizado com a meta, gerar alertas de desvio recorrente, avisar o gestor e emitir relatórios mensais.

Benefícios esperados: reduzir o custo com água comprada (poço e caminhão-pipa), dar rastreabilidade ao consumo perante clientes e órgãos ambientais (MPPE e CPRH) e apoiar decisões de eficiência com dados comparáveis.

Fora do escopo desta versão: sensores instalados em lavanderia real, tratamento físico de efluentes e emissão de certificação com validade jurídica. O protótipo físico de IoT depende do ponto de verificação do TAP (seção 6) e terá requisitos próprios se for aprovado.

## 1.3 Visão geral do produto

### 1.3.1 Perspectiva do produto

O sistema é independente e novo: não substitui nem se integra a um sistema existente. É composto por três partes, um cliente opcional e um serviço de aviso opcional:

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Front-end web | React 19, TypeScript, Vite 8, Tailwind CSS 4, PWA | Telas acessadas pelo navegador, no computador ou no celular; guarda lotes no aparelho quando a conexão cai. Nunca acessa o banco diretamente. |
| API REST (back-end) | Java 25 (LTS), Spring Boot 3.5, Spring Security, Spring Data JPA | Regras de negócio, autenticação, autorização por perfil, limite de requisições, monitoramento e acesso aos dados. |
| Banco de dados | PostgreSQL 18 | Persistência; calcula o esperado e impede alterar lotes e registros de auditoria (triggers). |
| Sensor simulado (opcional) | ESP32 no Wokwi | Mede a vazão de um lote e o envia à API, como mais um cliente. |
| Aviso (opcional) | Bot API do Telegram | Recebe da API o aviso de alerta aberto e o entrega num grupo. |

Fluxo: o navegador e o dispositivo falam com a API por HTTPS e JSON; só a API fala com o banco. O sistema publicado fica no Render (site e API) e no Neon (banco). No computador, o Docker Compose sobe banco, API e site, e o Wokwi chega à API local por um túnel temporário (cloudflared).

### 1.3.2 Funções do produto

- **Acesso:** login com quatro perfis (administrador, gestor, operador e sensor); sem autocadastro; limite de tentativas.
- **Processos e metas:** cadastro e edição de processos com meta por lote ou por peça.
- **Registro de lotes:** lançamento manual com confirmação, inclusive sem conexão, ou envio pelo sensor; cálculo do esperado e do desvio.
- **Alertas:** detecção de 3 lotes consecutivos acima da meta, tratamento do alerta e aviso no Telegram.
- **Acompanhamento:** Dashboard do mês com gráficos e relatório mensal por processo, com PDF e planilha Excel.
- **Sensor:** envio de lotes e de leituras de vazão (telemetria) pelo dispositivo, com a saúde do sensor no monitoramento.
- **Histórico:** consulta aos lotes, com visão restrita para o operador, e exportação em CSV.
- **Usuários e conta:** cadastro, desativação, reativação e redefinição de senha pelo administrador, com auditoria; troca de nome e senha pela própria pessoa.

### 1.3.3 Características dos usuários

| Perfil | Quem é | O que pode fazer |
|---|---|---|
| Operador | Operador de máquina no chão de fábrica. Pouca familiaridade com sistemas; usa o celular ou um computador compartilhado. | Registrar lotes, ver e exportar o histórico dos próprios lotes e alterar o próprio nome e senha. |
| Gestor | Dono ou gerente da lavanderia. Usa computador; toma decisões de custo e conformidade. | Tudo o que o operador faz, mais: Dashboard, alertas, relatórios, processos e metas; vê os lotes de todos e consulta a lista de usuários. |
| Administrador | Responsável pelo sistema na lavanderia. | Tudo o que o gestor faz, mais: cadastrar, desativar e reativar usuários, redefinir senhas e consultar a auditoria. |
| Sensor | Conta técnica do dispositivo (sensor.wokwi). | Apenas entrar na API, consultar processos e registrar lotes. Não entra no site. |

### 1.3.4 Limitações

- O sistema não exclui dados de uso: lotes e registros de auditoria são imutáveis e usuários são desativados, nunca apagados.
- Hospedagem em planos gratuitos: a API dorme depois de 15 minutos sem uso, e o plano grátis do Render bloqueia o envio de e-mail (portas SMTP), por isso o aviso usa o Telegram.
- Prazo acadêmico de cerca de 6 semanas, de 12/10/2026 até a entrega final em 23/11/2026.
- Os relatórios são gerenciais e não têm validade jurídica.
- O sensor é simulado (Wokwi): seus resultados não são medição real de lavanderia.

As restrições de projeto (pilha tecnológica, banco versionado, estrutura do front-end) estão na seção 3.6.

### 1.3.5 Necessidades de negócio e dos stakeholders

A ISO/IEC/IEEE 29148 pede que os requisitos de software sejam derivados das necessidades do negócio e das partes interessadas. A tabela abaixo resume essas necessidades, a partir do TAP (seções 3, 7 e 8), e indica os requisitos que as atendem.

| ID | Necessidade | Stakeholder | Atendida por |
|---|---|---|---|
| NB-01 | Reduzir o custo com água comprada, comparando o consumo de cada lote com uma meta. | Gestor da lavanderia | RF04 a RF09, RF13, RF16, RF24, RF34 |
| NB-02 | Descobrir cedo quando um processo passa a gastar demais. | Gestor da lavanderia | RF11, RF12, RF30 |
| NB-03 | Comprovar o consumo perante clientes e órgãos ambientais, com dados que não podem ser alterados. | Gestor, marca compradora, MPPE / CPRH | RF10, RF13 a RF15, RF29, RF33, RF36, RNF09 |
| NS-01 | Registrar o lote em poucos passos, no celular, mesmo com a conexão oscilando. | Operador de máquina | RF07, RF28, RNF12 a RNF14, RNF29 |
| NS-02 | Controlar quem acessa o sistema e saber quem mexeu nas contas. | Administrador do sistema | RF01 a RF03, RF17 a RF22, RF27, RF32 |
| NS-03 | Medir a água sem digitação, por um dispositivo. | Gestor e operador | RF25, RF26, RF35, RF37; RF31 adiado (Apêndice B) |
| NS-04 | Entender os termos técnicos dos processos de lavagem. | Operador e gestor | RNF26 |
| NS-05 | Saber quais dados pessoais o sistema guarda e não ter o próprio login exposto a quem não precisa dele (LGPD). | Operador, gestor e administrador | RNF27 |

### 1.3.6 Conceito de operação

Um dia típico na lavanderia:

1. O **administrador** cadastra as pessoas da equipe; o **gestor** cadastra os processos de lavagem e a meta de cada um.
2. Ao fim de cada lote, o **operador** registra no celular o processo, as peças e os litros, ou o **sensor** mede e envia o lote sozinho. Sem conexão, o lote fica no aparelho e é enviado depois.
3. A API calcula o desvio e classifica o lote (dentro da meta, atenção ou crítico). Se 3 lotes seguidos do mesmo processo passam da meta, abre um alerta e avisa o grupo do Telegram.
4. O **gestor** acompanha o Dashboard, analisa e resolve os alertas e, no fim do mês, baixa o relatório em PDF ou exporta o histórico em CSV.

## 1.4 Definições, acrônimos e abreviações

| Termo | Significado |
|---|---|
| Lote | Conjunto de peças processadas de uma vez numa máquina, num mesmo processo de lavagem. |
| Processo | Tipo de lavagem (ex.: estonagem, tingimento, amaciamento), com uma meta de consumo de água. |
| Meta | Litros de água previstos por lote ou por peça para um processo. |
| Esperado | Consumo previsto para um lote pela meta vigente no momento do registro. |
| Desvio | Diferença percentual entre o consumo real e o esperado: (real − esperado) ÷ esperado × 100. |
| Alerta | Aviso aberto quando 3 ou mais lotes consecutivos de um processo ficam acima da meta. |
| Administrador / Gestor / Operador / Sensor | Perfis de usuário (seção 1.3.3). |
| Administrador principal | Administrador criado automaticamente pela API (login padrão capibaribe.admin), que não pode ser desativado. |
| Auditoria | Registro permanente das ações de um administrador ou gestor sobre a conta de outra pessoa. |
| Fila do aparelho | Lotes registrados sem conexão, guardados no navegador (IndexedDB) até serem enviados. |
| Chave de envio | Identificador (UUID) que o site gera para cada lote e repete a cada nova tentativa, enviado no cabeçalho Idempotency-Key. |
| PWA | Progressive Web App: site que pode ser instalado e aberto como aplicativo. |
| API REST | Interface de programação sobre HTTP com dados em JSON, usada pelo front-end e pelo dispositivo IoT. |
| JWT | JSON Web Token: credencial de sessão emitida no login. |
| BCrypt | Algoritmo de hash usado para guardar senhas. |
| CI / CD | Integração contínua (testes automáticos a cada mudança) e entrega contínua (publicação automática depois dos testes). |
| IoT / ESP32 | Internet das Coisas; aqui, o sensor de vazão simulado no Wokwi, com o microcontrolador ESP32. |
| ERS / TAP | Especificação de Requisitos de Software (este documento) / Termo de Abertura do Projeto. |
| NB / NS | Necessidade de negócio / necessidade dos stakeholders (seção 1.3.5). |
| Stakeholder | Parte interessada: pessoa ou organização afetada pelo sistema ou que tem interesse nele. |
| Verificação | Confirmação, por evidência objetiva, de que um requisito foi atendido (seção 4). |
| RF / RNF | Requisito funcional / requisito não funcional. |
| MPPE / CPRH | Ministério Público de Pernambuco / Agência Estadual de Meio Ambiente. |

# 2. Referências

- ISO/IEC/IEEE 29148:2018 — Systems and software engineering — Life cycle processes — Requirements engineering.
- IEEE Std 830-1998 — IEEE Recommended Practice for Software Requirements Specifications (base das versões 1.x desta ERS).
- Termo de Abertura do Projeto e Backlog de Histórias de Usuário, versão 3.4 (docs/gestao/TAP.pdf).
- Pareceres técnicos do orientador (27/10, 03/11, 10/11 e 17/11/2026) e issues do repositório no GitHub.
- Registro de Decisões v1 da equipe (decisões P1, P3 e P7, citadas no TAP).
- Descrição da arquitetura (docs/tecnico/arquitetura.md, ISO/IEC/IEEE 42010).
- Documentação de testes (docs/tecnico/testes.md, ISO/IEC/IEEE 29119).
- Segurança da informação (docs/gestao/seguranca.md, ISO/IEC 27001) e ciclo de vida (docs/gestao/ciclo-de-vida.md, ISO/IEC 12207).
- Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD); aviso de privacidade na seção 6 de docs/gestao/seguranca.md.
- Contrato da API REST (docs/tecnico/api.md) e esquema do banco (migrações Flyway em backend/src/main/resources/db/migration).
- Teste de carga (docs/tecnico/teste-carga.md), análise de índices (docs/tecnico/desempenho-indices.md), manutenção do banco (docs/tecnico/manutencao-banco.md) e runbook de recuperação de desastres (docs/tecnico/runbook-disaster-recovery.md).
- Guia do sistema (docs/guia/, ISO/IEC/IEEE 26514), guia do sensor simulado (iot/LEIA-ME.md) e kit de validação de usabilidade (docs/validacao/).

# 3. Requisitos

Esta seção segue a organização da ISO/IEC/IEEE 29148: funções (3.1), desempenho (3.2), usabilidade (3.3), interfaces (3.4), banco de dados (3.5), restrições de projeto (3.6), atributos do sistema (3.7) e informações de apoio (3.8).

**Atributos de cada requisito.** Todo requisito tem identificador único, descrição, prioridade, origem (de onde veio), situação em 20/11/2026 e método de verificação. Prioridade: Essencial (sem ele o MVP não é entregue), Importante (esperado no MVP) e Desejável (trilha complementar).

**Características exigidas pela norma.** Cada requisito foi escrito para ser necessário (liga-se a uma necessidade da seção 1.3.5), sem ambiguidade (um só sentido, com valores e limites explícitos), completo, singular (uma capacidade por requisito), viável (está implementado ou planejado), verificável (tem método na seção 4) e rastreável (Apêndice C). Itens marcados com **[A CONFIRMAR]** dependem de decisão da equipe ou do orientador.

## 3.1 Funções

Os requisitos funcionais estão agrupados por funcionalidade. RF01 a RF15 seguem os grupos de rastreabilidade do TAP (REQ-AUTH-01, REQ-CORE-01 a 03 e REQ-REP-01); RF16 a RF26 cobrem o escopo das versões 2.0 e 2.1 do TAP; RF27 a RF31, o escopo da versão 3.0.

### 3.1.1 Autenticação e controle de acesso

#### RF01 — Autenticar usuário

| Atributo | Descrição |
|---|---|
| Descrição | O sistema deve permitir que um usuário cadastrado e ativo entre informando usuário e senha. |
| Entradas | Usuário (login) e senha. |
| Processamento | A API compara o login sem diferenciar maiúsculas e confere a senha com o hash BCrypt. Se estiver correto, emite um token JWT válido por 8 horas. A conta do sensor é recusada no site. |
| Saídas | Token de sessão e dados do usuário (nome, perfil). O site leva administrador e gestor ao Dashboard e o operador ao Registro de lotes. |
| Prioridade | Essencial |
| Origem | US-01, Cenário 1 · REQ-AUTH-01 |
| Situação | Implementado (POST /auth/login, GET /auth/me). |
| Verificação | Teste: loginMeESenhaErrada (integração com PostgreSQL); SegurancaWebTest. |

#### RF02 — Recusar credenciais inválidas sem expor detalhes

| Atributo | Descrição |
|---|---|
| Descrição | Quando o usuário ou a senha estiverem errados, ou a conta estiver desativada, o sistema deve recusar a entrada com a mesma mensagem genérica. |
| Entradas | Credenciais incorretas ou de conta inativa. |
| Processamento | A API responde 401 com o código CREDENCIAIS_INVALIDAS nos três casos, sem indicar qual deles ocorreu. Passando do limite de tentativas por minuto, responde 429 (RNF19). |
| Saídas | Mensagem "Usuário ou senha incorretos" na tela de login; o campo de senha é limpo. |
| Prioridade | Essencial |
| Origem | US-01, Cenários 2 a 4 · REQ-AUTH-01 |
| Situação | Implementado. |
| Verificação | Teste: loginMeESenhaErrada; LimiteDeRequisicoesTest (limite de tentativas). |

#### RF03 — Bloquear acesso sem autenticação ou sem permissão

| Atributo | Descrição |
|---|---|
| Descrição | Nenhuma funcionalidade nem dado de consumo deve ser acessível sem sessão válida, e cada perfil só acessa o que lhe é permitido (seção 1.3.3). |
| Entradas | Qualquer requisição à API ou acesso a uma tela. |
| Processamento | A API exige o token em todas as rotas, exceto o login e a saúde da API, e consulta o usuário no banco a cada requisição: se ele foi desativado, a sessão cai na hora. Rotas de administrador recusam os outros perfis; rotas de gestor recusam operador e sensor; o sensor só consulta processos e registra lotes. |
| Saídas | HTTP 401 (NAO_AUTENTICADO) ou 403 (ACESSO_NEGADO); no site, as telas "Faça login para continuar" e "Acesso negado". |
| Prioridade | Essencial |
| Origem | US-01 · REQ-AUTH-01 · issue #66 |
| Situação | Implementado. |
| Verificação | Teste: SegurancaWebTest; cadaPerfilAcessaSoOQueLheCabe e usuarioDesativadoPerdeAcessoNaProximaRequisicao (integração). |

### 3.1.2 Processos e metas

#### RF04 — Cadastrar processo de lavagem

| Atributo | Descrição |
|---|---|
| Descrição | O gestor deve poder cadastrar um tipo de processo com sua meta de consumo de água. |
| Entradas | Nome (até 80 caracteres, único sem diferenciar maiúsculas), unidade da meta ("por lote" ou "por peça") e valor da meta em litros. |
| Processamento | A API valida os campos, grava o processo e atualiza a lista de processos guardada em cache. |
| Saídas | Processo disponível para seleção no registro de lotes. |
| Prioridade | Essencial |
| Origem | US-02, Cenário 1 · REQ-CORE-01 |
| Situação | Implementado (POST /processos). |
| Verificação | Teste: ProcessoControllerTest; processoDuplicadoSemDiferenciarMaiusculas (integração). |

#### RF05 — Editar processo e meta

| Atributo | Descrição |
|---|---|
| Descrição | O gestor deve poder alterar o nome, a unidade e a meta de um processo já cadastrado. |
| Entradas | Os mesmos campos do RF04. |
| Processamento | A nova meta vale para os lotes registrados depois da alteração; lotes antigos mantêm o esperado calculado na época (RF09). A lista em cache é atualizada depois de gravar. |
| Saídas | Processo atualizado. |
| Prioridade | Essencial |
| Origem | US-02, Cenário 1 · REQ-CORE-01 |
| Situação | Implementado (PUT /processos/{id}). |
| Verificação | Teste: ProcessoControllerTest. |

#### RF06 — Rejeitar meta inválida

| Atributo | Descrição |
|---|---|
| Descrição | O sistema deve impedir o cadastro ou a edição de processo com meta igual a zero ou negativa. |
| Entradas | Meta ≤ 0, ou com mais de 8 dígitos inteiros ou 2 decimais. |
| Processamento | Validação no site e na API. |
| Saídas | HTTP 422 (VALIDACAO) com a mensagem "A meta deve ser maior que zero." junto ao campo. |
| Prioridade | Essencial |
| Origem | US-02, Cenário 2 · REQ-CORE-01 |
| Situação | Implementado. |
| Verificação | Teste: ProcessoControllerTest; validacoesDeProcessoAlinhadasAoBanco (SegurancaWebTest). |

### 3.1.3 Registro de lotes

#### RF07 — Registrar lote com confirmação

| Atributo | Descrição |
|---|---|
| Descrição | O operador, o gestor ou o administrador deve poder registrar um lote, informando processo, peças e litros. Antes de gravar, o sistema mostra um resumo e pede confirmação, avisando que o lote não poderá ser editado. |
| Entradas | Processo, peças (inteiro > 0) e litros (> 0, até 10 dígitos inteiros e 2 decimais). |
| Processamento | Validação no site e na API; gravação só após a confirmação. |
| Saídas | Lote gravado e tela de resultado (RF09). |
| Prioridade | Essencial |
| Origem | US-03, Cenários 1 e 2 · REQ-CORE-02 |
| Situação | Implementado (POST /lotes). |
| Verificação | Teste e Demonstração: CicloCompletoLavanderiaE2ETest; processoInexistenteNoLoteRetorna422. A confirmação antes de gravar é demonstrada na tela de Registro de lotes. |

#### RF08 — Gravar data, hora e autor automaticamente

| Atributo | Descrição |
|---|---|
| Descrição | A data, a hora e o usuário que registrou o lote devem ser definidos pelo sistema, sem digitação. |
| Entradas | — |
| Processamento | A data vem do servidor; o autor vem do token da sessão, nunca do corpo da requisição. |
| Saídas | Lote com data e hora (ISO 8601) e identificação do autor. |
| Prioridade | Essencial |
| Origem | US-03 · REQ-CORE-02 |
| Situação | Implementado. |
| Verificação | Teste: CicloCompletoLavanderiaE2ETest (data e autor gravados pela API). |

#### RF09 — Calcular esperado e desvio do lote

| Atributo | Descrição |
|---|---|
| Descrição | Ao registrar um lote, o sistema deve calcular o consumo esperado pela meta e o desvio percentual, e exibi-los na hora. |
| Entradas | Lote registrado e meta vigente do processo. |
| Processamento | Esperado = meta × peças (meta por peça) ou meta (meta por lote), calculado pelo banco no registro. Desvio = (real − esperado) ÷ esperado × 100, com 2 casas decimais. |
| Saídas | Tela de resultado com consumo esperado, consumo real, diferença em litros, desvio e status (RF24). |
| Prioridade | Essencial |
| Origem | US-03, Cenário 1 · REQ-CORE-02 |
| Situação | Implementado. |
| Verificação | Teste: esperadoVemDoTriggerEDesvioDaFormulaDaView (integração); desvioUsaAMesmaFormulaDaView (RegrasSimplesTest). |

#### RF10 — Manter o lote imutável

| Atributo | Descrição |
|---|---|
| Descrição | Depois de registrado, um lote não pode ser editado nem excluído, por nenhum perfil. |
| Entradas | — |
| Processamento | A API não oferece rota de alteração ou exclusão de lote, e o banco bloqueia UPDATE e DELETE na tabela de lotes (trigger trg_lote_imutavel). |
| Saídas | — |
| Prioridade | Essencial |
| Origem | US-03, Cenário 2 · decisão P3 |
| Situação | Implementado. |
| Verificação | Teste: loteNaoPodeSerAlteradoNemExcluido (integração, direto no banco). |

#### RF28 — Registrar lote sem conexão, sem duplicar

| Atributo | Descrição |
|---|---|
| Descrição | Sem conexão, o lote deve ficar guardado no aparelho e ser enviado depois, sem perda nem duplicação. |
| Entradas | Lote registrado com o aparelho sem conexão, ou com a resposta da API perdida. |
| Processamento | O site guarda o lote no IndexedDB com uma chave de envio (UUID) e o envia quando a conexão volta, na ordem em que foi feito, repetindo a mesma chave a cada tentativa. A API devolve o lote já gravado quando recebe uma chave repetida; a chave usada com outros dados ou por outro usuário é recusada (409 CHAVE_DE_ENVIO_REPETIDA). O lote recusado por validação fica para o operador descartar. Nos navegadores com Background Sync (Chrome, Edge e Android), o service worker envia a fila sozinho quando a conexão volta, mesmo com a aba fechada, pela mesma regra e com a mesma chave; o token fica no IndexedDB só enquanto houver lote esperando (issue #160). No Firefox e no Safari, a página envia a fila quando está aberta. |
| Saídas | Contador de lotes pendentes no cabeçalho; lista "guardados no aparelho" com enviar agora, tentar de novo e descartar; selo "Sincronizado" por 5 segundos quando a fila chega ao servidor. |
| Prioridade | Importante |
| Origem | US-11 · parecer, item #26 · issues #54 e #160 |
| Situação | Implementado. |
| Verificação | Teste: sincronizacao.test.ts (fila no aparelho), envioSegundoPlano.test.ts e sw.test.ts (service worker); e2e/offline.spec.ts e e2e/backgroundSync.spec.ts (Playwright, conexão caindo e voltando, aba fechada); reenvioComAMesmaChaveNaoDuplicaOLote e bancoRecusaChaveDeEnvioDuplicadaMesmoSemPassarPelaApi (integração). |

### 3.1.4 Alertas de desvio recorrente

#### RF11 — Gerar alerta por desvio recorrente

| Atributo | Descrição |
|---|---|
| Descrição | O sistema deve abrir um alerta quando 3 ou mais lotes consecutivos do mesmo processo ficarem acima da meta. |
| Entradas | Cada novo lote registrado. |
| Processamento | Regra detalhada no Apêndice D. "Acima da meta" significa litros > esperado, sem tolerância. Novos lotes acima da meta entram no alerta aberto da mesma sequência. **[A CONFIRMAR]** se uma nova sequência deve abrir outro alerta ou entrar no alerta ainda aberto do processo. |
| Saídas | Alerta com status "aberto", visível no Dashboard e na tela Alertas, e aviso no Telegram (RF30). |
| Prioridade | Essencial |
| Origem | US-04, Cenário 1 · REQ-CORE-03 |
| Situação | Implementado. |
| Verificação | Teste: RegraDeAlertaTest; regraDeAlertaTresConsecutivosEAnexacao (integração). |

#### RF12 — Acompanhar e tratar alertas

| Atributo | Descrição |
|---|---|
| Descrição | O gestor deve poder ver o detalhe de um alerta e mudar seu status. |
| Entradas | Alerta escolhido e novo status. |
| Processamento | Transições aceitas: aberto → em análise, aberto → resolvido, em análise → resolvido. Qualquer outra é recusada (409 TRANSICAO_INVALIDA). |
| Saídas | Detalhe com processo e lotes da sequência (data e hora, peças, litros, esperado e desvio); lista filtrável por status. |
| Prioridade | Essencial |
| Origem | US-04, Cenário 2 · REQ-CORE-03 |
| Situação | Implementado (GET /alertas, PATCH /alertas/{id}/status). |
| Verificação | Teste: alertaResolvidoNaoReaproveitaLotesETransicoesSaoValidadas (integração); transicoesDeStatusDoAlertaSeguemATela. |

#### RF30 — Avisar no Telegram quando um alerta for aberto

| Atributo | Descrição |
|---|---|
| Descrição | Quando um alerta for aberto, o sistema deve avisar num grupo do Telegram, sem atrasar nem colocar em risco o registro do lote. |
| Entradas | Alerta aberto; variáveis TELEGRAM_TOKEN, TELEGRAM_CHAT_ID e, opcionalmente, SITE_URL. |
| Processamento | O envio acontece depois que o lote foi gravado, em outra thread e com fila limitada. Se falhar, a API tenta até 3 vezes, com espera crescente; persistindo a falha, o aviso fica em aviso_pendente, e uma rotina a cada 5 minutos o reenvia enquanto o alerta estiver aberto, por até 24 horas, marcando enviado_em quando chega (issue #97). Um disjuntor (circuit breaker, Resilience4j) olha as últimas 10 chamadas e abre com 50% ou mais de falhas: aberto, a chamada é recusada na hora, sem rede, e o aviso vai direto para aviso_pendente; depois de 1 minuto, uma chamada de teste confere se o Telegram voltou. Respostas 401 e 400 (token ou grupo errado) não abrem o disjuntor. Nenhum log leva o token. Sem token e chat configurados, o aviso fica desligado. |
| Saídas | Mensagem com o processo, os 3 lotes, o número do alerta e o link para ele. |
| Prioridade | Desejável |
| Origem | US-13 · parecer, item #24 · issue #52 |
| Situação | Implementado e testado com o sistema publicado. |
| Verificação | Teste e Demonstração: AvisoDeAlertaTest, ReenvioDeAvisosTest, DisjuntorDoTelegramTest; alertaAbertoAvisaNoTelegramDepoisDeGravar e telegramForaDoArNaoAtrapalhaORegistroDoLote (integração). Demonstrado no sistema publicado em 05/11/2026. |

### 3.1.5 Relatórios e acompanhamento

#### RF13 — Gerar relatório mensal por processo

| Atributo | Descrição |
|---|---|
| Descrição | O gestor deve poder ver, para um mês, o total consumido, o total esperado e o desvio de cada processo. |
| Entradas | Mês e ano. |
| Processamento | Soma dos lotes do mês no fuso America/Recife; aparecem só os processos com lotes no período. |
| Saídas | Tabela por processo e totais gerais. |
| Prioridade | Essencial |
| Origem | US-05 · REQ-REP-01 |
| Situação | Implementado (GET /relatorios/resumo). |
| Verificação | Teste: resumoMensalUsaFusoDeRecife (integração); CicloCompletoLavanderiaE2ETest. |

#### RF14 — Filtrar o relatório por mês e ano

| Atributo | Descrição |
|---|---|
| Descrição | O relatório deve ser filtrável por mês (1 a 12) e ano. |
| Entradas | Mês e ano. |
| Processamento | Validação do período na API. |
| Saídas | Relatório do período escolhido. |
| Prioridade | Essencial |
| Origem | US-05 · REQ-REP-01 |
| Situação | Implementado. |
| Verificação | Teste: resumoMensalUsaFusoDeRecife; mesInvalidoNoRelatorioRetorna422. |

#### RF15 — Exportar o relatório em PDF

| Atributo | Descrição |
|---|---|
| Descrição | O gestor deve poder obter o relatório mensal em PDF. |
| Entradas | Relatório do período. |
| Processamento | Pré-visualização em formato A4; o arquivo é gerado no navegador. |
| Saídas | Arquivo PDF do relatório. |
| Prioridade | Importante |
| Origem | US-05 · REQ-REP-01 |
| Situação | Implementado (botão "Baixar PDF"). |
| Verificação | Demonstração: Download do PDF na tela de Relatórios, com a pré-visualização A4. |

#### RF36 — Exportar o relatório em planilha Excel

| Atributo | Descrição |
|---|---|
| Descrição | O gestor deve poder baixar o relatório do período escolhido em planilha Excel (.xlsx), com fórmulas que ele possa conferir e reaproveitar. |
| Entradas | Período escolhido na tela de Relatórios. |
| Processamento | O arquivo é gerado no navegador com o ExcelJS, carregado só no primeiro clique. Aba "Lotes": um lote por linha, em ordem cronológica, com linha de total; aba "Resumo por processo": os totais de cada processo. Soma, diferença, desvio e litros por peça são fórmulas, com o resultado já guardado; o desvio é colorido pelas faixas do RF24. |
| Saídas | Arquivo aguas-do-capibaribe-relatorio-AAAA-MM.xlsx, com o cabeçalho da empresa, filtro e cabeçalho congelado. Sem lotes no período, o botão fica desabilitado. |
| Prioridade | Desejável |
| Origem | Issue #159 (parecer Week 03) · NB-03 |
| Situação | Implementado (botão "Exportar para Excel (.xlsx)"). |
| Verificação | Teste: exportToExcel.test.ts (gera o arquivo e lê de volta célula por célula), relatorios.test.ts e e2e/planilha.spec.ts (baixa e abre o .xlsx). |

#### RF16 — Exibir o Dashboard do gestor

| Atributo | Descrição |
|---|---|
| Descrição | Ao entrar, o gestor deve ver os indicadores do mês, os alertas ativos, o resumo por processo e os gráficos de consumo. |
| Entradas | — |
| Processamento | Usa os dados do RF13 para o mês atual, os lotes do mês e os alertas abertos ou em análise. |
| Saídas | Consumo total do mês, total esperado, desvio geral, alertas ativos, resumo por processo, gráfico de meta e consumo por processo e gráfico de consumo por dia. |
| Prioridade | Importante |
| Origem | TAP, seção 4.1 · US-14 · issue #58 |
| Situação | Implementado. |
| Verificação | Demonstração: Dashboard com indicadores, alertas e gráficos, aberto com o perfil gestor. |

### 3.1.6 Usuários, conta e auditoria

#### RF17 — Cadastrar usuário (somente administrador)

| Atributo | Descrição |
|---|---|
| Descrição | O administrador deve poder cadastrar usuários com perfil administrador, gestor ou operador. Não existe autocadastro. |
| Entradas | Nome (até 120 caracteres), usuário (3 a 60 caracteres: a-z, 0-9, ponto, hífen e sublinhado; único), senha (8 a 72 bytes) e confirmação, perfil. |
| Processamento | A API valida, grava o login em minúsculas, guarda só o hash BCrypt da senha e registra a criação na auditoria. |
| Saídas | Usuário criado e já apto a entrar. |
| Prioridade | Essencial |
| Origem | US-06, Cenário 1 · issue #66 |
| Situação | Implementado (POST /usuarios). |
| Verificação | Teste: criarUsuarioEDuplicidade (integração); criarUsuarioFicaNaAuditoria. |

#### RF18 — Desativar e reativar acesso

| Atributo | Descrição |
|---|---|
| Descrição | O administrador deve poder desativar o acesso de quem sai da operação e reativá-lo depois. Usuários nunca são excluídos. |
| Entradas | Usuário e novo estado. |
| Processamento | Ninguém desativa a si mesmo nem o administrador principal. Os lotes do usuário continuam no histórico. A ação é registrada na auditoria. |
| Saídas | Usuário marcado como "Inativo" ou "Ativo"; o inativo não consegue mais entrar (RF02, RF03). |
| Prioridade | Essencial |
| Origem | US-06, Cenários 2 e 3 |
| Situação | Implementado (PATCH /usuarios/{id}/ativo). |
| Verificação | Teste: desativarEReativarFicamNaAuditoriaQueNaoPodeSerAlteradaNemApagada; usuarioDesativadoPerdeAcessoNaProximaRequisicao. |

#### RF19 — Redefinir a senha de outra pessoa

| Atributo | Descrição |
|---|---|
| Descrição | O administrador deve poder definir uma nova senha para quem esqueceu a sua. |
| Entradas | Usuário e nova senha (8 a 72 bytes) com confirmação. |
| Processamento | A senha antiga deixa de valer na hora. Não se aplica à própria conta nem ao administrador principal. A ação é registrada na auditoria. |
| Saídas | Confirmação para entregar a nova senha à pessoa. |
| Prioridade | Importante |
| Origem | US-06, Cenário 4 |
| Situação | Implementado (PATCH /usuarios/{id}/senha). |
| Verificação | Teste: administradorRedefineSenhaDeOutraPessoa (integração); redefinirSenhaRegistraGestorAfetadoEAcao. |

#### RF20 — Criar as contas iniciais

| Atributo | Descrição |
|---|---|
| Descrição | O sistema deve sempre ter um administrador principal, criado automaticamente, e pode criar também a conta do gestor e a do sensor. |
| Entradas | ADMIN_LOGIN (padrão capibaribe.admin), ADMIN_NOME e ADMIN_SENHA; opcionalmente GESTOR_SENHA (capibaribe.gestor) e SENSOR_SENHA (sensor.wokwi). |
| Processamento | Ao iniciar, a API cria cada conta que não existir e tiver senha definida. Se já existir, a senha não muda. Sem administrador e sem ADMIN_SENHA, a API não sobe. |
| Saídas | Contas iniciais disponíveis. |
| Prioridade | Essencial |
| Origem | TAP, seção 4.1 · US-06 · issue #66 |
| Situação | Implementado. |
| Verificação | Teste: AdminInicialTest, GestorInicialTest, SensorInicialTest; administradorPrincipalCriadoNaInicializacaoENaoPodeSerDesativado. |

#### RF21 — Alterar o próprio nome

| Atributo | Descrição |
|---|---|
| Descrição | Todo usuário deve poder alterar o próprio nome. Usuário (login) e perfil aparecem somente para leitura. |
| Entradas | Novo nome. |
| Processamento | Cada pessoa só altera a própria conta (403 para a conta de outra pessoa). |
| Saídas | Nome atualizado. |
| Prioridade | Importante |
| Origem | US-07, Cenário 2 |
| Situação | Implementado (PATCH /usuarios/{id}). |
| Verificação | Demonstração: Troca do nome na tela de Configurações da conta. |

#### RF22 — Alterar a própria senha

| Atributo | Descrição |
|---|---|
| Descrição | Todo usuário do site deve poder trocar a própria senha. |
| Entradas | Senha atual, nova senha (mínimo de 8 caracteres e diferente da atual) e confirmação. |
| Processamento | A API confere a senha atual antes de trocar. |
| Saídas | Mensagem de sucesso; a nova senha vale no próximo acesso. |
| Prioridade | Importante |
| Origem | US-07, Cenário 1 |
| Situação | Implementado. |
| Verificação | Teste: trocaDeSenhaExigeSenhaAtual (integração). |

#### RF27 — Registrar e consultar a auditoria das contas

| Atributo | Descrição |
|---|---|
| Descrição | Toda criação, desativação, reativação e redefinição de senha de uma conta deve ficar registrada, e o administrador deve poder consultar esses registros. |
| Entradas | Ação sobre uma conta; na consulta, período, tipo de ação e página. |
| Processamento | A API grava o registro na mesma transação da ação; o banco impede alterar ou apagar registros (trigger trg_auditoria_imutavel). A consulta é só do administrador e lista do mais recente ao mais antigo. |
| Saídas | Tela de Auditoria com data e hora, ação, quem fez e quem foi afetado (nome inteiro e login mascarado, RNF27); nenhuma senha ou hash aparece. |
| Prioridade | Importante |
| Origem | US-10 · issues #16, #57 e #66 |
| Situação | Implementado (GET /auditoria). |
| Verificação | Teste: AuditoriaUsuarioTest; AuditoriaServiceTest; auditoriaListaAsAcoesComFiltrosEPaginacao (integração). |

#### RF32 — Consultar os eventos de segurança

| Atributo | Descrição |
|---|---|
| Descrição | O administrador deve poder ver as tentativas de login, os bloqueios pelo limite de requisições e as trocas de senha, e exportar esses números. |
| Entradas | Tipo de evento (todos, logins, bloqueios ou trocas de senha). |
| Processamento | A API conta os eventos em memória, com contadores do Micrometer (também em /api/actuator/metrics), desde o último início, sem tabela no banco. Os bloqueios guardam a rota, o IP mascarado, o primeiro e o último horário e a quantidade, no máximo 100 linhas. Nenhuma senha é guardada. A consulta é só do administrador. |
| Saídas | Aba Eventos de segurança da tela Auditoria: logins aceitos e recusados, bloqueios por limite (login e registro de lotes), senhas trocadas e redefinidas, tabela dos bloqueios com IP mascarado, horários e tentativas, e exportação em JSON. Os números zeram quando a API reinicia, e a tela diz desde quando valem. |
| Prioridade | Desejável |
| Origem | Issue #109 (ISO/IEC 27001, registro de eventos) |
| Situação | Implementado (GET /auditoria/seguranca). |
| Verificação | Teste: EventosDeSegurancaTest; bloqueioDoLoginApareceNoPainelDeSegurancaComOIpMascarado; eventosDeSegurancaSoParaOAdmin; mascaraOIpMostrandoSoARede; segurancaJson.test.ts. |

### 3.1.7 Histórico de lotes

#### RF23 — Consultar o histórico de lotes

| Atributo | Descrição |
|---|---|
| Descrição | Os usuários do site devem poder consultar os lotes registrados, do mais recente ao mais antigo, com filtros por período, processo e quem registrou. |
| Entradas | Filtros opcionais e combináveis: período (data inicial e final, em dias do fuso America/Recife), processo e, para gestor e administrador, quem registrou (pessoa ou sensor). |
| Processamento | O operador vê apenas os lotes que registrou; gestor e administrador veem todos. O operador recebe 404 ao pedir um lote de outra pessoa. |
| Saídas | Lista com data e hora, processo, peças, litros, desvio e status; para gestor e administrador, também quem registrou. |
| Prioridade | Essencial |
| Origem | US-08, Cenários 1 e 2 · issue #107 (filtros) |
| Situação | Implementado (GET /lotes, GET /lotes/{id}). |
| Verificação | Teste: operadorVeSoOsPropriosLotes e historicoFiltraPorQuemRegistrouSoParaGestor (integração); filtroLotes.test.ts. |

#### RF29 — Exportar o histórico em CSV

| Atributo | Descrição |
|---|---|
| Descrição | O usuário deve poder baixar os lotes do filtro atual em CSV, para auditoria externa. |
| Entradas | Lotes do filtro atual, com os mesmos filtros do histórico (período, processo e quem registrou), todos, não só a página visível. |
| Processamento | O site gera o arquivo em ordem cronológica, com separador ";", vírgula decimal, BOM para o Excel, data e hora de Recife e em UTC, e protege contra fórmulas em textos digitados. |
| Saídas | Arquivo CSV com id, data, hora, processo, peças, litros, esperado, diferença, desvio, status e quem registrou. |
| Prioridade | Importante |
| Origem | US-12 · parecer, item #20 · issue #48 |
| Situação | Implementado. |
| Verificação | Teste: historicoCsv.test.ts. |

#### RF33 — Exportar os lotes de um período em CSV pela API

| Atributo | Descrição |
|---|---|
| Descrição | O gestor deve poder baixar da API todos os lotes de um período, de até 1 ano, em CSV, para a auditoria fiscal e ambiental (CPRH). |
| Entradas | Data inicial e final (inclusivas, no fuso America/Recife) e, opcionalmente, o processo. |
| Processamento | A API confere o período e o processo antes de responder (422 se inválidos). Depois envia o arquivo em streaming: BOM e cabeçalho na hora, e os lotes de 1.000 em 1.000, por paginação por cursor (data e hora de registro e id), sem guardar o arquivo inteiro na memória. Mesmo formato do RF29. |
| Saídas | Arquivo CSV com id, data, hora, data e hora em UTC, processo, peças, litros, esperado, diferença, desvio, status e quem registrou (só o nome). |
| Prioridade | Desejável |
| Origem | Issue #99 (conformidade com a CPRH) |
| Situação | Implementado (GET /relatorios/csv). |
| Verificação | Teste: CsvDeLotesTest; csvDoPeriodoUsaFusoDeRecifeFiltraPorProcessoEProtegeTextos, csvComMilharesDeLotesNaMesmaHoraNaoRepeteNemPulaNenhum (50.000 lotes) e csvConfereOPeriodoEOProcessoAntesDeComecarESoParaGestor (integração). |

#### RF34 — Mostrar a pegada hídrica por peça

| Atributo | Descrição |
|---|---|
| Descrição | O sistema deve mostrar quantos litros de água cada peça consumiu, em média, por processo e no total do mês, ao lado da referência da literatura. |
| Entradas | Lotes do mês (litros e peças). |
| Processamento | A API soma litros e peças por processo no resumo mensal e calcula litros por peça = litros ÷ peças, com 2 casas (sem peças, não há valor). O site calcula o total do mês da mesma forma e compara com a referência de 49 a 70 L por peça da lavanderia completa (docs/tecnico/glossario-textil.md). |
| Saídas | Indicador "Água por peça" no Dashboard; coluna "L/peça" no resumo do Dashboard, no Relatório, na pré-visualização e no PDF. |
| Prioridade | Desejável |
| Origem | Issue #116 (backlog do parecer Week 02) · NB-01 |
| Situação | Implementado (campos pecas e litrosPorPeca em GET /relatorios/resumo). |
| Verificação | Teste: PegadaHidricaTest; resumoMensalUsaFusoDeRecife (integração); pegada.test.ts. |

### 3.1.8 Indicação visual de status

#### RF24 — Classificar o lote por faixa de desvio

| Atributo | Descrição |
|---|---|
| Descrição | Cada lote deve ser classificado como "dentro da meta" (verde), "atenção" (amarelo) ou "crítico" (vermelho), sempre com cor, ícone e texto juntos. |
| Entradas | Desvio do lote. |
| Processamento | Até 0% = dentro da meta; acima de 0% e até 8% = atenção; acima de 8% = crítico (decisão P1). |
| Saídas | Status exibido no resultado do registro, com um gauge semicircular das faixas (issue #98), no histórico, nos alertas e no CSV. |
| Prioridade | Importante |
| Origem | TAP, seção 4.1 · decisão P1 |
| Situação | Implementado: a API classifica cada lote (statusConformidade); totais e médias são classificados no site, com os mesmos limites. |
| Verificação | Teste: faixaDeConformidadeRespeitaAsFronteiras (RegrasSimplesTest). |

### 3.1.9 Sensor de vazão (IoT)

#### RF25 — Receber lotes enviados por dispositivo

| Atributo | Descrição |
|---|---|
| Descrição | A API deve aceitar lotes enviados por um dispositivo de medição, pelo mesmo caminho do registro manual. |
| Entradas | Login da conta do dispositivo (sensor.wokwi, perfil sensor) e lote com processo, peças e litros medidos. |
| Processamento | O dispositivo manda o token de API da conta de sensor em cada requisição (RF35), consulta os processos e chama POST /lotes. Valem as mesmas regras de RF07 a RF11. |
| Saídas | Lote gravado e identificado no histórico como registrado por "Sensor de vazão (Wokwi)". |
| Prioridade | Desejável |
| Origem | US-09 · TAP, seção 6 |
| Situação | Implementado. |
| Verificação | Teste e Demonstração: SensorInicialTest; cadaPerfilAcessaSoOQueLheCabe. Lotes enviados pelo Wokwi à API publicada. |

#### RF35 — Autenticar o sensor por token de API

| Atributo | Descrição |
|---|---|
| Descrição | O dispositivo deve se identificar por um token de API da conta de sensor, sem login nem senha, e o administrador deve poder trocar esse token a qualquer momento. |
| Entradas | Token de 64 letras e números no cabeçalho Authorization: Bearer; rotação pelo administrador em Usuários. |
| Processamento | A API guarda só o SHA-256 do token (V9). Cada requisição procura a conta pelo hash e só autentica conta de sensor ativa. A rotação gera outro token com sorteio seguro, mostra-o uma única vez e invalida o anterior na hora, com registro ROTACAO_TOKEN na auditoria (issue #103). O sketch do Wokwi usa o token em vez da senha (issue #129). |
| Saídas | Token novo exibido uma vez na tela Usuários; 401 para token antigo, desconhecido ou de conta desativada. |
| Prioridade | Desejável |
| Origem | Issues #103 e #129 (parecer Week 02) · NS-02, NS-03 |
| Situação | Implementado (POST /usuarios/{id}/token/rotacao). |
| Verificação | Teste: TokenDeApiTest, RotacaoTokenTest e SegurancaWebTest. Demonstração: sensor no Wokwi com o token. |

#### RF37 — Receber e gravar a telemetria do sensor

| Atributo | Descrição |
|---|---|
| Descrição | A API deve receber as leituras de vazão do sensor, recusar as inválidas e guardar as válidas como histórico de medição, que não se altera. |
| Entradas | POST /telemetria com processoId e vazaoLitros, autenticado pelo token do sensor (RF35) ou por JWT. |
| Processamento | Bean Validation antes da regra de negócio: processoId obrigatório e maior que zero; vazaoLitros obrigatória, de 0 a 10000 e com até 2 casas decimais (issue #156). A leitura válida é gravada na tabela telemetria (V14) no nome de quem enviou, com a hora do servidor; processo inexistente é recusado no campo processoId (issue #157). O aguas_api só lê e insere. A última leitura alimenta a saúde do sensor (RNF20). |
| Saídas | 201 com a leitura gravada; 400 TELEMETRIA_INVALIDA com a mensagem de cada campo; 422 para processo inexistente; 401 sem autenticação. |
| Prioridade | Desejável |
| Origem | Issues #156 e #157 (parecer Week 03) · NS-03 |
| Situação | Implementado (POST /telemetria). |
| Verificação | Teste: TelemetriaControllerTest (@WebMvcTest: 201, 400 por regra e 401); sensorRegistraTelemetriaQueFicaGravadaNoNomeDeleENaoPodeSerAlterada (integração). |

#### RF26 — Medir o lote no dispositivo

| Atributo | Descrição |
|---|---|
| Descrição | O dispositivo simulado deve medir a água de um lote e enviá-lo ao final. |
| Entradas | Vazão (potenciômetro, 0 a 30 L/min) e botão de iniciar/encerrar. |
| Processamento | O 1º toque no botão inicia o lote e acende o LED; o dispositivo conta os pulsos e calcula os litros pelo coeficiente K configurado no sketch (referência YF-S201, cerca de 450 pulsos por litro). No modo de calibração, o dispositivo mostra os pulsos e o K calculado e não envia o lote (issue #114). O 2º toque encerra; se a água medida for maior que zero, o dispositivo localiza o processo pelo nome e envia o lote. |
| Saídas | Monitor serial com a vazão, o total acumulado, o resultado do envio (HTTP 201) e o status do lote devolvido pela API. Se o status for crítico (desvio acima de 8%), o buzzer apita 3 vezes e o LED vermelho pisca e fica aceso até o próximo lote. Sem Wi-Fi, cada lote encerrado fica num buffer de até 100 leituras na memória e é enviado quando a conexão volta, com chave Idempotency-Key própria, sem duplicar (issue #108). |
| Prioridade | Desejável |
| Origem | US-09 · TAP, seção 6 |
| Situação | Implementado (pasta iot/). |
| Verificação | Demonstração: Wokwi em 06/11/2026: lote de 19,55 L classificado como crítico (LED vermelho aceso) e lote de 3,74 L dentro da meta. Buffer sem Wi-Fi: comando Q no monitor serial (iot/LEIA-ME.md). |

#### RF31 — Identificar a linha de lavagem de cada sensor

| Atributo | Descrição |
|---|---|
| Descrição | O sistema deve aceitar vários sensores e identificar de qual linha de lavagem veio cada lote. |
| Entradas | A definir. |
| Processamento | A definir. |
| Saídas | Lotes identificados por linha de lavagem. |
| Prioridade | Desejável |
| Origem | US-15 · parecer, item #19 · issue #47 |
| Situação | **Adiado** (09/11/2026, issue #47). Ver Apêndice B. |
| Verificação | Não se aplica nesta versão; o método de verificação será definido se o requisito voltar ao escopo. |

## 3.2 Requisitos de desempenho

| ID | Requisito | Situação |
|---|---|---|
| RNF17 | Registro de lote rápido com vários sensores ao mesmo tempo. Medido em 03/11/2026, no ambiente local: com 50 sensores simultâneos, p95 de 68 ms, cerca de 1.000 lotes por segundo e nenhuma falha. Em 10/11/2026, no GitHub Actions (2 CPUs): com 100 sensores, nenhuma falha e p95 de 262 ms com o pool de 20 conexões (377 ms com 10), que passou a ser o padrão (issue #113). Em 17/11/2026, um turno industrial de 120 sensores (uma leitura a cada 2 s, com dois picos de lavagem) rodou três vezes no GitHub Actions: cerca de 50.700 leituras por turno, nenhuma resposta 5xx e p95 no pico entre 16 e 178 ms, abaixo da meta de 250 ms (issue #165). Nos picos, o pool de conexões chegou a encher por alguns instantes, sem nenhum pedido esgotar o tempo. O sistema publicado, com menos recursos, não foi medido. | Medido |
| RNF22 | Índices medidos com EXPLAIN ANALYZE (migração V8): a regra de alerta caiu de 73,5 ms para 0,19 ms com 200.000 lotes; o fechamento mensal usa Index Scan. O autovacuum das tabelas que mais recebem linhas roda mais cedo (V13), e um script confere linhas mortas e inchaço (database/manutencao/db-bloat-check.sql, issue #163). | Implementado |
| RNF23 | A lista de processos fica em cache na API e é atualizada depois de cada cadastro ou edição. | Implementado |

## 3.3 Requisitos de usabilidade

| ID | Requisito | Situação |
|---|---|---|
| RNF12 | Interface em português do Brasil, com linguagem do chão de fábrica, mensagens de erro junto ao campo e poucos passos por registro. | Implementado |
| RNF13 | Acessibilidade: status nunca indicado só por cor (sempre cor, ícone e texto); campos com rótulo; navegação por teclado; respeito à preferência de reduzir animações; tema claro, escuro ou automático, com contraste de texto de pelo menos 4,5:1 (WCAG AA) medido nos dois temas (issue #106). Auditoria automática WCAG 2.1 A e AA com axe-core nos testes de ponta a ponta, nos dois temas e nas telas principais; violação séria ou crítica falha o CI (issue #172). | Implementado |
| RNF25 | Validação de usabilidade com o roteiro e o questionário SUS de docs/validacao/, de preferência com um operador real de lavanderia. | **Parcial** (issue #50): avaliação simulada por inspeção (PR #140), que achou e corrigiu o problema #139, e teste com pessoas de fora da equipe, que usaram o sistema do começo ao fim sem dificuldades relevantes. O teste com operador real fica como limitação, por falta de acesso a lavanderias no prazo; o kit está pronto para ser aplicado. |
| RNF26 | Glossário dos termos têxteis (estonagem, amaciamento, alvejamento, tingimento) disponível na interface, com dica acessível por teclado e sugestão do nome padrão no cadastro de processo. | Implementado (issue #55) |
| RNF29 | Carregamento sem saltos: enquanto os dados chegam, os cards, gráficos e listas mostram esqueletos no formato do conteúdo, e a tela não se desloca (CLS abaixo de 0,1 no computador e no celular, com rede 3G simulada). | Implementado (issue #161): dashboard de 0,075 para 0,004 e relatórios de 0,288 para 0 no celular |

## 3.4 Interfaces externas

### 3.4.1 Interfaces com o usuário

| Tela | Perfil | Conteúdo principal |
|---|---|---|
| Login | público | Usuário, senha (com botão de mostrar), botão Entrar; orientação para pedir ao administrador em caso de esquecimento; link para o aviso de privacidade. |
| Aviso de privacidade | público | Dados pessoais guardados, para quê, por quanto tempo e quem vê; com quem são compartilhados; direitos e com quem falar (RNF27). Também no rodapé das telas. |
| Dashboard | gestor, administrador | Indicadores do mês, alertas ativos, resumo por processo e gráficos de meta e consumo por processo e por dia. |
| Alertas e detalhe do alerta | gestor, administrador | Abas por status; sequência de lotes que gerou o alerta; ações "em análise" e "resolvido" com confirmação. |
| Relatórios e pré-visualização do PDF | gestor, administrador | Escolha de mês e ano; tabela por processo; pré-visualização A4, download em PDF e exportação em planilha Excel. |
| Registro de lotes e resultado | operador, gestor, administrador | Processo, peças e litros; prévia do esperado; confirmação; resultado com desvio e status; lotes guardados no aparelho, com enviar agora, tentar de novo e descartar. |
| Histórico de lotes | operador, gestor, administrador | Lista com filtro por processo e botão "Exportar CSV"; gestor e administrador também veem quem registrou. |
| Processos e metas | gestor, administrador | Lista de processos; cadastro e edição com nome, unidade e meta. |
| Usuários | administrador | Lista com situação; cadastrar, desativar, reativar e redefinir senha. |
| Auditoria | administrador | Registros das ações sobre contas, com filtro por período e ação, e paginação; pessoas pelo nome, com o login mascarado. |
| Configurações da conta | todos | Nome editável; usuário e perfil somente leitura; troca de senha. |
| Sessão expirada, acesso negado e página não encontrada | todos | Mensagens claras com caminho de volta. |

Todas as telas mostram estados de carregamento (com esqueletos no Dashboard e nos Relatórios, RNF29), de lista vazia e de erro com opção de tentar de novo (RNF11).

### 3.4.2 Interfaces de hardware

O sistema web não exige hardware específico. O sensor simulado usa: ESP32 DevKit C v4; potenciômetro no pino 34 (vazão de 0 a 30 L/min); gerador de pulsos no pino 25, ligado por fio à entrada de contagem no pino 27 (no dispositivo físico, o sinal do sensor de vazão entra direto no pino 27); botão no pino 4 (iniciar/encerrar lote); LED azul no pino 2 (lote em andamento); LED vermelho no pino 33 e buzzer no pino 26 (aviso de lote crítico). Referência de sensor: YF-S201, cerca de 450 pulsos por litro. O coeficiente K (pulsos por litro) é configurável no sketch e calibrado no dispositivo físico pelo procedimento de iot/LEIA-ME.md. A especificação da bancada física está em docs/tecnico/hardware-bancada.md.

### 3.4.3 Interfaces de software

| Software | Versão | Uso |
|---|---|---|
| PostgreSQL | 18 | Banco de dados (Neon no sistema publicado; contêiner no Docker). |
| JDK | 25 (LTS) ou mais novo | Execução da API. |
| Node.js / pnpm | 22 ou mais novo / 10 | Execução e build do front-end. |
| Navegador | versões atuais de Chrome, Edge, Firefox ou Safari | Acesso dos usuários; instalação como aplicativo (PWA). |
| Docker / Docker Compose | atual | Execução local completa e testes de integração. |
| Wokwi | serviço web | Simulação do ESP32. |
| cloudflared | qualquer | Túnel temporário entre o Wokwi e a API local (já vem no Docker Compose). |
| Telegram Bot API | serviço web | Entrega do aviso de alerta aberto (opcional). |
| Render / Neon | serviços web | Hospedagem do site, da API e do banco publicados. |

### 3.4.4 Interfaces de comunicação

- HTTP com corpo JSON (UTF-8), sob o prefixo /api; autenticação pelo cabeçalho `Authorization: Bearer <token>`.
- 24 endpoints: autenticação (2), usuários (6), processos (3), lotes (3), telemetria (1), alertas (2), relatórios (2), auditoria (2) e monitoramento (3: saúde, saúde do sensor e métricas), descritos em docs/tecnico/api.md e no Swagger.
- Códigos de resposta padronizados: 400, 401, 403, 404, 405, 409, 422, 429, 500 e 503, sempre no formato {codigo, mensagem, campos}.
- Registro de lote: cabeçalho opcional Idempotency-Key (UUID); um reenvio com a mesma chave devolve o lote já gravado (200), em vez de criar outro (201).
- Sensor simulado: HTTPS com conferência da impressão digital do certificado no projeto público; HTTP sem criptografia, pelo túnel, só no projeto local de testes (RNF06).
- Aviso: a API chama a Bot API do Telegram por HTTPS (porta 443).

## 3.5 Requisitos lógicos de banco de dados

| Tabela / visão | Conteúdo e regras |
|---|---|
| usuario | Nome, login (único, 3 a 60 caracteres), hash da senha, perfil (admin, gestor, operador ou sensor), ativo, data de criação e, na conta de sensor, o SHA-256 do token de API (V9). |
| processo | Nome (único), unidade (lote ou peça) e meta (> 0). |
| lote | Processo, usuário, peças, litros, esperado, data e chave de envio (única, opcional). O esperado é preenchido pelo trigger trg_lote_esperado; o trigger trg_lote_imutavel impede UPDATE e DELETE. |
| alerta | Processo, data de detecção, status (aberto, análise, resolvido) e data da última mudança de status. |
| alerta_lote | Lotes de cada alerta; um lote pertence a no máximo um alerta. |
| auditoria_usuario | Quem fez, quem foi afetado, ação (criação, redefinição de senha, desativação, reativação, rotação de token) e data; o trigger trg_auditoria_imutavel impede UPDATE e DELETE. |
| aviso_pendente | Avisos do Telegram que não chegaram: alerta, tentativas, último erro e data do envio (V10 e V11). A API só atualiza as colunas da tentativa. |
| telemetria | Leituras de vazão do sensor: processo, usuário, vazão e hora do servidor (V14). Só recebe INSERT (RF37). |
| efluentes_descarte | Descarte de efluentes de cada lote: volume, pH, turbidez e percentual reaproveitado, com limites conferidos pelo banco (V12, issue #162). Registro de auditoria: só recebe INSERT. A tabela está pronta; a API e a tela ficam para uma versão futura (Apêndice B). |
| v_historico_lotes, v_alertas | Visões que entregam o desvio já calculado. |

Os dados de consumo são permanentes: não há exclusão de lotes, de registros de auditoria nem de usuários. Os relatórios consideram o mês no fuso America/Recife. Índices: por data, por usuário, por processo e data (regra de alerta), por alerta em alerta_lote, por data e por processo em telemetria e por lote e por data em efluentes_descarte.

## 3.6 Restrições de projeto

- Pilha tecnológica definida pela equipe: React, Java com Spring Boot e PostgreSQL (TAP, seção 5).
- O esquema do banco é versionado com migrações Flyway (V1 a V14), aplicadas por um usuário dono do banco. O Hibernate não cria nem altera tabelas: ao iniciar, a API apenas confere se elas batem com as entidades e não sobe se divergirem.
- O front-end segue a estrutura exigida pelo Figma Make e roda na porta 8443 em desenvolvimento.
- RNF18 — Padrões de dados: datas trafegam em ISO 8601 (UTC); o mês dos relatórios segue o fuso America/Recife; litros e metas com 2 casas decimais. **Implementado.**

### 3.6.1 Conformidade com normas

| Norma | Onde é aplicada |
|---|---|
| ISO/IEC/IEEE 29148 | Esta ERS. |
| ISO/IEC/IEEE 42010 | Descrição da arquitetura (docs/tecnico/arquitetura.md). |
| ISO/IEC/IEEE 26514 | Guia do sistema (docs/guia/) e guias de cada parte (READMEs). |
| ISO/IEC/IEEE 29119 | Plano, casos e relatório de testes (docs/tecnico/testes.md). |
| ISO/IEC 12207 | Processos do ciclo de vida do projeto (docs/gestao/ciclo-de-vida.md). |
| ISO/IEC 27001 | Política de segurança, análise de riscos e continuidade (docs/gestao/seguranca.md). |

Os documentos seguem a estrutura e o conteúdo pedidos por cada norma, adaptados ao porte de um projeto acadêmico. Não há certificação formal.

## 3.7 Atributos do sistema

### 3.7.1 Confiabilidade

| ID | Requisito | Situação |
|---|---|---|
| RNF08 | Erros seguem um formato único {codigo, mensagem, campos}, sem expor detalhes internos; o detalhe técnico fica só no log. | Implementado |
| RNF09 | Integridade dos dados: o esperado é calculado e os lotes e registros de auditoria são protegidos contra alteração pelo próprio banco (triggers), mesmo que a API falhe. | Implementado |
| RNF10 | Registros simultâneos do mesmo processo são serializados (bloqueio do processo durante o registro), para a regra de alertas não falhar com concorrência. | Implementado |
| RNF21 | Backup do banco com verificação: o backup só é aceito depois de restaurado num banco temporário com as tabelas conferidas; restauração só em banco vazio. Runbook de recuperação de desastres com metas de RTO menor que 10 minutos e RPO menor que 1 minuto; no ensaio no Docker (17/11/2026), o sistema voltou em 23 segundos, sem perder lotes (issue #170). | Implementado |

### 3.7.2 Disponibilidade

| ID | Requisito | Situação |
|---|---|---|
| RNF11 | Sem conexão com o banco, a API responde 503 (BANCO_INDISPONIVEL) e as telas mostram estado de erro com opção de tentar de novo. | Implementado |
| RNF20 | Monitoramento: /api/actuator/health aberto (só diz se a API está no ar) e usado pelo Render como checagem de saúde; /api/actuator/metrics só para o administrador, com tempo de resposta por rota, memória e conexões. /api/actuator/health/sensor (admin, gestor e operador) fica UP se a última telemetria chegou há menos de 60 s e DOWN (503) se não, com cada linha de lavagem ativa nos detalhes; ele fica fora da saúde principal, para um sensor parado não reiniciar a API (issue #158). Nenhum outro endpoint do Actuator fica exposto. | Implementado |

### 3.7.3 Segurança

| ID | Requisito | Situação |
|---|---|---|
| RNF01 | Senhas de 8 a 72 bytes, guardadas apenas como hash BCrypt. Nenhuma senha ou token aparece no código, no banco em texto puro, em logs ou em respostas da API. | Implementado |
| RNF02 | Sessão por token JWT (HS256) com validade de 8 horas, sem renovação automática. A chave JWT_SECRET tem pelo menos 32 caracteres e a API não sobe sem ela. | Implementado |
| RNF03 | A autorização por perfil é aplicada no back-end; esconder menus no site não é suficiente. O perfil considerado é sempre o do banco, consultado a cada requisição. | Implementado |
| RNF04 | CORS restrito às origens configuradas em CORS_ORIGINS; a origem "*" é recusada. | Implementado |
| RNF05 | Segredos (backend/.env, .env.local, database/.env.backup, docs/privado/ e variáveis do Render) ficam fora do controle de versão. | Implementado |
| RNF06 | A API publicada e o dispositivo usam HTTPS. O HTTP só é aceito no projeto local de testes, por túnel temporário. A conta do sensor tem perfil próprio e a senha não fica salva no projeto público do Wokwi. | Implementado |
| RNF07 | A API conecta ao banco com um usuário próprio (aguas_api), sem permissão de DELETE, TRUNCATE ou de alterar o esquema. | Implementado |
| RNF19 | Limite de requisições por minuto: 5 tentativas de login por IP, 10 por conta somando todos os IPs, e 60 lotes por usuário; acima disso, 429 (LIMITE_EXCEDIDO) com o cabeçalho Retry-After. O site desabilita a ação e mostra a contagem regressiva até poder tentar de novo (issue #101). | Implementado |
| RNF27 | Privacidade (LGPD, Lei nº 13.709/2018): (a) a tela de login tem um link para o aviso de privacidade, aberto sem entrar, que diz quais dados pessoais são guardados, para quê, por quanto tempo, quem vê e com quem falar; (b) o login de outra pessoa só sai inteiro da API para o administrador na lista de usuários; na auditoria e na lista de usuários pedida pelo gestor, vai mascarado (no máximo metade dos caracteres e sempre quatro asteriscos, ex.: ca****in), com o nome inteiro; (c) o CSV e o PDF levam só o nome, sem login, senha ou perfil. | Implementado (issue #117) |
| RNF28 | Proteção do ambiente de execução: a imagem da API é distroless (só o Java 25 e o jar, sem shell e sem root, issue #105), e no Docker as senhas e a chave JWT são lidas como arquivos só de leitura, nunca como variáveis de ambiente (issue #118). Nenhum contêiner roda como root, e todos têm cap_drop ALL, no-new-privileges e sistema de arquivos só de leitura (issue #171). O CI falha se a imagem tiver shell, se um segredo aparecer no ambiente ou se um processo rodar como root. | Implementado |

A política de segurança, a análise de riscos e o plano de continuidade estão em docs/gestao/seguranca.md.

### 3.7.4 Manutenibilidade

| ID | Requisito | Situação |
|---|---|---|
| RNF15 | Código em camadas (controller, service, repository, entity, DTO) e testes automatizados: 221 no back-end (180 de unidade e web e 41 de integração com PostgreSQL 18), 286 de unidade e 24 de ponta a ponta no site, em 20/11/2026. Os testes nunca usam o banco oficial. | Implementado |
| RNF16 | GitFlow: develop como branch padrão; mudanças por pull request, com modelo de descrição e aviso quando um PR aponta para a main fora de release ou hotfix. | Adotado |
| RNF24 | Integração contínua: a cada pull request, testes do back-end, build e testes do site, teste do Docker, vulnerabilidades conhecidas nas dependências (OSV-Scanner, bloqueia CVSS 7 ou mais, issue #112) e testes de mutação (PIT, mínimo de 81% dos mutantes mortos, issue #102). Quality Gate no SonarQube da disciplina, com a cobertura do JaCoCo e do Vitest: no código novo, nenhum problema novo, cobertura de pelo menos 80% e duplicação de no máximo 3% (issue #168). SBOM CycloneDX da API e do site a cada mudança, anexado às releases (issue #169). Entrega contínua: o Render só publica depois que o CI passa. | Implementado |

### 3.7.5 Portabilidade

| ID | Requisito | Situação |
|---|---|---|
| RNF14 | O site funciona em navegadores atuais, em computador e em celular (layout responsivo), e pode ser instalado como aplicativo. Nada precisa ser instalado à parte. | Implementado |

## 3.8 Informações de apoio

- **Implantação:** site e API publicados no Render, com endereço fixo e HTTPS; banco no Neon, com o usuário aguas_api (RNF07). O Render publica sozinho a branch develop, só depois do CI, e confere a saúde da API.
- **Execução local:** o Docker Compose sobe banco, API e site com um comando; com o perfil tunel, liga também o túnel para o Wokwi.
- **Configuração:** banco, chave JWT, origens CORS, limites, contas iniciais e aviso no Telegram vêm de variáveis de ambiente ou do arquivo backend/.env.
- **Sem modo de demonstração:** o site sempre usa a API; para demonstrar sem internet, usa-se o Docker.
- **Particionamento da tabela lote** (issue #100): analisado e não adotado. Com 1 milhão de lotes, o particionamento mensal quebraria a chave de envio única (RF28) e a ligação alerta_lote → lote, e deixaria a regra de alerta de menos de 0,5 ms para 63 a 109 ms. O relatório mensal ganharia pouco, porque já fica abaixo de 0,1 s. A medição, o volume em que vale reavaliar e como seria feito estão em docs/tecnico/desempenho-indices.md.
- **Regras de negócio** em detalhe: Apêndice D.

# 4. Verificação

A ISO/IEC/IEEE 29148 pede que cada requisito tenha um meio de verificação definido. Esta ERS usa quatro métodos:

| Método | O que é | Onde aparece |
|---|---|---|
| Teste | Execução automática com entradas definidas e resultado esperado. | CI no GitHub Actions a cada pull request. |
| Demonstração | Uso do sistema funcionando, observando o resultado na tela ou no dispositivo. | Sistema publicado, Docker e Wokwi. |
| Inspeção | Leitura do código, da configuração ou do documento. | Revisão dos pull requests. |
| Análise | Medição ou cálculo sobre dados coletados. | Teste de carga e EXPLAIN ANALYZE. |

**Requisitos funcionais.** O método e a evidência de cada RF estão na linha "Verificação" da sua tabela (seção 3.1) e na matriz do Apêndice C.

**Requisitos não funcionais.**

| Requisitos | Método | Evidência |
|---|---|---|
| RNF01, RNF02, RNF03, RNF04 | Teste | RegrasSimplesTest (JWT e CORS), SegurancaWebTest, cadaPerfilAcessaSoOQueLheCabe. |
| RNF05, RNF06, RNF07 | Inspeção e teste | .gitignore e variáveis do Render; impressão digital no sketch; conectaSomenteAoBancoDeTeste e o script database/seguranca-usuario-api.sql. |
| RNF08, RNF11 | Teste | SegurancaWebTest (formato dos erros); estados de erro das telas. |
| RNF09, RNF10 | Teste | loteNaoPodeSerAlteradoNemExcluido; regra de alerta com registros simultâneos (integração). |
| RNF12, RNF13, RNF14 | Teste, demonstração e inspeção | Uso no computador e no celular; e2e/acessibilidade.spec.ts (axe-core, WCAG 2.1 AA); tema.test.ts. |
| RNF15, RNF16, RNF24 | Inspeção | Estrutura do código, histórico de pull requests, execuções do CI, Quality Gate do SonarQube e SBOM das releases. |
| RNF17, RNF22 | Análise | docs/tecnico/teste-carga.md, docs/tecnico/desempenho-indices.md e docs/tecnico/manutencao-banco.md. |
| RNF18, RNF23 | Teste | resumoMensalUsaFusoDeRecife, fusoPadraoDosRelatoriosERecife; ProcessoServiceCacheTest. |
| RNF19 | Teste | LimiteDeRequisicoesTest; limite.test.ts (contagem regressiva no site). |
| RNF20 | Teste | saudeAbertaMostraSoOStatusSemToken, metricasSoParaOAdmin, outrosEndpointsDoActuatorFicamFechados; SensorWokwiHealthIndicatorTest, SaudeDoSensorForaDaRaizTest e saudeDoSensorWokwiPelaUltimaTelemetriaSemAfetarARaiz (integração). |
| RNF21 | Demonstração | database/backup.sh, que restaura o backup num banco temporário e confere as tabelas; ensaio do runbook (docs/tecnico/runbook-disaster-recovery.md, seção 6). |
| RNF25 | Teste de usabilidade e inspeção | Avaliação simulada (docs/validacao/resultados/) e teste com pessoas de fora da equipe; operador real pendente (limitação registrada). |
| RNF26 | Teste | glossario.test.ts. |
| RNF27 | Teste e inspeção | e2e/privacidade.spec.ts (critério de aceitação: o aviso abre a partir do login), privacidade.test.ts, PrivacidadeTest, AuditoriaServiceTest e auditoriaListaAsAcoesComFiltrosEPaginacao (integração); conferência do CSV e do PDF na seção 6.4 de docs/gestao/seguranca.md. |
| RNF28 | Teste | Job docker-compose do CI: confere que a imagem não tem shell, que nenhum segredo aparece no docker inspect nem no ambiente do processo e que nenhum processo do banco, da API e do site roda como root. |
| RNF29 | Teste | e2e/carregamento.spec.ts (CLS abaixo de 0,1 com rede 3G simulada), esqueletos.test.ts e carregamento.test.ts. |

**Ambiente e resultado.** Os testes automatizados rodam no GitHub Actions em toda mudança: 221 testes do back-end (com PostgreSQL 18 em contêiner), 286 de unidade e 24 de ponta a ponta do site, o teste do Docker Compose, as vulnerabilidades das dependências, o SBOM e o Quality Gate do SonarQube. Na última execução da develop (20/11/2026, merge do PR #195), todos passaram. O plano, os casos e o relatório completos estão em docs/tecnico/testes.md, conforme a ISO/IEC/IEEE 29119.

# 5. Apêndices

## Apêndice A — Suposições e dependências

- Cada lavanderia sabe, ou consegue estimar, a meta de água de seus processos; valores de referência da literatura podem ser usados e ajustados pelo gestor.
- O operador tem acesso a um navegador no momento de registrar o lote; a conexão pode oscilar.
- O sistema publicado depende do Render e do Neon; o aviso depende do Telegram, mas a falha dele não afeta o registro.
- A simulação de IoT depende do serviço Wokwi; no projeto local, de um túnel ativo, cujo endereço muda a cada reinício.
- Os dados de mercado do TAP (seção 3) são estimativas de pesquisa documental, ainda sem validação direta com usuários.

## Apêndice B — Requisitos adiados

Ficam para versões futuras, ou dependem de decisão:

- Inativar processo de lavagem (hoje só é possível cadastrar e editar).
- Protótipo físico de bancada do sensor (TAP, seção 6), sujeito ao ponto de verificação.
- Registro de volume de efluente e índice de reúso, conforme a decisão P7 do Registro de Decisões v1. A tabela efluentes_descarte já existe no banco (V12, issue #162); faltam a rota da API e a tela.
- Integração com sensores em operação real numa lavanderia.
- **RF31 — Identificar a linha de lavagem de cada sensor** (US-15, parecer item #19, issue #47). Adiado em 09/11/2026. O projeto foi feito sem custo, e o sensor é simulado no Wokwi, que roda no navegador. Cada sensor a mais precisa de outra aba do simulador aberta ao mesmo tempo, o que consome processador e memória do computador. No teste de 06/11/2026, com o computador carregado, um único sensor caiu para 3% da velocidade, e a conexão segura com a API falhou (SSL EOF); com dois ou mais, a demonstração ficaria instável. O limite é o simulador, não a API: ela já aceita lotes de vários dispositivos ao mesmo tempo (RNF17, teste de carga com 50 sensores simultâneos em docs/tecnico/teste-carga.md), e cada lote guarda a conta que o enviou. Com sensores físicos, o caminho é uma conta de perfil sensor por linha de lavagem (por exemplo, sensor.linha1 e sensor.linha2), sem mudar o banco.

## Apêndice C — Matriz de rastreabilidade

Liga cada requisito funcional à história de usuário do TAP, ao endpoint da API, à tela e ao método de verificação. A ligação com as necessidades de negócio está na seção 1.3.5.

| RF | História | Endpoint | Tela | Verificação | Situação |
|---|---|---|---|---|---|
| RF01 | US-01 | POST /auth/login, GET /auth/me | Login | Teste | Implementado |
| RF02 | US-01 | POST /auth/login | Login | Teste | Implementado |
| RF03 | US-01 | todas as rotas | Sessão expirada, Acesso negado | Teste | Implementado |
| RF04 | US-02 | POST /processos | Processos e metas | Teste | Implementado |
| RF05 | US-02 | PUT /processos/{id} | Processos e metas | Teste | Implementado |
| RF06 | US-02 | POST e PUT /processos | Processos e metas | Teste | Implementado |
| RF07 | US-03 | POST /lotes | Registro de lotes | Teste e Demonstração | Implementado |
| RF08 | US-03 | POST /lotes | Registro de lotes | Teste | Implementado |
| RF09 | US-03 | POST /lotes | Resultado do lote | Teste | Implementado |
| RF10 | US-03 | — (banco) | — | Teste | Implementado |
| RF11 | US-04 | POST /lotes | Dashboard, Alertas | Teste | Implementado |
| RF12 | US-04 | GET /alertas, PATCH /alertas/{id}/status | Alertas, Detalhe do alerta | Teste | Implementado |
| RF13 | US-05 | GET /relatorios/resumo | Relatórios | Teste | Implementado |
| RF14 | US-05 | GET /relatorios/resumo | Relatórios | Teste | Implementado |
| RF15 | US-05 | — | Pré-visualização do PDF | Demonstração | Implementado |
| RF16 | US-14 | GET /relatorios/resumo, GET /lotes, GET /alertas | Dashboard | Demonstração | Implementado |
| RF17 | US-06 | POST /usuarios | Usuários | Teste | Implementado |
| RF18 | US-06 | PATCH /usuarios/{id}/ativo | Usuários | Teste | Implementado |
| RF19 | US-06 | PATCH /usuarios/{id}/senha | Usuários | Teste | Implementado |
| RF20 | US-06 | — (inicialização) | — | Teste | Implementado |
| RF21 | US-07 | PATCH /usuarios/{id} | Configurações | Demonstração | Implementado |
| RF22 | US-07 | PATCH /usuarios/{id} | Configurações | Teste | Implementado |
| RF23 | US-08 | GET /lotes, GET /lotes/{id} | Histórico de lotes | Teste | Implementado |
| RF24 | TAP 4.1 | POST /lotes, GET /lotes | Resultado, Histórico, Alertas | Teste | Implementado |
| RF25 | US-09 | POST /auth/login, GET /processos, POST /lotes | Histórico de lotes | Teste e Demonstração | Implementado |
| RF26 | US-09 | — (dispositivo) | — (Wokwi) | Demonstração | Implementado |
| RF27 | US-10 | GET /auditoria | Auditoria | Teste | Implementado |
| RF28 | US-11 | POST /lotes (Idempotency-Key); service worker (Background Sync) | Registro de lotes | Teste | Implementado |
| RF29 | US-12 | GET /lotes | Histórico de lotes | Teste | Implementado |
| RF30 | US-13 | — (Bot API do Telegram) | — (grupo do Telegram) | Teste e Demonstração | Implementado |
| RF31 | US-15 | — | — | Não se aplica | Adiado (Apêndice B) |
| RF32 | Issue #109 | GET /auditoria/seguranca | Auditoria (Eventos de segurança) | Teste | Implementado |
| RF33 | Issue #99 | GET /relatorios/csv | — (API) | Teste | Implementado |
| RF34 | Issue #116 | GET /relatorios/resumo | Dashboard, Relatórios, PDF | Teste | Implementado |
| RF35 | Issues #103 e #129 | POST /usuarios/{id}/token/rotacao; Authorization: Bearer (sensor) | Usuários; sensor no Wokwi | Teste e Demonstração | Implementado |
| RF36 | Issue #159 | — (gerado no navegador) | Relatórios | Teste | Implementado |
| RF37 | Issues #156 e #157 | POST /telemetria | — (sensor) | Teste | Implementado |

Resumo: 37 requisitos funcionais, 36 implementados e 1 adiado (RF31); 29 requisitos não funcionais, 28 implementados, adotados ou medidos e 1 parcial (RNF25, sem operador real).

## Apêndice D — Regras de negócio

### D.1 Cálculo do esperado e do desvio

- Meta por peça: esperado = meta × peças.
- Meta por lote: esperado = meta.
- Desvio (%) = (litros − esperado) ÷ esperado × 100, arredondado em 2 casas.
- O esperado é calculado com a meta vigente no momento do registro e nunca é recalculado.

### D.2 Regra de alertas

"Acima da meta" significa litros maiores que o esperado, sem tolerância. Ao registrar um lote acima da meta:

- se o lote anterior do mesmo processo também está acima e pertence a um alerta aberto ou em análise, o novo lote entra nesse alerta;
- senão, se os 3 lotes mais recentes do processo estão acima e nenhum deles tem alerta, é criado um novo alerta com status "aberto", e o aviso no Telegram é enviado (RF30);
- lotes de alertas resolvidos não são reaproveitados: é preciso uma nova sequência de 3 lotes.

Um lote dentro da meta interrompe a sequência.

### D.3 Status do alerta

| De | Para | Permitido? |
|---|---|---|
| aberto | em análise | sim |
| aberto | resolvido | sim |
| em análise | resolvido | sim |
| qualquer outra combinação | — | não (409 TRANSICAO_INVALIDA) |

### D.4 Faixas de status do lote

| Desvio | Status | Apresentação |
|---|---|---|
| até 0% | Dentro da meta | verde, com ícone e texto |
| acima de 0% e até 8% | Atenção | amarelo, com ícone e texto |
| acima de 8% | Crítico | vermelho, com ícone e texto |

Limites usados pela API, em cada lote, e pelo site, nos totais e médias (RF24).
