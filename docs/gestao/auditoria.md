<p align="center"><img src="../assets/logo-referencia.png" width="120" alt="Logo do Águas do Capibaribe"></p>

# Águas do Capibaribe — Auditoria nas Normas e Cronograma de Entrega

Auditoria da documentação e do processo do projeto nas normas ISO/IEC de documentação em tecnologia, e cronograma das
atividades de cada integrante até o code freeze e a feira ProjetAÍ. Atividade da disciplina de Engenharia de Requisitos.

| Campo | Descrição |
|---|---|
| Versão | 1.3, 26 de novembro de 2026 |
| Apresentação | 16/11/2026, em sala, por Pedro e Matheus Andrade |
| Base | Pareceres técnicos do Prof. Fábio Chicout (27/10, 03/11, 10/11, 17/11 e 24/11/2026); quadro de normas da disciplina; repositório na versão 2.0.0, do code freeze de 27/11/2026 |
| Escopo | Documentos de `docs/`, READMEs, código da branch `develop` e processo no GitHub (issues, pull requests e CI) |
| Equipe | Abraão Filipe, João Bezerra, Mateus Basilio, Matheus Andrade, Paulo Moura e Pedro |
| Orientador | Prof. Fábio Chicout |

<!-- sumario -->

# 1. Método

Para cada norma, a auditoria conferiu três coisas:

1. **Estrutura:** se o documento tem as partes que a norma pede.
2. **Fidelidade:** se o que o documento diz bate com o código, os testes e o sistema publicado.
3. **Processo:** se o trabalho no GitHub (issues, pull requests, revisão e CI) segue o que os documentos descrevem.

Classificação de cada item:

| Situação | Significado |
|---|---|
| **Conforme** | Atende à norma e bate com o sistema. |
| **Ajustado** | Estava fora e foi corrigido durante a auditoria (09 a 26/11/2026). |
| **Pendente** | Ainda falta; tem responsável e data no cronograma (seção 5). |

# 2. Resultado por norma

| Norma | Documento | Situação | O que foi conferido |
|---|---|---|---|
| ISO/IEC/IEEE 29148 (requisitos) | ERS v2.8 (`docs/gestao/ERS.pdf`) | Conforme, com ajustes | Estrutura da norma, necessidades de negócio e dos stakeholders, conceito de operação, método de verificação em cada requisito, matriz de rastreabilidade com a verificação; 39 requisitos funcionais (38 implementados, 1 adiado) e 29 não funcionais (28 atendidos, 1 parcial: RNF25, sem operador real) |
| ISO/IEC/IEEE 42010 (arquitetura) | Arquitetura v1.4 (`docs/tecnico/arquitetura.pdf`) | Conforme, com ajustes | Partes interessadas e preocupações, pontos de vista, visões de contexto, lógica, dados, implantação e desenvolvimento, diagramas C4 nos níveis 1 a 3, decisões e ligação com a ERS |
| ISO/IEC/IEEE 26514 (documentação do usuário) | Guia v2.4 (`docs/guia/`) | Conforme, com ajustes | Seção "Sobre este guia" (público, por onde começar, convenções), tarefas do dia a dia por perfil, problemas comuns e referências |
| ISO/IEC/IEEE 29119 (testes) | Testes v1.3 (`docs/tecnico/testes.pdf`) | Conforme | Plano, níveis e ambientes, critérios, casos por função, procedimentos e relatório: 625 testes automáticos passando em 26/11/2026, acessibilidade com axe-core, carga com 100 sensores e turno com 120, CI com vulnerabilidades, mutação, SBOM e Quality Gate no SonarQube |
| ISO/IEC 12207 (ciclo de vida) | Ciclo de vida v1.2 (`docs/gestao/ciclo-de-vida.pdf`) | Conforme, com ajustes de processo | Processos de acordo, organizacionais, de gestão técnica e técnicos, cada um com o registro que o comprova, e plano de descarte |
| ISO/IEC 27001 (segurança da informação) | Segurança v1.5 (`docs/gestao/seguranca.pdf`) | Conforme, com ajustes | Política, papéis, análise de riscos, controles do Anexo A, resposta a incidentes, continuidade (com o runbook de recuperação ensaiado) e LGPD |

# 3. Achados e ajustes

| Nº | Achado | Norma | Ajuste | Evidência |
|---|---|---|---|---|
| A01 | A ERS seguia a IEEE 830, substituída pela ISO/IEC/IEEE 29148. | 29148 | ERS migrada para a nova norma, com verificação em cada requisito. | ERS v2.0 (PR #95) |
| A02 | Requisitos entregues na sprint (token do sensor, reenvio de avisos, gauge, buffer, contador do 429, contraste, segurança do contêiner) não estavam na ERS, e o cabeçalho dizia uma versão anterior ao histórico. | 29148 | RF35 e RNF28 criados; RF24, RF26, RF30, RNF13, RNF15, RNF17, RNF19 e RNF24 atualizados; versão 2.4. | PR #151 |
| A03 | Não havia descrição de arquitetura com visões nem diagramas. | 42010 | Documento novo com C4 em Mermaid e SVG. | PRs #95 e #123 |
| A04 | O guia não dizia para quem era nem como usá-lo. | 26514 | Seção "Sobre este guia"; telas novas descritas na versão 2.2. | PRs #95 e #151 |
| A05 | O CI não procurava vulnerabilidades nas bibliotecas. Na primeira rodada, achou 16 graves. | 27001 | Job `dependencias` com o OSV-Scanner; as 16 corrigidas; 2 exceções com motivo e data. | PR #119 |
| A06 | No Docker, senhas apareciam como variáveis de ambiente, e a imagem da API tinha shell e root. | 27001 | Segredos como arquivos só de leitura; imagem distroless de 132 MB; o CI confere as duas coisas. | PRs #120 e #121 |
| A07 | O sensor entrava com senha, que ficava exposta no simulador público. | 27001 | Token de API trocável pelo administrador, com auditoria; o sketch usa o token. | PRs #125, #126 e #131 |
| A08 | Integrantes faziam merge do próprio PR, sem revisão, e PRs não fechavam a issue. | 12207 | Modelo de PR com a regra do merge pelo revisor e `Closes #N`. | PR #130 |
| A09 | Issues foram fechadas sem entrega e outras mudaram de responsável sem registro. | 12207 | Issues reabertas e redistribuições registradas no GitHub, com o motivo. | Issues #97, #99, #109, #116 |
| A10 | A validação com operador real não pôde ser feita. | 29148 / 29119 | Avaliação simulada por inspeção, sem nota SUS, e o problema que ela achou (#139) corrigido; teste com pessoas de fora da equipe, sem dificuldades relevantes; limitação registrada. | PRs #140 e #141; issue #50 |
| A11 | Um requisito (vários sensores por linha) não tinha como ser demonstrado sem custo. | 29148 | RF31 adiado, com o motivo no Apêndice B da ERS. | PR #96 |
| A12 | O teste de carga só rodava num computador e não falhava ao estourar a meta. | 29119 | Teste no GitHub Actions, com 100 sensores e comparação de pool; falha visível. | PR #122 |
| A13 | Na revisão de segurança, o site publicado não tinha CSP nem proteção contra clickjacking, a documentação da API ficava aberta na internet e o limite de login contava só por IP. | 27001 | Cabeçalhos de segurança no Render e no Docker, conferidos pelo CI; documentação da API só no ambiente local; limite de login também por conta. | PR #153 |
| A14 | As issues do parecer Week 03 citavam requisitos e nomes que não batiam com o sistema (por exemplo, RF18 para a planilha, que na ERS é a desativação de usuário, e a migração V10, que já existia). | 29148 | Comentário com os nomes reais em cada issue; requisitos novos e atualizados na ERS (RF36, RF37 e RNF29); CHANGELOG e documentação da API com os códigos certos. | Issues #156, #157 e #162; ERS v2.6 |
| A15 | Não havia medição de cobertura nem análise estática. A primeira análise do SonarQube achou 2 bugs e 6 problemas críticos ou bloqueantes no back-end. | 29119 / 12207 | Cobertura com JaCoCo e Vitest e Quality Gate no CI; os 2 bugs e os 6 problemas corrigidos; cada PR novo só entra com o gate aprovado. | PRs #173, #185, #186, #193 e #195 |
| A16 | Os contêineres do banco e do site rodavam como root, e não havia lista dos componentes de cada versão (SBOM). | 27001 | Contêineres sem root e com privilégios mínimos, conferidos pelo CI; SBOM CycloneDX da API e do site, anexado às releases. | PRs #174 e #175 |
| A17 | O plano de continuidade não dizia, passo a passo, como voltar de um desastre, nem quanto tempo levaria. | 27001 | Runbook com árvore de decisão, metas de RTO e RPO e ensaio medido (23 s no Docker). | PR #177 |
| A18 | A acessibilidade era conferida só à mão. Na primeira auditoria automática, o link do logo tinha um nome para leitor de tela diferente do texto visível. | 26514 / 29119 | Auditoria WCAG 2.1 AA com axe-core nos testes de ponta a ponta; o link corrigido. | PR #176 |
| A19 | Na ERS, a linha do RNF28 estava dentro da tabela de necessidades, fora da seção de segurança. | 29148 | Linha movida para a seção 3.7.3. | ERS v2.6 |
| A20 | Os efluentes e o custo da água entraram no código sem requisito na ERS, que ainda dava os efluentes como adiados. | 29148 | RF38 (custo da água) e RF39 (efluentes) criados, com verificação e rastreabilidade; item retirado do Apêndice B. | ERS v2.7 e v2.8 |
| A21 | PRs com "Fecha #N" não fecharam a issue no merge: o GitHub só reconhece as palavras em inglês. | 12207 | PRs passam a usar `Closes #N`; as issues afetadas foram fechadas à mão, com o link do PR. | Issue #212; PR #236 |
| A22 | O ensaio de restauração usava um banco quase vazio, e a verificação do backup não conferia descartes, telemetria e avisos pendentes. | 27001 | Ensaio de novo com a massa da demonstração (35 s, 10 tabelas idênticas); verificação ampliada. | PR #224 |

# 4. Participação por integrante (03 a 26/11/2026)

Entregas com pull request mergeado na `develop`. A revisão e o merge ficaram com o Paulo, como pede o parecer.

| Integrante | Papel | Entregas |
|---|---|---|
| Abraão Filipe | Back-end | Modo offline (#54), cache de processos (#46), CSV do histórico (#48), token de API do sensor (#103), testes de mutação (#102), aviso do Telegram com tentativas (#97, parte 1), disjuntor nos avisos do Telegram (#164), auditoria de segurança antes do freeze, com o Paulo (#216) |
| João Bezerra | Back-end | Aviso de lote crítico com buzzer e LED (#83), validação da telemetria (#156), telemetria gravada e testes da camada web (#157), saúde do sensor no Actuator (#158), sinal de vida do sensor no Wokwi (#218), README com badges (#217), primeiro deck da feira (#215) |
| Mateus Basilio | Banco de dados | Índices (#59), backup e restore (#53), monitoramento (#51), glossário (#55), análise de particionamento (#100), índice parcial (#110), calibração do sensor (#114), painel de eventos de segurança (#109), filtros do histórico (#107), auditoria de descarte de efluentes (#162), autovacuum e conferência de inchaço (#163), turno industrial com 120 sensores (#165), teste da massa da demonstração (#210), ensaio de restauração com a massa (#219) |
| Matheus Andrade | Front-end | Tema escuro (#82), LGPD (#117), contraste WCAG AA (#106), contador do 429 (#101), avaliação simulada (#50), correção de números (#139), gauge (#98), reenvio de avisos (#97, parte 2), CSV pela API (#99), planilha Excel (#159), envio em segundo plano (#160), esqueletos de carregamento (#161), tela Custo da água (#229), correções do SonarQube no site |
| Paulo Moura | DevOps e revisão | CI e entrega contínua, vulnerabilidades (#112), segredos (#118), imagem distroless (#105), carga com 100 sensores (#113), diagramas C4 (#111), token no sensor (#129), pegada hídrica (#116), revisão de segurança (#153), Quality Gate no SonarQube (#168), SBOM (#169), runbook de recuperação (#170), contêineres sem root (#171), acessibilidade com axe-core (#172), massa e roteiro da demonstração (#115), lote crítico ao vivo no Telegram, efluentes na API, no banco e na tela (#201 a #203), acessibilidade e ponta a ponta dos efluentes (#212 e #213, a pedido da equipe), plano C e script da aula de banco de dados (#225 e #227), deck da feira no Canva (#215), correções do SonarQube no back-end e no site, repositório público, normas e documentação; até 05/11, também #52, #56, #57, #58, #60 e #66; revisão e merge dos PRs |
| Pedro | PO / Full Stack | Roteiro de validação (#50), remoção do modo simulado (#49), adiamento do RF31 (#47), teste de ponta a ponta do operador (#104), buffer do sensor sem Wi-Fi (#108), avaliação heurística de usabilidade (#166), teste de ponta a ponta do fluxo do alerta (#167) |

**Redistribuições registradas no GitHub:** #55 e #99 (de João para Mateus Basilio e Matheus Andrade), #98 (de Pedro
para Matheus Andrade), #109 (de Abraão para Mateus Basilio), #116 e #129 (de João para Paulo) e #97 (dividida entre
Abraão e Matheus Andrade). Nas issues #99 e #116, o responsável original informou que não as faria. No parecer
Week 03, as issues do professor ficaram sem responsável e foram distribuídas pela equipe em 17/11/2026; a #165 passou
de Abraão para Mateus Basilio.

# 5. Cronograma até o code freeze e a feira

Code freeze: **27/11/2026**, com a versão 2.0.0, a final (#207). O que estiver na `main` nesse dia é a base da
avaliação. As apresentações na feira ProjetAÍ vão de 30/11 a 03/12/2026.

| Data | Atividade | Responsável |
|---|---|---|
| 14/11 | Versão 1.1.0 lançada, documentos atualizados, revisão de segurança (#153) e validação encerrada (#50) | Paulo e Matheus Andrade |
| 16/11 | Apresentação da auditoria e do cronograma em sala | Pedro e Matheus Andrade |
| 17 a 21/11 | Issues do parecer Week 03 (#156 a #172), correções do SonarQube e atualização dos documentos | equipe |
| 23/11 | Roteiro e massa de dados da demonstração (#115) e efluentes completos (#201 a #203) | Paulo |
| 24 a 26/11 | Issues do parecer Week 04 (#207 a #221), custo da água, plano C e atualização final dos documentos | equipe |
| 27/11 | Code freeze: versão 2.0.0 na `main`, limpeza das branches (#220) e homologação pela equipe (#221) | Paulo e equipe |
| 30/11 | Nova análise dos projetos pelo orientador e cronograma das apresentações | orientador |
| 30/11 a 03/12 | Apresentações na feira ProjetAÍ, com ensaio (#208), teste ao vivo do sensor e do Telegram (#209) e vídeo de contingência (#214) | Pedro e Matheus Andrade (apresentação); equipe |

# 6. Pendências e riscos

| Item | Situação | Tratamento |
|---|---|---|
| Teste com operador real (RNF25) | Limitação registrada | Validação feita com pessoas de fora da equipe e por avaliação simulada; kit pronto para um teste real |
| Ensaio, teste ao vivo e vídeo da demonstração (#208, #209 e #214) | Pendente | Depois do freeze, antes da apresentação; o deck e o roteiro de 5 a 7 minutos estão prontos (#215) |
| Ata do orientador sobre a bancada física | Pendente | Proposta de ficar no simulado, registrada no TAP |
| Diagrama C4 nível 3 | Desatualizado em parte | Não mostra o filtro do token, o reenvio dos avisos, o disjuntor nem a telemetria; o texto da arquitetura descreve todos |
| API do plano grátis dorme sem uso | Risco | Abrir o site antes; Docker como plano B |
| Lote de Estonagem registrado no site publicado antes da demonstração | Risco | A massa deixa 2 lotes seguidos acima da meta, e o 3º vem do sensor ao vivo e abre o alerta. Um lote acima antecipa o alerta, e um dentro da meta zera a sequência. Se acontecer, limpar o banco e rodar a massa de novo |
| Simulador lento derruba a conexão do sensor | Risco | Fechar programas pesados e testar antes |
| Certificado da API (o Render renovou em 19/11/2026, antes do vencimento de 20/12, e o sensor passou a recusar a API) | Tratado em 26/11 | Impressão digital do certificado novo, que vale até 17/02/2027; conferir com o comando do sketch antes de cada apresentação |
