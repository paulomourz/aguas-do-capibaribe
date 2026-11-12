# Avaliação simulada por inspeção (com apoio de IA), 2026-11-11

> **Isto não é a validação com usuário prevista no [roteiro](../roteiro-teste-usabilidade.md).** Não houve operador
> real. É uma **avaliação por inspeção**: um agente de IA executou as tarefas T1 a T6 no site, como faria um
> operador, e analisou cada passo por percurso cognitivo e pelas heurísticas de Nielsen. Por isso **não há nota
> SUS**: o questionário mede a percepção de uma pessoa, e uma nota inventada por IA não teria valor.
>
> O teste com operador real ficou como **limitação aceita pelo orientador** (issue #50). Esta avaliação reduz o risco,
> mas não o elimina, e o kit continua pronto para um teste real.

## Sessão

| | |
|---|---|
| Método | percurso cognitivo (o operador saberia o que fazer? veria o controle? entenderia o resultado?) e as 10 heurísticas de Nielsen, com gravidade pela escala do roteiro (seção 7) |
| Avaliador | agente de IA (Claude, pelo Claude Code), controlando o Chrome; revisão da equipe: ___ |
| Ambiente | Docker local (`docker compose up`), sem dados do banco publicado; conta `validacao.op01`, perfil operador |
| Aparelho simulado | tela de 390 × 844 px (celular comum), tema escuro (preferência do sistema) |
| Versão do sistema | commit `228925f` da `develop` |
| Metas usadas | Estonagem 12 L/peça, Tingimento 1.500 L/lote, Amaciamento 800 L/lote (conferidas, iguais às do roteiro) |

## Tarefas

| Tarefa | Resultado | Erros | Ajuda | Observação |
|---|---|---|---|---|
| T1 Entrar | S | 0 | não | o login leva direto ao registro de lote |
| T2 Estonagem, verde | S | 0 | não | −5,0%, verde, "Dentro da meta", como esperado |
| T3 Tingimento, amarelo | S | 1 | não | digitado "1.590", como no cartão: o sistema entendeu **2 L** (P1); erro percebido só na confirmação, corrigido em "Voltar e corrigir"; depois +6,0%, amarelo, "Atenção" |
| T4 Amaciamento, corrigir peças, vermelho | S | 0 | não | "Voltar e corrigir" manteve os dados; corrigido para 45; +15,0%, vermelho, "Crítico", e a tela já diz "Avise o gestor da lavanderia" |
| T5 Achar o lote no histórico | S | 0 | não | lote de Tingimento com +6,0% e "Atenção"; precisa rolar a página (P7) |
| T6 Sem internet (opcional) | S | 0 | não | simulado parando a API (não com modo avião); lote guardado e enviado sozinho quando a API voltou, sem duplicar (conferido no banco) |

Taxa de conclusão sem ajuda (T1 a T5): 5 de 5. Os tempos não foram medidos: o tempo de uma IA não representa o de
uma pessoa.

## SUS

**Não aplicado.** Ver o aviso no topo.

## Problemas encontrados

| Nº | Problema | Tela | Gravidade | Issue |
|---|---|---|---|---|
| P1 | Digitar litros com ponto de milhar ("1.590", como o próprio sistema e os cartões escrevem) grava **2 L**: o campo é numérico e o código lê o ponto como vírgula decimal (`RegistroLote.tsx`, `nLitros`). A validação aceita, porque é maior que zero. Só a confirmação mostra "2 L"; quem não ler com atenção registra um dado errado, e o lote ainda sai verde. | Registro de lote | **3** | #139 |
| P2 | O campo Litros é estreito no celular: sobram cerca de 49 px para o número, e as setas do campo numérico cobrem os dígitos. Com 4 dígitos ou mais, o valor aparece cortado ("590" no lugar de "1.590"), o que esconde o P1. | Registro de lote | 2 | #139 |
| P3 | Com o servidor fora do ar, o botão fica em "Registrando…" de 10 a 15 s (`TEMPO_LIMITE_ENVIO_MS`) antes de guardar o lote. Sem aviso nesse meio-tempo, o operador pode desistir, sair da tela ou achar que travou. | Registro de lote | 2 | |
| P4 | Com o indicador de conexão no cabeçalho ("1" lote guardado), a página fica 36 px mais larga que a tela: aparece rolagem para o lado e o menu da conta fica cortado. Em celulares de 360 px deve ser pior. | Cabeçalho | 2 | |
| P5 | "Registrar novo lote" mantém o processo do lote anterior já escolhido. Ajuda quem repete o processo, mas facilita registrar com o processo errado. A confirmação mostra o processo, o que reduz o risco. | Registro de lote | 2 | |
| P6 | Ao escolher o processo, aparecem a meta e a explicação do processo, que empurram Peças e Litros cerca de 70 px para baixo. Um toque rápido logo depois pode cair no lugar errado. | Registro de lote | 1 | |
| P7 | No histórico, no celular, "Exportar CSV" e os filtros de data e processo ocupam a primeira tela; os lotes só aparecem depois de rolar. O CSV, o botão de maior destaque, dificilmente serve ao operador. | Histórico de lotes | 1 | |
| P8 | O lote crítico pede "Avise o gestor da lavanderia", mas não diz se o sistema já avisou o gestor. A confirmar com usuário real. | Registro de lote | 1 | |

## O que funcionou bem

- Resultado do lote com cor, ícone, palavra ("Dentro da meta", "Atenção", "Crítico") e uma frase do que fazer: não
  depende só da cor.
- A confirmação mostra processo, peças e litros, e "Voltar e corrigir" mantém o que foi digitado. Foi ela que
  segurou o P1.
- Sem servidor, o lote não se perde: a mensagem é clara, o indicador mostra quantos lotes estão guardados, e o envio
  volta sozinho, sem duplicar.
- O histórico do operador mostra só os lotes dele, com o mesmo status do registro.

## Conclusão

- Critério de decisão do roteiro (seção 8): **não se aplica**, porque não houve participante nem SUS.
- As tarefas T1 a T6 são possíveis sem ajuda para quem lê com atenção. O ponto mais sério é o **P1**, que pode gravar
  um dado errado sem aviso.
- Recomendação para a versão 1.0.0: corrigir o P1 (e o P2, que o esconde) antes da versão estável, e registrar no
  parecer a falta do teste com operador real como limitação.

## Limitações

- **Não houve usuário real.** Inspeção encontra problemas de interface, mas não mede satisfação, confiança nem
  facilidade percebida. Falta o contexto da fábrica: mãos molhadas ou com luva, barulho, pressa, sol na tela,
  letramento digital.
- **Avaliador familiarizado.** Uma IA entende termos como "desvio" e "meta por lote" com facilidade; um operador pode
  não entender.
- **Ambiente simulado.** Tela de celular simulada num computador (sem teclado virtual nem toque real) e T6 feita
  parando a API, não com modo avião.
- **Escopo.** Só o perfil operador, como no roteiro. Dashboard, alertas, relatórios e cadastros ficaram de fora.
