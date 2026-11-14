# Roteiro do teste de usabilidade com operador

Protocolo da validação de usabilidade do perfil **operador** com um operador real de lavanderia do Polo de Toritama.
Atende ao item #22 da seção 7 do Parecer Técnico de 27/10/2026 e ao critério de validação com persona da seção 8 do
TAP. O resultado pesa na decisão sobre a versão 1.0.0 (seção 2.2 do parecer).

| | |
|---|---|
| **O que se avalia** | se um operador consegue entrar, registrar lotes, entender o resultado e consultar o histórico sem ajuda |
| **Instrumentos** | tarefas com observação e "pensar em voz alta", questionário SUS ([`questionario-sus.md`](questionario-sus.md)) e entrevista curta |
| **Participante** | 1 operador de máquina de lavanderia de jeans de Toritama (mínimo exigido); 2 a 5, se for possível |
| **Equipe na sessão** | 1 facilitador (conduz e lê as tarefas) e 1 observador (cronometra e preenche a [ficha](ficha-observador.md)) |
| **Duração** | cerca de 30 minutos por participante |
| **Material** | [kit para imprimir](kit-validacao-usabilidade.pdf): termo, cartões de tarefa, questionário SUS e ficha do observador |

## 1. Antes do dia

1. **Conta de teste.** O administrador cria em **Usuários** uma conta com perfil **operador** só para a validação,
   por exemplo `validacao.op01`, e anota a senha no cartão de login (não no repositório). Assim os lotes do teste
   ficam identificados em **Histórico de lotes → Registrado por**.
2. **Metas.** Confira em **Processos e metas** se as metas são as da tabela abaixo. Se o gestor tiver mudado alguma,
   refaça as contas da coluna "Resultado esperado" antes de imprimir os cartões.

   | Processo | Meta | Usado na tarefa |
   |---|---|---|
   | Estonagem | 12 litros por peça | T2 e T6 |
   | Tingimento | 1.500 litros por lote | T3 |
   | Amaciamento | 800 litros por lote | T4 |

3. **Ambiente.** Use o site publicado (plano A do [roteiro de apresentação](../guia/roteiro-apresentacao.md)), no
   celular do próprio operador se ele aceitar, ou num celular da equipe. É o cenário mais próximo do uso real, perto
   da máquina.
4. **Impressão.** Imprima o kit: 1 termo, 1 jogo de cartões de tarefa, 1 questionário SUS e 1 ficha do observador
   por participante.
5. **Combinar com a lavanderia** um horário fora do pico, com o gestor ciente. O teste não deve atrapalhar a produção.

**Atenção:** os lotes do teste entram no banco publicado e o site não apaga lotes. Lotes acima da meta podem se juntar
a um alerta aberto do mesmo processo. Avise o gestor do sistema para desconsiderar os lotes da conta
`validacao.op01`.

## 2. No dia, antes de começar

- [ ] Abrir o site uns 5 minutos antes: a API do plano grátis dorme e leva cerca de 2 minutos para acordar.
- [ ] Testar o login da conta de teste e sair de novo, deixando o celular na tela de login.
- [ ] Conferir a bateria e a internet do celular (Wi-Fi da lavanderia ou dados móveis).
- [ ] Cronômetro (o do celular do observador serve), ficha e caneta.

## 3. Abertura (5 min)

O facilitador lê, com suas palavras:

> Obrigado por ajudar. Estamos testando um sistema feito por estudantes do Senac para registrar a água usada em cada
> lote. **Quem está sendo testado é o sistema, não você.** Se alguma coisa ficar difícil, a culpa é do sistema, e é
> exatamente isso que a gente precisa descobrir. Vou te pedir algumas tarefas. Enquanto faz, vá falando em voz alta o
> que está pensando, o que procura, o que achou estranho. Eu não vou poder te ajudar durante as tarefas, mas no final
> respondo tudo. Pode parar quando quiser.

Em seguida:

1. Ler o **termo de consentimento** com o participante e pedir a assinatura. A via assinada fica com a equipe, **fora
   do Git**.
2. Perguntas de perfil (anotar na ficha): função, tempo de trabalho em lavanderia, se já registra consumo de alguma
   forma (caderno, planilha, nada), quanto usa celular no dia a dia.

## 4. Tarefas (15 a 20 min)

Entregue um cartão por vez e leia em voz alta. Os cartões descrevem a situação e **não dizem em qual botão clicar**.

Regras para o facilitador:

- Não ajudar nem indicar caminho. Se o participante perguntar, devolver: "O que você acha que deve fazer?".
- Se ele travar por **mais de 2 minutos**, ou pedir para desistir, dar uma dica e marcar "com ajuda". Se ainda assim não
  conseguir, marcar "não concluiu" e seguir para a próxima.
- O observador começa a contar quando o cartão termina de ser lido e para quando o participante diz que terminou.

| Nº | Cartão (o que o participante recebe) | Concluída quando | Resultado esperado |
|---|---|---|---|
| T1 | Você chegou para o turno. Entre no sistema com o usuário e a senha deste cartão. | aparece a tela de registro de lote | — |
| T2 | Você acabou de tirar um lote de **Estonagem** da máquina: **50 peças**, gastou **570 litros**. Registre esse lote. | lote confirmado e resultado na tela | esperado 600 L, desvio **−5,0%**, verde, "Dentro da meta" |
| T3 | Agora foi um lote de **Tingimento**: **30 peças**, **1.590 litros**. Registre e diga em voz alta como foi esse lote. | lote confirmado e participante interpreta o resultado | esperado 1.500 L, desvio **+6,0%**, amarelo, "Atenção" |
| T4 | Lote de **Amaciamento** com **920 litros**. Você anotou **40 peças**, mas, na hora de confirmar, lembra que eram **45**. Registre o lote com o número certo. Depois diga: o que você faria agora? | lote confirmado com 45 peças | esperado 800 L, desvio **+15,0%**, vermelho, "Crítico"; espera-se que ele diga que avisaria o gestor |
| T5 | O gestor perguntou como ficou o lote de **Tingimento** que você registrou hoje. Encontre esse lote no sistema e diga se ficou dentro da meta. | participante mostra o lote de Tingimento e responde | lote da T3 em amarelo |
| T6 *(opcional)* | A internet da lavanderia caiu (o facilitador liga o **modo avião**). Registre um lote de **Estonagem**: **20 peças**, **250 litros**. Depois a internet volta (o facilitador desliga o modo avião). Confira se o lote chegou. | lote aparece como enviado | esperado 240 L, desvio **+4,2%**, amarelo |

Observações sobre as tarefas:

- **T4** verifica a tela de confirmação ("Voltar e corrigir"). O participante pode digitar 45 direto, sem passar pela
  correção: isso conta como sucesso, e o observador anota como ele fez.
- **T6** só vale no celular em que o site já foi aberto com internet (o modo offline depende disso). Se der problema
  técnico, anote e pule: a T6 não entra no critério de decisão.
- Os desvios esperados seguem as faixas da API: até 0% verde, de 0% a 8% amarelo, acima de 8% vermelho.

## 5. Questionário SUS (5 min)

Logo depois da última tarefa, antes da conversa final, para não influenciar as respostas:

1. Entregar o questionário impresso. Explicar a escala: **1 = discordo totalmente, 5 = concordo totalmente**.
2. Pedir que responda rápido, pela primeira impressão, e que **responda todas**. Se tiver dúvida em um item, marcar 3.
3. Se o participante preferir, o facilitador **lê os itens em voz alta** e marca o que ele disser, sem comentar nem
   reformular o item. Anotar na ficha que foi lido.

O cálculo da nota está em [`questionario-sus.md`](questionario-sus.md#como-calcular-a-nota).

## 6. Conversa final (5 min)

1. O que foi mais fácil? O que foi mais difícil?
2. Teve alguma palavra ou tela que você não entendeu?
3. Você usaria isso perto da máquina, no dia a dia? O que te impediria?
4. Hoje, como a água de cada lote é controlada aí na lavanderia?
5. O que você mudaria?

Agradecer e, se o participante quiser, mostrar como o gestor vê os lotes que ele registrou.

## 7. Depois da sessão

1. No mesmo dia, o facilitador e o observador revisam a ficha juntos e completam as anotações.
2. Calcular a nota SUS e classificar cada problema encontrado pela gravidade (tabela abaixo).
3. Registrar o resultado em [`resultados/`](resultados/LEIA-ME.md), a partir do modelo, e abrir uma issue para cada
   problema de gravidade 3 ou 4.

| Gravidade | Significado |
|---|---|
| 0 | não é problema de usabilidade |
| 1 | cosmético: corrigir se sobrar tempo |
| 2 | pequeno: atrasa, mas o participante resolve sozinho |
| 3 | grave: precisou de ajuda ou errou um dado |
| 4 | impede a tarefa: não conseguiu concluir |

Escala de gravidade de Nielsen (1994), adaptada.

## 8. Critério de decisão (proposta)

**Proposta da equipe, a ser alinhada com o orientador.** Não é requisito aprovado.

A validação é considerada **favorável à versão 1.0.0** se, para o operador (ou a média dos operadores):

- as tarefas **T1 a T5** forem concluídas, no máximo uma delas com ajuda;
- nenhuma tarefa tiver problema de **gravidade 4** sem correção planejada;
- a nota **SUS for 68 ou mais** (média de referência de mercado; ver [`questionario-sus.md`](questionario-sus.md#como-interpretar)).

Se algum ponto falhar, os problemas viram issues e a versão estável espera a correção e um novo teste.

Os tempos das tarefas são **registrados como evidência**, sem meta: os critérios quantitativos de desempenho continuam
"a definir" na documentação do projeto.

## 9. Limitações que devem constar no resultado

- **Amostra pequena.** Com 1 participante, a nota SUS é um indício, não uma medida estatística. Estudos de
  usabilidade costumam encontrar a maior parte dos problemas com cerca de 5 participantes (Nielsen, 2000).
- **Situação de teste.** O participante está sendo observado e as tarefas são simuladas: o uso real, com a produção
  correndo, pode ser diferente.
- **Escopo.** Só o perfil operador foi testado. Dashboard, alertas, relatórios e cadastros (gestor) ficam fora.

## Privacidade (LGPD)

- No repositório, o participante é identificado só como **Operador 01**, com função e tempo de experiência. Nada de
  nome, CPF, telefone, foto de rosto ou nome da lavanderia, a menos que ela autorize por escrito.
- Termo assinado, fichas em papel, áudio ou fotos ficam com a equipe, fora do Git (pasta `docs/privado/` ou drive
  da equipe).
- Gravar áudio ou tela só se o participante marcar essa opção no termo.

## Referências

- BROOKE, J. SUS: a "quick and dirty" usability scale. In: JORDAN, P. W. et al. (ed.). *Usability Evaluation in
  Industry*. London: Taylor & Francis, 1996. p. 189-194.
- LOURENÇO, D. F.; CARMONA, E. V.; LOPES, M. H. B. M. Tradução e adaptação transcultural da System Usability Scale
  para o português do Brasil. *Aquichan*, v. 22, n. 2, e2228, 2022. DOI: 10.5294/aqui.2022.22.2.8.
- BANGOR, A.; KORTUM, P.; MILLER, J. Determining what individual SUS scores mean: adding an adjective rating scale.
  *Journal of Usability Studies*, v. 4, n. 3, p. 114-123, 2009.
- SAURO, J.; LEWIS, J. R. *Quantifying the User Experience*. 2. ed. Cambridge: Morgan Kaufmann, 2016.
- NIELSEN, J. Severity ratings for usability problems. Nielsen Norman Group, 1994.
- NIELSEN, J. Why you only need to test with 5 users. Nielsen Norman Group, 2000.
