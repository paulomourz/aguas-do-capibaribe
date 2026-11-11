<p align="center"><img src="../assets/logo-referencia.png" width="120" alt="Logo do Águas do Capibaribe"></p>

# Águas do Capibaribe — Especificação de Requisitos de Software (ERS)

**Sistema de Gestão de Consumo Hídrico por Lote em Lavanderias de Jeans do Agreste Pernambucano**

Elaborada conforme a norma ISO/IEC/IEEE 29148:2018 (Engenharia de requisitos), que substitui a IEEE Std 830-1998.

| Campo | Descrição |
|---|---|
| Versão | 2.1 |
| Data | 10 de novembro de 2026 |
| Base | Termo de Abertura do Projeto v3.1 (09/11/2026), parecer técnico do orientador (27/10/2026) e código do repositório em 09/11/2026 (branch develop) |
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
- **Acompanhamento:** Dashboard do mês com gráficos e relatório mensal por processo, com PDF.
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
- Prazo acadêmico de cerca de 6 semanas a partir de 12/10/2026; a data final ainda precisa ser confirmada. **[A CONFIRMAR]**
- Os relatórios são gerenciais e não têm validade jurídica.
- O sensor é simulado (Wokwi): seus resultados não são medição real de lavanderia.

As restrições de projeto (pilha tecnológica, banco versionado, estrutura do front-end) estão na seção 3.6.

### 1.3.5 Necessidades de negócio e dos stakeholders

A ISO/IEC/IEEE 29148 pede que os requisitos de software sejam derivados das necessidades do negócio e das partes interessadas. A tabela abaixo resume essas necessidades, a partir do TAP (seções 3, 7 e 8), e indica os requisitos que as atendem.

| ID | Necessidade | Stakeholder | Atendida por |
|---|---|---|---|
| NB-01 | Reduzir o custo com água comprada, comparando o consumo de cada lote com uma meta. | Gestor da lavanderia | RF04 a RF09, RF13, RF16, RF24 |
| NB-02 | Descobrir cedo quando um processo passa a gastar demais. | Gestor da lavanderia | RF11, RF12, RF30 |
| NB-03 | Comprovar o consumo perante clientes e órgãos ambientais, com dados que não podem ser alterados. | Gestor, marca compradora, MPPE / CPRH | RF10, RF13 a RF15, RF29, RNF09 |
| NS-01 | Registrar o lote em poucos passos, no celular, mesmo com a conexão oscilando. | Operador de máquina | RF07, RF28, RNF12 a RNF14 |
| NS-02 | Controlar quem acessa o sistema e saber quem mexeu nas contas. | Administrador do sistema | RF01 a RF03, RF17 a RF22, RF27 |
| NS-03 | Medir a água sem digitação, por um dispositivo. | Gestor e operador | RF25, RF26; RF31 adiado (Apêndice B) |
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
- Termo de Abertura do Projeto e Backlog de Histórias de Usuário, versão 3.1 (docs/gestao/TAP.pdf).
- Parecer técnico do orientador, de 27/10/2026, e issues do repositório no GitHub.
- Registro de Decisões v1 da equipe (decisões P1, P3 e P7, citadas no TAP).
- Descrição da arquitetura (docs/tecnico/arquitetura.md, ISO/IEC/IEEE 42010).
- Documentação de testes (docs/tecnico/testes.md, ISO/IEC/IEEE 29119).
- Segurança da informação (docs/gestao/seguranca.md, ISO/IEC 27001) e ciclo de vida (docs/gestao/ciclo-de-vida.md, ISO/IEC 12207).
- Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD); aviso de privacidade na seção 6 de docs/gestao/seguranca.md.
- Contrato da API REST (docs/tecnico/api.md) e esquema do banco (migrações Flyway em backend/src/main/resources/db/migration).
- Teste de carga (docs/tecnico/teste-carga.md) e análise de índices (docs/tecnico/desempenho-indices.md).
- Guia do sistema (docs/guia/, ISO/IEC/IEEE 26514), guia do sensor simulado (iot/LEIA-ME.md) e kit de validação de usabilidade (docs/validacao/).

# 3. Requisitos

Esta seção segue a organização da ISO/IEC/IEEE 29148: funções (3.1), desempenho (3.2), usabilidade (3.3), interfaces (3.4), banco de dados (3.5), restrições de projeto (3.6), atributos do sistema (3.7) e informações de apoio (3.8).

**Atributos de cada requisito.** Todo requisito tem identificador único, descrição, prioridade, origem (de onde veio), situação em 09/11/2026 e método de verificação. Prioridade: Essencial (sem ele o MVP não é entregue), Importante (esperado no MVP) e Desejável (trilha complementar).

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
| Processamento | O site guarda o lote no IndexedDB com uma chave de envio (UUID) e o envia quando a conexão volta, na ordem em que foi feito, repetindo a mesma chave a cada tentativa. A API devolve o lote já gravado quando recebe uma chave repetida; a chave usada com outros dados ou por outro usuário é recusada (409 CHAVE_DE_ENVIO_REPETIDA). O lote recusado por validação fica para o operador descartar. |
| Saídas | Contador de lotes pendentes no cabeçalho; lista "guardados no aparelho" com enviar agora, tentar de novo e descartar. |
| Prioridade | Importante |
| Origem | US-11 · parecer, item #26 · issue #54 |
| Situação | Implementado. |
| Verificação | Teste: sincronizacao.test.ts (fila no aparelho); e2e/offline.spec.ts (Playwright, conexão caindo e voltando); reenvioComAMesmaChaveNaoDuplicaOLote e bancoRecusaChaveDeEnvioDuplicadaMesmoSemPassarPelaApi (integração). |

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
| Processamento | O envio acontece depois que o lote foi gravado, em outra thread e com fila limitada. Uma falha do Telegram só fica no log, sem o token. Sem token e chat configurados, o aviso fica desligado. |
| Saídas | Mensagem com o processo, os 3 lotes, o número do alerta e o link para ele. |
| Prioridade | Desejável |
| Origem | US-13 · parecer, item #24 · issue #52 |
| Situação | Implementado e testado com o sistema publicado. |
| Verificação | Teste e Demonstração: AvisoDeAlertaTest; alertaAbertoAvisaNoTelegramDepoisDeGravar e telegramForaDoArNaoAtrapalhaORegistroDoLote (integração). Demonstrado no sistema publicado em 05/11/2026. |

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

### 3.1.7 Histórico de lotes

#### RF23 — Consultar o histórico de lotes

| Atributo | Descrição |
|---|---|
| Descrição | Os usuários do site devem poder consultar os lotes registrados, do mais recente ao mais antigo, com filtro por processo. |
| Entradas | Filtro opcional por processo (a API também aceita período). |
| Processamento | O operador vê apenas os lotes que registrou; gestor e administrador veem todos. O operador recebe 404 ao pedir um lote de outra pessoa. |
| Saídas | Lista com data e hora, processo, peças, litros, desvio e status; para gestor e administrador, também quem registrou. |
| Prioridade | Essencial |
| Origem | US-08, Cenários 1 e 2 |
| Situação | Implementado (GET /lotes, GET /lotes/{id}). |
| Verificação | Teste: operadorVeSoOsPropriosLotes (integração). |

#### RF29 — Exportar o histórico em CSV

| Atributo | Descrição |
|---|---|
| Descrição | O usuário deve poder baixar os lotes do filtro atual em CSV, para auditoria externa. |
| Entradas | Lotes do filtro atual (todos, não só a página visível). |
| Processamento | O site gera o arquivo em ordem cronológica, com separador ";", vírgula decimal, BOM para o Excel, data e hora de Recife e em UTC, e protege contra fórmulas em textos digitados. |
| Saídas | Arquivo CSV com id, data, hora, processo, peças, litros, esperado, diferença, desvio, status e quem registrou. |
| Prioridade | Importante |
| Origem | US-12 · parecer, item #20 · issue #48 |
| Situação | Implementado. |
| Verificação | Teste: historicoCsv.test.ts. |

### 3.1.8 Indicação visual de status

#### RF24 — Classificar o lote por faixa de desvio

| Atributo | Descrição |
|---|---|
| Descrição | Cada lote deve ser classificado como "dentro da meta" (verde), "atenção" (amarelo) ou "crítico" (vermelho), sempre com cor, ícone e texto juntos. |
| Entradas | Desvio do lote. |
| Processamento | Até 0% = dentro da meta; acima de 0% e até 8% = atenção; acima de 8% = crítico (decisão P1). |
| Saídas | Status exibido no resultado do registro, no histórico, nos alertas e no CSV. |
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
| Processamento | O dispositivo entra, recebe o token, consulta os processos e chama POST /lotes. Valem as mesmas regras de RF07 a RF11. |
| Saídas | Lote gravado e identificado no histórico como registrado por "Sensor de vazão (Wokwi)". |
| Prioridade | Desejável |
| Origem | US-09 · TAP, seção 6 |
| Situação | Implementado. |
| Verificação | Teste e Demonstração: SensorInicialTest; cadaPerfilAcessaSoOQueLheCabe. Lotes enviados pelo Wokwi à API publicada. |

#### RF26 — Medir o lote no dispositivo

| Atributo | Descrição |
|---|---|
| Descrição | O dispositivo simulado deve medir a água de um lote e enviá-lo ao final. |
| Entradas | Vazão (potenciômetro, 0 a 30 L/min) e botão de iniciar/encerrar. |
| Processamento | O 1º toque no botão inicia o lote e acende o LED; o dispositivo conta os pulsos (referência YF-S201, cerca de 450 pulsos por litro). O 2º toque encerra; se a água medida for maior que zero, o dispositivo localiza o processo pelo nome e envia o lote. |
| Saídas | Monitor serial com a vazão, o total acumulado, o resultado do envio (HTTP 201) e o status do lote devolvido pela API. Se o status for crítico (desvio acima de 8%), o buzzer apita 3 vezes e o LED vermelho pisca e fica aceso até o próximo lote. |
| Prioridade | Desejável |
| Origem | US-09 · TAP, seção 6 |
| Situação | Implementado (pasta iot/). |
| Verificação | Demonstração: Wokwi em 06/11/2026: lote de 19,55 L classificado como crítico (LED vermelho aceso) e lote de 3,74 L dentro da meta. |

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
| RNF17 | Registro de lote rápido com vários sensores ao mesmo tempo. Medido em 03/11/2026, no ambiente local: com 50 sensores simultâneos, p95 de 68 ms, cerca de 1.000 lotes por segundo e nenhuma falha. O sistema publicado, com menos recursos, não foi medido. | Medido (local) |
| RNF22 | Índices medidos com EXPLAIN ANALYZE (migração V8): a regra de alerta caiu de 73,5 ms para 0,19 ms com 200.000 lotes; o fechamento mensal usa Index Scan. | Implementado |
| RNF23 | A lista de processos fica em cache na API e é atualizada depois de cada cadastro ou edição. | Implementado |

## 3.3 Requisitos de usabilidade

| ID | Requisito | Situação |
|---|---|---|
| RNF12 | Interface em português do Brasil, com linguagem do chão de fábrica, mensagens de erro junto ao campo e poucos passos por registro. | Implementado |
| RNF13 | Acessibilidade: status nunca indicado só por cor (sempre cor, ícone e texto); campos com rótulo; navegação por teclado; respeito à preferência de reduzir animações; tema claro, escuro ou automático. | Implementado |
| RNF25 | Validação com um operador real, com o roteiro e o questionário SUS de docs/validacao/. | **Pendente** (issue #50) |
| RNF26 | Glossário dos termos têxteis (estonagem, amaciamento, alvejamento, tingimento) disponível na interface, com dica acessível por teclado e sugestão do nome padrão no cadastro de processo. | Implementado (issue #55) |

## 3.4 Interfaces externas

### 3.4.1 Interfaces com o usuário

| Tela | Perfil | Conteúdo principal |
|---|---|---|
| Login | público | Usuário, senha (com botão de mostrar), botão Entrar; orientação para pedir ao administrador em caso de esquecimento; link para o aviso de privacidade. |
| Aviso de privacidade | público | Dados pessoais guardados, para quê, por quanto tempo e quem vê; com quem são compartilhados; direitos e com quem falar (RNF27). Também no rodapé das telas. |
| Dashboard | gestor, administrador | Indicadores do mês, alertas ativos, resumo por processo e gráficos de meta e consumo por processo e por dia. |
| Alertas e detalhe do alerta | gestor, administrador | Abas por status; sequência de lotes que gerou o alerta; ações "em análise" e "resolvido" com confirmação. |
| Relatórios e pré-visualização do PDF | gestor, administrador | Escolha de mês e ano; tabela por processo; pré-visualização A4 e download em PDF. |
| Registro de lotes e resultado | operador, gestor, administrador | Processo, peças e litros; prévia do esperado; confirmação; resultado com desvio e status; lotes guardados no aparelho, com enviar agora, tentar de novo e descartar. |
| Histórico de lotes | operador, gestor, administrador | Lista com filtro por processo e botão "Exportar CSV"; gestor e administrador também veem quem registrou. |
| Processos e metas | gestor, administrador | Lista de processos; cadastro e edição com nome, unidade e meta. |
| Usuários | administrador | Lista com situação; cadastrar, desativar, reativar e redefinir senha. |
| Auditoria | administrador | Registros das ações sobre contas, com filtro por período e ação, e paginação; pessoas pelo nome, com o login mascarado. |
| Configurações da conta | todos | Nome editável; usuário e perfil somente leitura; troca de senha. |
| Sessão expirada, acesso negado e página não encontrada | todos | Mensagens claras com caminho de volta. |

Todas as telas mostram estados de carregamento, de lista vazia e de erro com opção de tentar de novo (RNF11).

### 3.4.2 Interfaces de hardware

O sistema web não exige hardware específico. O sensor simulado usa: ESP32 DevKit C v4; potenciômetro no pino 34 (vazão de 0 a 30 L/min); gerador de pulsos no pino 25, ligado por fio à entrada de contagem no pino 27 (no dispositivo físico, o sinal do sensor de vazão entra direto no pino 27); botão no pino 4 (iniciar/encerrar lote); LED azul no pino 2 (lote em andamento); LED vermelho no pino 33 e buzzer no pino 26 (aviso de lote crítico). Referência de sensor: YF-S201, cerca de 450 pulsos por litro, a calibrar no dispositivo físico. A especificação da bancada física está em docs/tecnico/hardware-bancada.md.

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
- 19 endpoints: autenticação (2), usuários (5), processos (3), lotes (3), alertas (2), relatórios (1), auditoria (1) e monitoramento (2), descritos em docs/tecnico/api.md e no Swagger.
- Códigos de resposta padronizados: 400, 401, 403, 404, 405, 409, 422, 429, 500 e 503, sempre no formato {codigo, mensagem, campos}.
- Registro de lote: cabeçalho opcional Idempotency-Key (UUID); um reenvio com a mesma chave devolve o lote já gravado (200), em vez de criar outro (201).
- Sensor simulado: HTTPS com conferência da impressão digital do certificado no projeto público; HTTP sem criptografia, pelo túnel, só no projeto local de testes (RNF06).
- Aviso: a API chama a Bot API do Telegram por HTTPS (porta 443).

## 3.5 Requisitos lógicos de banco de dados

| Tabela / visão | Conteúdo e regras |
|---|---|
| usuario | Nome, login (único, 3 a 60 caracteres), hash da senha, perfil (admin, gestor, operador ou sensor), ativo, data de criação. |
| processo | Nome (único), unidade (lote ou peça) e meta (> 0). |
| lote | Processo, usuário, peças, litros, esperado, data e chave de envio (única, opcional). O esperado é preenchido pelo trigger trg_lote_esperado; o trigger trg_lote_imutavel impede UPDATE e DELETE. |
| alerta | Processo, data de detecção, status (aberto, análise, resolvido) e data da última mudança de status. |
| alerta_lote | Lotes de cada alerta; um lote pertence a no máximo um alerta. |
| auditoria_usuario | Quem fez, quem foi afetado, ação (criação, redefinição de senha, desativação, reativação) e data; o trigger trg_auditoria_imutavel impede UPDATE e DELETE. |
| v_historico_lotes, v_alertas | Visões que entregam o desvio já calculado. |

Os dados de consumo são permanentes: não há exclusão de lotes, de registros de auditoria nem de usuários. Os relatórios consideram o mês no fuso America/Recife. Índices: por data, por usuário, por processo e data (regra de alerta) e por alerta em alerta_lote.

## 3.6 Restrições de projeto

- Pilha tecnológica definida pela equipe: React, Java com Spring Boot e PostgreSQL (TAP, seção 5).
- O esquema do banco é versionado com migrações Flyway (V1 a V8), aplicadas por um usuário dono do banco. O Hibernate não cria nem altera tabelas: ao iniciar, a API apenas confere se elas batem com as entidades e não sobe se divergirem.
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
| RNF21 | Backup do banco com verificação: o backup só é aceito depois de restaurado num banco temporário com as tabelas conferidas; restauração só em banco vazio. | Implementado |

### 3.7.2 Disponibilidade

| ID | Requisito | Situação |
|---|---|---|
| RNF11 | Sem conexão com o banco, a API responde 503 (BANCO_INDISPONIVEL) e as telas mostram estado de erro com opção de tentar de novo. | Implementado |
| RNF20 | Monitoramento: /api/actuator/health aberto (só diz se a API está no ar) e usado pelo Render como checagem de saúde; /api/actuator/metrics só para o administrador, com tempo de resposta por rota, memória e conexões. Nenhum outro endpoint do Actuator fica exposto. | Implementado |

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
| RNF19 | Limite de requisições por minuto: 5 tentativas de login por IP e 60 lotes por usuário; acima disso, 429 (LIMITE_EXCEDIDO) com o cabeçalho Retry-After. | Implementado |
| RNF27 | Privacidade (LGPD, Lei nº 13.709/2018): (a) a tela de login tem um link para o aviso de privacidade, aberto sem entrar, que diz quais dados pessoais são guardados, para quê, por quanto tempo, quem vê e com quem falar; (b) o login de outra pessoa só sai inteiro da API para o administrador na lista de usuários; na auditoria e na lista de usuários pedida pelo gestor, vai mascarado (no máximo metade dos caracteres e sempre quatro asteriscos, ex.: ca****in), com o nome inteiro; (c) o CSV e o PDF levam só o nome, sem login, senha ou perfil. | Implementado (issue #117) |

A política de segurança, a análise de riscos e o plano de continuidade estão em docs/gestao/seguranca.md.

### 3.7.4 Manutenibilidade

| ID | Requisito | Situação |
|---|---|---|
| RNF15 | Código em camadas (controller, service, repository, entity, DTO) e testes automatizados: 98 no back-end (unidade, web e integração com PostgreSQL 18), 47 de unidade e 3 de ponta a ponta no site. Os testes nunca usam o banco oficial. | Implementado |
| RNF16 | GitFlow: develop como branch padrão; mudanças por pull request, com modelo de descrição e aviso quando um PR aponta para a main fora de release ou hotfix. | Adotado |
| RNF24 | Integração contínua: a cada pull request, testes do back-end, build e testes do site e teste do Docker. Entrega contínua: o Render só publica depois que o CI passa. | Implementado |

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
| RNF12, RNF13, RNF14 | Demonstração e inspeção | Uso no computador e no celular; revisão de acessibilidade das telas; tema.test.ts. |
| RNF15, RNF16, RNF24 | Inspeção | Estrutura do código, histórico de pull requests e execuções do CI. |
| RNF17, RNF22 | Análise | docs/tecnico/teste-carga.md e docs/tecnico/desempenho-indices.md. |
| RNF18, RNF23 | Teste | resumoMensalUsaFusoDeRecife, fusoPadraoDosRelatoriosERecife; ProcessoServiceCacheTest. |
| RNF19 | Teste | LimiteDeRequisicoesTest. |
| RNF20 | Teste | saudeAbertaMostraSoOStatusSemToken, metricasSoParaOAdmin, outrosEndpointsDoActuatorFicamFechados. |
| RNF21 | Demonstração | database/backup.sh, que restaura o backup num banco temporário e confere as tabelas. |
| RNF25 | Teste de usabilidade | Roteiro e questionário SUS de docs/validacao/ (pendente). |
| RNF26 | Teste | glossario.test.ts. |
| RNF27 | Teste e inspeção | e2e/privacidade.spec.ts (critério de aceitação: o aviso abre a partir do login), privacidade.test.ts, PrivacidadeTest, AuditoriaServiceTest e auditoriaListaAsAcoesComFiltrosEPaginacao (integração); conferência do CSV e do PDF na seção 6.4 de docs/gestao/seguranca.md. |

**Ambiente e resultado.** Os testes automatizados rodam no GitHub Actions em toda mudança: 98 testes do back-end (com PostgreSQL 18 em contêiner), 47 de unidade e 3 de ponta a ponta do site, e o teste do Docker Compose. Na última execução da develop (CI nº 88, 06/11/2026), todos passaram. O plano, os casos e o relatório completos estão em docs/tecnico/testes.md, conforme a ISO/IEC/IEEE 29119.

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
- Registro de volume de efluente e índice de reúso, conforme a decisão P7 do Registro de Decisões v1.
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
| RF28 | US-11 | POST /lotes (Idempotency-Key) | Registro de lotes | Teste | Implementado |
| RF29 | US-12 | GET /lotes | Histórico de lotes | Teste | Implementado |
| RF30 | US-13 | — (Bot API do Telegram) | — (grupo do Telegram) | Teste e Demonstração | Implementado |
| RF31 | US-15 | — | — | Não se aplica | Adiado (Apêndice B) |

Resumo: 31 requisitos funcionais, 30 implementados e 1 adiado (RF31); 27 requisitos não funcionais, 26 implementados, adotados ou medidos e 1 pendente (RNF25).

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
