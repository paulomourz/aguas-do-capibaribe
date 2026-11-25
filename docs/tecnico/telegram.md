# Aviso de alerta no Telegram

Quando um alerta é aberto (3 lotes seguidos do mesmo processo acima da meta), a API manda uma mensagem num grupo do
Telegram, com o processo, os lotes, o número do alerta e o link para ele. O aviso é opcional: sem as variáveis abaixo,
ele fica desligado e o resto do sistema funciona igual.

> **Por que Telegram e não e-mail?** O plano grátis do Render bloqueia as portas de envio de e-mail (25, 465 e 587). O
> Telegram usa HTTPS, na porta 443, e não precisa de e-mail cadastrado nos usuários.

## Como funciona

1. A regra de alerta abre o alerta e publica um evento.
2. Depois que o lote foi gravado no banco (commit), o `AvisoDeAlerta` monta a mensagem e chama a Bot API do Telegram,
   em outra thread. O operador não espera o envio.
3. Se o envio falhar (erro de rede, Telegram fora do ar ou recusando), a API tenta de novo: são **até 3 envios** no
   total, com uma pausa que dobra a cada vez: **1 segundo** antes do 2º envio e **2 segundos** antes do 3º
   (`app.telegram.espera-entre-tentativas` é a primeira pausa). Com o **disjuntor aberto** (seção abaixo), não há
   nova tentativa: o aviso vai direto para o passo 4.
4. Se os 3 falharem, o aviso é gravado como **pendente** na tabela `aviso_pendente` (migração `V10`), com o alerta, o
   número de tentativas, o último erro e a hora. O lote e o alerta continuam gravados, e o operador não percebe nada.
5. Uma rotina da API (`ReenvioDeAvisos`) roda **a cada 5 minutos** (`app.telegram.reenvio-a-cada`) e tenta de novo os
   avisos pendentes, do mais antigo ao mais novo, uma vez por rodada. Como os pendentes ficam no banco, nada se perde se
   a API reiniciar: a primeira rodada sai 5 minutos depois que ela sobe.
   - Quando o aviso chega, a coluna `enviado_em` (migração `V11`) recebe a hora, e ele não é mais enviado. A mensagem
     começa com "Aviso atrasado", para o gestor saber que o alerta abriu antes.
   - Se falhar de novo, a tentativa é contada em `tentativas`, o erro vai para `ultimo_erro`, e a rodada para ali (o
     Telegram provavelmente continua fora do ar). A próxima rodada tenta de novo.
   - Só sai aviso de alerta que ainda está **aberto**: se alguém já pôs o alerta em análise ou resolveu, o aviso
     atrasado não ajuda mais.
   - Depois de **24 horas** pendente (`app.telegram.reenvio-limite`), o aviso deixa de ser tentado. Se a última
     tentativa falhar, o log diz que ele não será mais reenviado. Se ele vencer sem ter sido tentado (a rodada parou
     antes, num aviso mais antigo), não sai linha no log: ele fica na tabela com `enviado_em` vazio. Nos dois casos, o
     alerta continua na tela Alertas.
6. O log e a tabela guardam só o status HTTP ou o tipo do erro, **nunca o token**.

A linha de `aviso_pendente` nunca é apagada: ela fica como histórico do que atrasou e de quando chegou. Por isso o
`aguas_api` não tem DELETE nessa tabela, só UPDATE nas colunas `enviado_em`, `tentativas` e `ultimo_erro` (V11).

Para ver o que ficou pendente e o que já chegou:

```sql
select p.alerta_id, p.tentativas, p.ultimo_erro, p.criado_em, p.enviado_em
from aviso_pendente p order by p.criado_em desc;
```

O código fica em `backend/src/main/java/br/com/aguas/notificacao/`.

## Disjuntor (circuit breaker)

Com o Telegram fora do ar, cada envio ainda gastava até **15 segundos** esperando a rede (5 s para conectar e 10 s para
a resposta), e cada aviso fazia isso 3 vezes. Com muitos alertas abrindo ao mesmo tempo, a fila de avisos entupia.

O disjuntor (Resilience4j) corta esse desperdício. Ele olha as **últimas 10 chamadas** à Bot API e, a partir de **5**
chamadas nessa conta, se **50% ou mais** tiverem falhado, ele **abre**:

- enquanto está aberto, toda chamada volta **na hora**, com `CallNotPermittedException`, sem abrir conexão e sem
  esperar tempo limite nenhum. O aviso segue direto para a fila local (`aviso_pendente`);
- depois de **1 minuto** aberto, ele deixa passar **uma** chamada para ver se o Telegram voltou. Se der certo, fecha;
  se falhar, abre de novo por mais 1 minuto;
- essa espera de 1 minuto é menor que o intervalo do reenvio (5 minutos) de propósito: cada rodada de reenvio já
  encontra o disjuntor pronto, e é ela que fecha o disjuntor quando o Telegram volta.

É **porcentagem de falhas na janela**, não falhas seguidas: 5 falhas em 10 chamadas abrem; 3 em 10 não. E duas quedas
isoladas nunca abrem o disjuntor, porque abaixo de 5 chamadas a porcentagem nem é calculada. A conta também não
espera a janela de 10 encher: assim que as 5 chamadas mínimas acontecem, a taxa já é avaliada — 3 falhas nas 5
primeiras (60%) abrem ali mesmo.

**Respostas 4xx não contam como falha** (fora 408 e 429). Um `401` (token errado) ou `400` (id do grupo errado) é
recusa da nossa requisição: esperar não resolve, e abrir o disjuntor só esconderia o status HTTP que diz o que
corrigir. O aviso vira pendente do mesmo jeito. Já `429` (limite de envios) e `5xx` contam, porque aí o problema é do
outro lado.

Quando um aviso fica pendente por causa do disjuntor, `ultimo_erro` guarda `DisjuntorAberto` e `tentativas` conta 1 —
a tentativa que o disjuntor recusou. Nas rodadas de reenvio é diferente: com o disjuntor aberto a rodada para sem
contar tentativa, porque nenhuma chamada chegou a sair.

Os valores ficam em `app.telegram.disjuntor` (`application.yml`) e o estado aparece no log a cada mudança
(`Disjuntor do Telegram: CLOSED -> OPEN (falhas: 100%)`) e em `/api/actuator/metrics`, nas métricas
`resilience4j.circuitbreaker.*`.

## Como criar o bot do zero

Faça uma vez por ambiente (sistema publicado, Docker de apresentação etc.). Leva uns 5 minutos.

### 1. Criar o bot

1. No Telegram, procure **@BotFather** e mande `/newbot`.
2. Escolha o **nome** (aparece nas mensagens), por exemplo `Águas do Capibaribe Alertas`.
3. Escolha o **usuário**, sem espaço e terminado em `bot`, por exemplo `aguas_capibaribe_alertas_bot`.
4. O BotFather responde com o **token**, algo como `123456789:AA...`. Guarde-o como uma senha: quem tem o token controla
   o bot. **Nunca** coloque o token no repositório nem em print.

### 2. Criar o grupo

1. Crie um grupo, por exemplo `Alertas Águas`.
2. Adicione o bot: abra o perfil dele (`t.me/<usuário do bot>`) e use **Add to Group**, ou, no grupo, **Add members** e
   procure o usuário do bot. O topo do grupo deve passar a mostrar um membro a mais.
3. Adicione quem deve receber os avisos (gestor da lavanderia, equipe).
4. Mande no grupo: `/start@<usuário do bot>`.

### 3. Descobrir o id do grupo

1. No navegador, abra `https://api.telegram.org/bot<TOKEN>/getUpdates`, trocando `<TOKEN>` pelo token (sem espaço
   depois de `bot`).
2. Procure `"chat":{"id":` e copie o número, **com o sinal de menos** (todo grupo tem id negativo).
3. Se aparecer `{"ok":true,"result":[]}`, mande o `/start@<usuário do bot>` de novo no grupo e atualize a página. Se
   aparecer `Unauthorized`, o token foi copiado errado.

> **Atenção:** se o grupo virar "supergrupo" (o Telegram faz isso quando o grupo cresce ou ganha alguns recursos de
> administrador), o id muda. Nesse caso, repita este passo e troque o id no Render.

### 4. Configurar a API

No Render, em **aguas-api > Environment**, adicione as variáveis e salve (a API é publicada de novo):

| Variável | Valor |
|---|---|
| `TELEGRAM_TOKEN` | o token do BotFather |
| `TELEGRAM_CHAT_ID` | o id do grupo, com o `-` |
| `SITE_URL` | `https://aguas-do-capibaribe.onrender.com` (opcional: põe o link do alerta na mensagem) |

No computador, as mesmas variáveis vão no `backend/.env` (modelo em `backend/.env.example`). Guarde o token e o id
também em `docs/privado/hospedagem.md`, que fica fora do Git.

### 5. Testar

1. No site, crie um processo de teste com unidade **lote** e meta **100**.
2. Registre 3 lotes seguidos desse processo com **200 litros**.
3. Em poucos segundos, a mensagem chega no grupo.

Os lotes do teste ficam gravados (lote não pode ser apagado pelo sistema): faça o teste antes da limpeza do banco que
antecede os testes reais.

## Se o aviso não chegar

| O que aparece no log da API (Render > Logs) | Causa provável | O que fazer |
|---|---|---|
| nenhuma linha `Aviso do alerta` | o alerta não abriu, ou faltam as variáveis | confira se foram 3 lotes seguidos acima da meta no mesmo processo e se `TELEGRAM_TOKEN` e `TELEGRAM_CHAT_ID` estão no Render |
| `Aviso do alerta N: tentativa 1 de 3 falhou (HTTP 400)` | id do grupo errado ou bot fora do grupo | refaça os passos 2 e 3 |
| `Aviso do alerta N: tentativa 1 de 3 falhou (HTTP 401)` | token errado | copie o token de novo do BotFather (ou gere outro com `/revoke`) |
| `Aviso do alerta N: tentativa 1 de 3 falhou (ResourceAccessException)` | Telegram fora do ar ou sem rede | nada: a API tenta de novo |
| `Aviso do alerta N ficou pendente depois de 3 tentativas (...)` | as 3 tentativas falharam | nada: a rotina de reenvio tenta a cada 5 minutos |
| `Disjuntor do Telegram: CLOSED -> OPEN (falhas: ...%)` | o Telegram caiu e passou de 50% de falhas | nada: os avisos vão para os pendentes na hora, sem travar a fila |
| `Disjuntor do Telegram: HALF_OPEN -> CLOSED (...)` | o Telegram voltou | nada |
| `Aviso do alerta N: disjuntor aberto, sem tentar a rede; vai direto para a fila de pendentes.` | o Telegram continua fora do ar | nada: a rotina de reenvio cuida quando o disjuntor fechar |
| `Reenvio do aviso do alerta N falhou na tentativa 4 (...)` | o Telegram continua fora do ar ou recusando | se for `HTTP 400` ou `HTTP 401`, corrija as variáveis; senão, espere a próxima rodada |
| `Reenvio do aviso do alerta N: não deu para montar a mensagem (...)` | falha ao ler o banco | confira o banco; a rodada seguinte tenta de novo, sem contar tentativa |
| `Aviso pendente do alerta N enviado ao Telegram na tentativa 4.` | o aviso atrasado chegou | nada |
| `Aviso do alerta N não chegou ao Telegram em T tentativas (...) e não será mais reenviado.` | passou de 24 horas pendente | veja o alerta na tela Alertas; confira o token e o grupo |
| `Aviso do alerta N enviado ao Telegram na tentativa 1.` | tudo certo | confira se você está no grupo certo |

## Token vazou?

No @BotFather, mande `/revoke`, escolha o bot e copie o token novo. Troque `TELEGRAM_TOKEN` no Render e em
`docs/privado/hospedagem.md`. O token antigo para de funcionar na hora.
