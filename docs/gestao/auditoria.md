<p align="center"><img src="../assets/logo-referencia.png" width="120" alt="Logo do Águas do Capibaribe"></p>

# Águas do Capibaribe — Auditoria nas Normas e Cronograma de Entrega

Auditoria da documentação e do processo do projeto nas normas ISO/IEC de documentação em tecnologia, e cronograma das
atividades de cada integrante até a entrega final. Atividade da disciplina de Engenharia de Requisitos.

| Campo | Descrição |
|---|---|
| Versão | 1.1, 14 de novembro de 2026 |
| Apresentação | 16/11/2026, em sala, por Pedro e Matheus Andrade |
| Base | Pareceres técnicos do Prof. Fábio Chicout (27/10, 03/11 e 10/11/2026); quadro de normas da disciplina; repositório na versão 1.1.0 |
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
| **Ajustado** | Estava fora e foi corrigido durante a auditoria (09 a 14/11/2026). |
| **Pendente** | Ainda falta; tem responsável e data no cronograma (seção 5). |

# 2. Resultado por norma

| Norma | Documento | Situação | O que foi conferido |
|---|---|---|---|
| ISO/IEC/IEEE 29148 (requisitos) | ERS v2.5 (`docs/gestao/ERS.pdf`) | Conforme, com ajustes | Estrutura da norma, necessidades de negócio e dos stakeholders, conceito de operação, método de verificação em cada requisito, matriz de rastreabilidade com a verificação; 35 requisitos funcionais (34 implementados, 1 adiado) e 28 não funcionais (27 atendidos, 1 parcial: RNF25, sem operador real) |
| ISO/IEC/IEEE 42010 (arquitetura) | Arquitetura v1.2 (`docs/tecnico/arquitetura.pdf`) | Conforme, com ajustes | Partes interessadas e preocupações, pontos de vista, visões de contexto, lógica, dados, implantação e desenvolvimento, diagramas C4 nos níveis 1 a 3, decisões e ligação com a ERS |
| ISO/IEC/IEEE 26514 (documentação do usuário) | Guia v2.2 (`docs/guia/`) | Conforme, com ajustes | Seção "Sobre este guia" (público, por onde começar, convenções), tarefas do dia a dia por perfil, problemas comuns e referências |
| ISO/IEC/IEEE 29119 (testes) | Testes v1.1 (`docs/tecnico/testes.pdf`) | Conforme | Plano, níveis e ambientes, critérios, casos por função, procedimentos e relatório: 378 testes automáticos passando em 14/11/2026, carga com 100 sensores, CI com vulnerabilidades e mutação |
| ISO/IEC 12207 (ciclo de vida) | Ciclo de vida v1.0 (`docs/gestao/ciclo-de-vida.pdf`) | Conforme, com ajustes de processo | Processos de acordo, organizacionais, de gestão técnica e técnicos, cada um com o registro que o comprova, e plano de descarte |
| ISO/IEC 27001 (segurança da informação) | Segurança v1.2 (`docs/gestao/seguranca.pdf`) | Conforme, com ajustes | Política, papéis, análise de 14 riscos, controles do Anexo A, resposta a incidentes, continuidade e LGPD |

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

# 4. Participação por integrante (03 a 14/11/2026)

Entregas com pull request mergeado na `develop`. A revisão e o merge ficaram com o Paulo, como pede o parecer.

| Integrante | Papel | Entregas |
|---|---|---|
| Abraão Filipe | Back-end | Modo offline (#54), cache de processos (#46), CSV do histórico (#48), token de API do sensor (#103), testes de mutação (#102), aviso do Telegram com tentativas (#97, parte 1) |
| João Bezerra | Back-end | Aviso de lote crítico com buzzer e LED (#83) |
| Mateus Basilio | Banco de dados | Índices (#59), backup e restore (#53), monitoramento (#51), glossário (#55), análise de particionamento (#100), índice parcial (#110), calibração do sensor (#114), painel de eventos de segurança (#109), filtros do histórico (#107) |
| Matheus Andrade | Front-end | Tema escuro (#82), LGPD (#117), contraste WCAG AA (#106), contador do 429 (#101), avaliação simulada (#50), correção de números (#139), gauge (#98), reenvio de avisos (#97, parte 2), CSV pela API (#99) |
| Paulo Moura | DevOps e revisão | CI e entrega contínua, vulnerabilidades (#112), segredos (#118), imagem distroless (#105), carga com 100 sensores (#113), diagramas C4 (#111), token no sensor (#129), pegada hídrica (#116), revisão de segurança (#153), normas e documentação; até 05/11, também #52, #56, #57, #58, #60 e #66; revisão e merge dos PRs |
| Pedro | PO / Full Stack | Roteiro de validação (#50), remoção do modo simulado (#49), adiamento do RF31 (#47), teste de ponta a ponta do operador (#104), buffer do sensor sem Wi-Fi (#108) |

**Redistribuições registradas no GitHub:** #55 e #99 (de João para Mateus Basilio e Matheus Andrade), #98 (de Pedro
para Matheus Andrade), #109 (de Abraão para Mateus Basilio), #116 e #129 (de João para Paulo) e #97 (dividida entre
Abraão e Matheus Andrade). Nas issues #99 e #116, o responsável original informou que não as faria.

# 5. Cronograma até a entrega final

Prazo final: **23/11/2026**. O formato da entrega desse dia será confirmado com o professor em 17/11.

| Data | Atividade | Responsável |
|---|---|---|
| 14/11 | Versão 1.1.0 lançada, documentos atualizados, revisão de segurança (#153) e validação encerrada (#50) | Paulo e Matheus Andrade |
| 16/11 | Apresentação da auditoria e do cronograma em sala | Pedro e Matheus Andrade |
| 17 a 19/11 | Últimas entregas, issues novas e feedbacks do professor; roteiro da demonstração final (#115), depois de confirmar o formato do dia 23 | equipe; roteiro com Pedro |
| 20 e 21/11 | Revisão final e correções | Paulo e responsáveis de cada módulo |
| 22/11 | Congelar funcionalidades, limpeza do banco publicado e ensaio da apresentação | equipe |
| 23/11 | Prazo final (formato a confirmar com o professor) | equipe |

# 6. Pendências e riscos

| Item | Situação | Tratamento |
|---|---|---|
| Teste com operador real (RNF25) | Limitação registrada | Validação feita com pessoas de fora da equipe e por avaliação simulada; kit pronto para um teste real |
| Roteiro da demonstração final (#115) | Pendente | Pedro, depois da resposta do professor sobre o dia 23 (17/11) |
| Ata do orientador sobre a bancada física | Pendente | Proposta de ficar no simulado, registrada no TAP |
| Diagrama C4 nível 3 | Desatualizado em parte | Não mostra o filtro do token nem o reenvio dos avisos; o texto da arquitetura descreve os dois |
| API do plano grátis dorme sem uso | Risco | Abrir o site antes; Docker como plano B |
| Simulador lento derruba a conexão do sensor | Risco | Fechar programas pesados e testar antes |
| Certificado da API (vale até 20/12/2026) | Risco baixo | Comando para atualizar a impressão digital no sketch |
