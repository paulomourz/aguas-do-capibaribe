<p align="center"><img src="../assets/logo-referencia.png" width="120" alt="Logo do Águas do Capibaribe"></p>

# Águas do Capibaribe — Avaliação Heurística de Usabilidade

Inspeção da interface pelas 10 heurísticas de Jakob Nielsen, nos fluxos de abertura de lote, visualização do gauge de
tolerância e reconhecimento de alertas, com a gravidade de cada problema e o plano de correção para a equipe de
front-end. Referência de usabilidade: ISO 9241-11 (eficácia, eficiência e satisfação num contexto de uso).

| Campo | Descrição |
|---|---|
| Versão | 1.0, 19 de novembro de 2026 |
| Sistema avaliado | Branch `develop` de 19/11/2026, versão 1.1.0 |
| Responsável | Pedro (PO) |
| Preparação | Inspeção feita com apoio de IA (Claude) a pedido do PO; revisão e validação do PO: ____ |
| Requisito relacionado | RNF25 (validação de usabilidade), que continua **Parcial**: esta inspeção não substitui o teste com operador real |
| Avaliação anterior | [Avaliação simulada de 11/11/2026](../validacao/resultados/2026-11-11-avaliacao-simulada-ia.md) (problemas P1 a P8), só do perfil operador |

<!-- sumario -->

# 1. Método

**Avaliação heurística** é uma inspeção: um avaliador percorre a interface e compara cada tela com princípios
conhecidos de usabilidade, as 10 heurísticas de Nielsen. Ela encontra problemas de interface sem precisar de usuários,
mas não mede satisfação nem a facilidade percebida, que a ISO 9241-11 também pede. Essas medidas dependem do teste com
operador e do questionário SUS, cujo kit está pronto em `docs/validacao/`.

| Item | Como foi feito |
|---|---|
| Fluxos | F1 abertura de lote (operador); F2 gauge de tolerância no resultado do lote (operador); F3 reconhecimento de alerta, de "Aberto" para "Em análise" e "Resolvido" (gestor) |
| Ambiente | Site de produção (`vite build`) com a API simulada dos testes de ponta a ponta (Playwright), sem dados reais |
| Telas | Celular (390 × 844 px) e computador (1280 × 800 px), tema claro |
| Dados usados | Tingimento (meta de 1.500 L por lote), lotes de 1.480 L (−1,3%), 1.590 L (+6,0%), 1.700 L (+13,3%) e 2.400 L (+60,0%); os três últimos abrem um alerta |
| Evidência | Capturas de cada passo, leitura do código das telas (`src/screens/RegistroLote.tsx`, `src/screens/Alertas.tsx`, `src/components/ToleranceGauge.tsx`) e das regras na API |

## 1.1 Escala de gravidade

A mesma escala do [roteiro de teste de usabilidade](../validacao/roteiro-teste-usabilidade.md) (Nielsen, 1994):

| Gravidade | Nome | Significado |
|---|---|---|
| 0 | Não é problema | Não é problema de usabilidade |
| 1 | Cosmético | Corrigir se sobrar tempo |
| 2 | Pequeno | Atrasa, mas o usuário resolve sozinho |
| 3 | Grave | O usuário precisa de ajuda ou registra um dado errado |
| 4 | Catastrófico | Impede a tarefa |

## 1.2 Contexto de uso considerado

O operador registra o lote ao fim de cada lavagem, perto da máquina, com pressa, às vezes com mãos molhadas ou de
luva, barulho e celular ou tablet compartilhado. O gestor acompanha os alertas no computador ou no celular. Esse
contexto foi **suposto** a partir dos documentos do projeto; não foi observado numa lavanderia.

# 2. Resultado por heurística

| Nº | Heurística | O que atende | Problemas |
|---|---|---|---|
| H1 | Visibilidade do status do sistema | Resultado logo após o registro, com cor, ícone, palavra ("Dentro da meta", "Atenção", "Crítico") e frase do que fazer; prévia do consumo esperado antes de registrar; aviso (toast) depois de mudar o status do alerta; contador de alertas abertos no menu | U01, U04, U05, U08 |
| H2 | Correspondência com o mundo real | Litros e peças como no chão de fábrica; meta escrita no próprio seletor ("Tingimento — 1.500 L/lote"); glossário dos processos | U07 |
| H3 | Controle e liberdade do usuário | "Voltar e corrigir" mantém o que foi digitado; "Cancelar" nos modais de alerta | U09, U12 |
| H4 | Consistência e padrões | Mesmas cores, ícones e selos de status em lote, gauge e alerta; o mesmo padrão "botão → modal de confirmação" no registro e no alerta | Nenhum encontrado |
| H5 | Prevenção de erros | Confirmação com processo, peças e litros antes de gravar; recusa de número ambíguo ("1.59") e de peças não inteiras (o problema P1, de "1.590" virar 2 L, foi corrigido na issue #139) | U02 |
| H6 | Reconhecer em vez de lembrar | Detalhe do alerta mostra a meta, o desvio médio e a sequência de lotes que o gerou | U10 |
| H7 | Flexibilidade e eficiência de uso | "Registrar novo lote" volta direto ao formulário, com o foco no processo | U02 (o mesmo atalho que economiza um passo facilita o erro) |
| H8 | Estética e design minimalista | Formulário com só três campos e um botão principal grande | U03, U06, U11 |
| H9 | Ajudar a reconhecer, diagnosticar e corrigir erros | Mensagens de campo com exemplo ("Digite só o número de litros, por exemplo 920 ou 1.590"); sem conexão, o lote fica guardado e a tela diz isso | Nenhum encontrado |
| H10 | Ajuda e documentação | Dica de cada campo; definição do processo (glossário) | Nenhum encontrado |

# 3. Problemas encontrados

Nenhum problema catastrófico (4) ou grave (3) foi encontrado nos três fluxos. O único problema grave da avaliação
anterior (P1) já foi corrigido, e há testes de ponta a ponta (`e2e/numeros.spec.ts`) que verificam a correção.

| Nº | Fluxo | Heurística | Problema | Gravidade |
|---|---|---|---|---|
| U01 | F1 | H1 | Com a conexão lenta ou o servidor fora do ar, o botão fica em "Registrando…" por até 15 s (`TEMPO_LIMITE_ENVIO_MS`) antes de guardar o lote, sem explicar a espera. O operador pode achar que travou e sair da tela. Já era o P3. | **2** |
| U02 | F1 | H5, H7 | "Registrar novo lote" mantém o processo do lote anterior já escolhido. Ajuda quem repete o processo, mas facilita registrar com o processo errado; a confirmação mostra o processo, o que reduz o risco. Já era o P5. | **2** |
| U03 | F1 | H8 | Ao escolher o processo, aparecem duas linhas de texto (a meta e a definição do glossário) que empurram Peças e Litros para baixo. Um toque rápido logo depois pode cair no lugar errado. Já era o P6, agora com o glossário. | **1** |
| U04 | F1, F2 | H1 | O 3º lote seguido acima da meta abre um alerta, mas o resultado só diz "Avise o gestor da lavanderia". Não informa que o alerta foi aberto nem que o gestor pode já ter sido avisado no Telegram, quando o aviso está configurado. Já era o P8; a gravidade subiu porque, nesta inspeção, ficou visto que o operador nunca fica sabendo do alerta. A confirmar com operador real. | **2** |
| U05 | F2 | H1 | A escala do gauge vai de −20% a +20%. Fora dela, o ponteiro para na ponta: um lote de +25% e um de +60% aparecem iguais no gauge. O número grande ao lado está certo. | **1** |
| U06 | F2 | H8 | O resultado mostra a mesma informação de quatro formas: selo, número, gauge e barras Meta × Real. Ajuda quem não lê bem, mas disputa a atenção num momento de pressa. A avaliar com operador real antes de mudar. | **1** |
| U07 | F2 | H2 | O gauge não tem números nas faixas, por decisão da issue #98 (os limites não aparecem na interface). O operador não sabe o quão perto está do crítico. O número e a palavra da faixa ficam ao lado. | **1** |
| U08 | F3 | H1 | O detalhe do alerta mostra só quando foi detectado. Não mostra quem o marcou em análise ou como resolvido, nem quando. A API guarda a data da última atualização (`atualizado_em`), mas não a envia ao site e não guarda quem mudou. | **2** |
| U09 | F3 | H3 | "Resolvido" é final: um alerta marcado por engano não pode ser reaberto. É regra do sistema (RF12; a API recusa a mudança). O modal de confirmação reduz o risco. | **1** |
| U10 | F3 | H6 | Ao marcar o alerta em análise ou como resolvido, não há onde escrever o que foi verificado ou feito. O gestor precisa lembrar ou anotar fora do sistema. | **2** |
| U11 | F3 | H8 | No celular, o menu do gestor em abas corta "Relatórios" e esconde os itens seguintes, sem sinal de que há mais itens para o lado. A aba "Alertas" fica visível, com o contador. | **1** |
| U12 | F1 | H3 | Depois de confirmado, o lote não pode ser editado nem apagado. É requisito (RF10, dados que não podem ser alterados, para conformidade), não um erro de interface. A confirmação é a única proteção, e por isso deve continuar. | **1** |

Resumo: 0 catastróficos, 0 graves, 5 pequenos e 7 cosméticos.

## 3.1 Situação dos problemas da avaliação anterior

| Nº | Situação nesta inspeção |
|---|---|
| P1 (gravidade 3) e P2 | Corrigidos (issue #139): ponto de milhar aceito, número ambíguo recusado e campo de litros com largura total no celular |
| P3 | Continua: U01 |
| P4 | Não verificado: o indicador de lotes guardados sem conexão ficou fora do escopo destes fluxos |
| P5 | Continua: U02 |
| P6 | Continua: U03 |
| P7 | Fora do escopo (histórico de lotes) |
| P8 | Continua, com gravidade maior: U04 |

# 4. Recomendações para o design system

Os componentes ficam em `src/components/ui.tsx` e `src/components/ToleranceGauge.tsx`. As recomendações seguem a
regra que o projeto já usa: **cor nunca sozinha**, sempre com ícone e texto (RNF13).

| Nº | Componente | Recomendação | Resolve |
|---|---|---|---|
| DS1 | `Button` | Estado de "espera longa": depois de cerca de 3 s em carregamento, mostrar abaixo do botão um texto como "A conexão está lenta. Se não houver resposta, o lote fica guardado neste aparelho." | U01 |
| DS2 | `Select` e `Field` | Sinal de "valor repetido do lote anterior" (selo ao lado do rótulo), para o operador perceber que o processo não foi escolhido agora. A alternativa, limpar o processo a cada lote, é decisão da equipe. | U02 |
| DS3 | `Field` (dica) | Dica longa recolhida: mostrar só a meta e deixar a definição do glossário no ícone de ajuda (`DicaGlossario`), sem empurrar os campos. | U03 |
| DS4 | `Banner` (no resultado do lote) | Variante "alerta aberto": "Este é o 3º lote seguido acima da meta. Um alerta foi aberto para o gestor." Depende de a API informar isso na resposta do lote, porque o operador não tem acesso aos alertas. | U04 |
| DS5 | `ToleranceGauge` | Marca de "além da escala" quando o desvio passa de ±20%, por exemplo uma seta na ponta e o texto "acima de +20%" no rótulo para leitor de tela. | U05 |
| DS6 | Padrão do resultado | Definir a hierarquia: número e selo como informação principal; gauge e barras como reforço, menores. Testar com operador antes de remover qualquer um. | U06 |
| DS7 | Novo: histórico de status | Linha do tempo no detalhe do alerta ("Em análise por Gestora, 19/11 às 21:41"). Depende de a API guardar e enviar quem e quando mudou o status. | U08 |
| DS8 | `Modal` | Campo opcional "O que foi verificado ou feito" nos modais de análise e resolução. Depende da API para guardar o texto. | U10 |
| DS9 | `Tabs` (menu no celular) | Sinal de rolagem (sombra na borda ou seta) ou um item "Mais" com os itens que não cabem. | U11 |

U07, U09 e U12 não pedem componente novo: vêm de decisões já tomadas (issue #98, RF12 e RF10). A recomendação é
mantê-las e conferir com operador real se causam dificuldade.

# 5. Plano de correção

**Proposta, a aprovar pelo PO.** A ordem segue a gravidade e o que depende só do front-end.

| Prioridade | Problemas | Ação | Depende de |
|---|---|---|---|
| 1 | U01, U02 | DS1 e DS2 | Só front-end; em U02, decidir entre sinalizar e limpar o processo |
| 2 | U04 | DS4 | Back-end: informar na resposta do lote que um alerta foi aberto |
| 3 | U08, U10 | DS7 e DS8 | Back-end: guardar quem mudou o status do alerta e a observação; o site passa a mostrá-los |
| 4 | U03, U05, U11 | DS3, DS5 e DS9 | Só front-end |
| 5 | U06, U07, U09, U12 | Manter; avaliar no teste com operador real | Teste do RNF25 |

Cada item aprovado vira uma issue, com o número do problema (U01 a U12) no título para manter a rastreabilidade. Ao
corrigir, a equipe atualiza a coluna "Gravidade" com "corrigido na issue #N".

# 6. Limitações

- **Sem operador real.** A inspeção encontra problemas de interface, mas não mede satisfação, confiança nem a
  facilidade percebida, que a ISO 9241-11 inclui. Por isso o RNF25 continua Parcial.
- **Avaliador familiarizado.** Quem inspecionou entende "desvio" e "meta por lote" com facilidade; um operador pode não
  entender. As gravidades de U04, U06 e U07 dependem disso.
- **Ambiente simulado.** API simulada, tela de celular simulada no computador (sem toque real nem teclado virtual) e
  só o tema claro.
- **Escopo.** Só os três fluxos pedidos. Histórico, dashboard, relatórios, cadastros e o modo sem conexão ficaram de
  fora.

# 7. Referências

- ISO 9241-11:2018. Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts.
- NIELSEN, J. 10 usability heuristics for user interface design. Nielsen Norman Group, 1994 (atualizado em 2020).
- NIELSEN, J. Severity ratings for usability problems. Nielsen Norman Group, 1994.
