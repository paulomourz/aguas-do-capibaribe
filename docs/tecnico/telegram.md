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
3. Se o Telegram falhar, recusar ou demorar, o lote e o alerta continuam gravados. A falha vira só uma linha no log,
   com o status HTTP ou o tipo do erro, **nunca com o token**.

O código fica em `backend/src/main/java/br/com/aguas/notificacao/`.

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
| `Aviso do alerta N recusado pelo Telegram: HTTP 400` | id do grupo errado ou bot fora do grupo | refaça os passos 2 e 3 |
| `Aviso do alerta N recusado pelo Telegram: HTTP 401` | token errado | copie o token de novo do BotFather (ou gere outro com `/revoke`) |
| `Aviso do alerta N não enviado ao Telegram: ResourceAccessException` | Telegram fora do ar ou sem rede | o lote e o alerta estão gravados; os próximos avisos voltam sozinhos |
| `Aviso do alerta N enviado ao Telegram.` | tudo certo | confira se você está no grupo certo |

## Token vazou?

No @BotFather, mande `/revoke`, escolha o bot e copie o token novo. Troque `TELEGRAM_TOKEN` no Render e em
`docs/privado/hospedagem.md`. O token antigo para de funcionar na hora.
