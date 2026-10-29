# Status verde / amarelo / vermelho na API (issue #3)

Explicação simples do que mudou com a issue
[#3](https://github.com/paulomourz/aguas-do-capibaribe/issues/3), para quem está chegando agora.

## A ideia em uma frase

Antes, **o site** decidia se um lote era verde, amarelo ou vermelho. Agora **a API decide** e manda
a resposta pronta. O site só pinta a cor que recebeu.

## Por que isso importa

Pense numa prova da escola. O professor corrige e dá a nota. Se cada aluno decidisse em casa se a nota
é "aprovado" ou "reprovado", dois alunos com a mesma nota poderiam chegar a respostas diferentes.

No sistema é igual: o site, um futuro app de celular e o sensor IoT recebem o mesmo lote. Se cada um
tiver a sua regra de cores, um pode mostrar amarelo e outro vermelho. Com a regra num lugar só (a API),
todos mostram a mesma cor, e dá para conferir depois por que o lote ficou daquela cor.

## Como a cor é decidida

Primeiro a API calcula o **desvio**, ou seja, quanto o lote gastou a mais (ou a menos) que a meta:

```
desvio = (litros gastos − litros esperados) ÷ litros esperados × 100
```

Depois ela olha o desvio e escolhe a faixa, descendo uma escada de cima para baixo:

| Desvio | Faixa na API | Cor na tela |
|---|---|---|
| até 0% (gastou a meta ou menos) | `DENTRO_DA_META` | 🟢 verde |
| acima de 0% até 8% | `ATENCAO` | 🟡 amarelo |
| acima de 8% | `CRITICO` | 🔴 vermelho |

Exemplos:

| Meta | Gastou | Desvio | Faixa |
|---|---|---|---|
| 800 L | 760 L | −5,00% | `DENTRO_DA_META` 🟢 |
| 1200 L | 1290 L | 7,50% | `ATENCAO` 🟡 |
| 1200 L | 1400 L | 16,67% | `CRITICO` 🔴 |

> [!IMPORTANT]
> Os limites **0% e 8% são provisórios**. São os mesmos que o site já usava, e a equipe ainda vai
> definir os oficiais. Para trocar, mude `LIMITE_DENTRO_DA_META` e `LIMITE_ATENCAO` em
> `StatusConformidade.java` e `FAIXAS_DE_STATUS` em `src/domain/regras.ts`.

## O que mudou no código

### Back-end (a "cozinha")

| Arquivo | O que faz |
|---|---|
| `backend/.../entity/StatusConformidade.java` (novo) | Um `enum`, que funciona como um carimbo com só 3 opções: `DENTRO_DA_META`, `ATENCAO` e `CRITICO`. Não dá para carimbar uma quarta opção por engano. O método `StatusConformidade.de(desvio)` é o "juiz" que escolhe a faixa. |
| `backend/.../dto/LoteDTOs.java` | O `LoteDTO` (o "pacote" que a API manda para o site) ganhou o campo `statusConformidade`. |

O lote agora sai da API assim:

```json
{
  "id": 42,
  "processoId": 3,
  "pecas": 100,
  "litros": 1290.00,
  "esperado": 1200.00,
  "desvio": 7.50,
  "statusConformidade": "ATENCAO",
  "data": "2026-10-29T12:00:00Z",
  "usuarioId": 1
}
```

### Front-end (o "salão")

| Arquivo | O que faz |
|---|---|
| `src/services/tipos.ts` | O tipo `LoteDTO` conhece o campo novo `statusConformidade`. |
| `src/domain/regras.ts` | `statusDaApi` traduz a faixa da API para a cor da tela (`ATENCAO` → amarelo). |
| `src/domain/tipos.ts` e `src/store.tsx` | Cada lote do site guarda a cor que veio da API (`lote.status`). |
| `Historico.tsx`, `Alertas.tsx`, `RegistroLote.tsx` | Param de calcular a cor do lote e usam `lote.status`. |
| `src/services/lotes.ts` e `src/mock/lotes.ts` | O modo simulado imita a API e também devolve `statusConformidade`. |

## O que ainda fica no site

**Totais e médias** continuam com a cor calculada no site, com os mesmos limites, pela função
`statusDe` de `src/domain/regras.ts`:

- total do mês no Relatório e no PDF;
- resumo de cada processo no Dashboard;
- média dos 3 lotes de um alerta.

Esses números não são lotes, são somas e médias que o próprio site calcula. A issue #3 pedia só o lote.
Para levar essas cores para a API também, o caminho é abrir outra issue e adicionar a faixa no
`ResumoProcessoDTO` e no `AlertaDTO`.

## Testes

| Teste | O que confere |
|---|---|
| `RegrasSimplesTest.faixaDeConformidadeRespeitaAsFronteiras` | Os valores na beirada de cada faixa: −5%, 0%, 0,01%, 8%, 8,01% e um desvio enorme. É nessas beiradas que os erros costumam aparecer (trocar `<=` por `<`, por exemplo). |
| `IntegracaoPostgresBase.esperadoVemDoTriggerEDesvioDaFormulaDaView` | Registra lotes de verdade num banco temporário e confere que a API devolve `ATENCAO`, `DENTRO_DA_META` e `CRITICO`. |

Resultado em 29/10/2026, com JDK 25 e PostgreSQL 18 temporário: **57 testes, todos passando**
(41 unitários e de web + 16 de integração). `tsc --noEmit` e `vite build` sem erros.
