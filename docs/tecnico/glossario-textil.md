# Glossário têxtil da lavagem denim

Issue #55, item #27 da seção 7 do Parecer Técnico de 27/10/2026. Padroniza os nomes dos processos cadastrados no
sistema e explica, na própria interface, o que cada etapa faz e por que gasta água.

Os textos da interface ficam em `src/domain/glossario.ts`. Ao mudar um termo, mude aqui e lá.

## Nomes padronizados

Cadastre os processos em **Processos e metas** com estes nomes. Se alguém digitar um sinônimo, o formulário mostra o
nome padrão e oferece o botão para usá-lo. O sensor do Wokwi também procura o processo pelo nome
(`PROCESSO_NOME` em `iot/sketch.ino`), então manter o padrão evita lote não enviado.

| Nome padrão | Sinônimos aceitos como o mesmo processo | O que faz |
|---|---|---|
| **Estonagem** | stone wash, stonewash, stone washing, lavagem com pedras, estonado | Desgasta o jeans em máquina com pedras-pomes ou enzimas: clareia o índigo e dá o aspecto de usado |
| **Amaciamento** | amaciar, amaciante, softener, softening, acabamento macio | Última etapa: aplica amaciante no banho para deixar a peça macia |
| **Alvejamento** | alvejar, branqueamento, bleaching, bleach, clareamento, cloro | Clareia o índigo com oxidantes (hipoclorito, permanganato ou peróxido) e depois neutraliza |
| **Tingimento** | tingir, tinturaria, dyeing, sobretingimento | Aplica corante na peça pronta para mudar ou reforçar a cor |

A comparação não diferencia maiúsculas, acentos nem espaços extras. Processos fora do glossário continuam aceitos:
eles só não mostram a dica.

## Onde a dica aparece

- **Processos e metas**: ícone de informação ao lado do nome de cada processo.
- **Registro de lote**: depois de escolher o processo, a definição aparece abaixo do campo, com o ícone para a dica
  completa.

A dica é um botão. Abre com clique, **Enter** ou **Espaço**, e também ao passar o mouse. **Esc** fecha e devolve o
foco ao botão. O leitor de tela anuncia "O que é Estonagem?" e se a dica está aberta.

## Consumo de referência

As fontes encontradas trazem o consumo **da lavanderia inteira por peça** (todas as etapas somadas), não o de cada
etapa. Por isso a dica mostra a faixa total, de **49 a 70 litros por peça**, e não um número por processo.

| Fonte | Consumo citado | Observação |
|---|---|---|
| C&A Brasil, coleção de jeans sustentável ([Mercado & Consumo, 23/03/2021](https://mercadoeconsumo.com.br/2021/03/23/ca-brasil-lanca-colecao-de-jeans-sustentavel)) | 48,8 L por peça no processo usual; 7,4 L com a nova tecnologia | Dado de uma empresa, não média do setor |
| Officina+39, Aqualess Mission ([textile network, 27/04/2021](https://textile-network.com/en/Technical-Textiles/Textile-Flaechen/Officina-39-Aqualess-Mission-on-a-mission-to-reduce-the-use-of-water)) | cerca de 52 L por calça no sistema tradicional | Dado de fornecedor de químicos |
| The Daily Star, "Denim makers cut use of water" ([link](https://www.thedailystar.net/business/denim-makers-cut-use-water-1574194)) | 70 L por kg de tecido como padrão mundial; fábricas novas com 14 a 16 L/kg | Por kg, não por peça |

Leituras para levantar o valor por etapa (relação de banho de cada processo):

- MACÊDO, J. S. Dissertação sobre lavanderias de jeans de Toritama/PE, UFPE
  ([repositório](https://repositorio.ufpe.br/bitstream/123456789/49473/1/DISSERTA%c3%87%c3%83O%20Jacqueline%20da%20Silva%20Mac%c3%aado.pdf)).
  Usa a relação de banho como parâmetro em todas as etapas.
- AGUIAR, G. J. A. Dissertação com análise de ciclo de vida de lavanderia de jeans, UFPE
  ([repositório](https://repositorio.ufpe.br/bitstream/123456789/64385/1/DISSERTA%c3%87%c3%83O%20Gustavo%20Jos%c3%a9%20de%20Ara%c3%bajo%20Aguiar.PDF)).
  Aponta o tingimento e o amaciamento com fixador como as etapas de maior impacto.

## Pendências

- Confirmar com o orientador se este item é obrigatório (a issue já registra essa dúvida).
- Levantar nas dissertações acima o consumo de cada etapa. Quando houver, acrescentar o valor por processo em
  `src/domain/glossario.ts` e nesta página.
- As metas cadastradas no sistema (V3: Estonagem 12 L/peça, Amaciamento 800 L/lote, Tingimento 1.500 L/lote,
  Alvejamento 1.200 L/lote) são da lavanderia e continuam sendo definidas pelo gestor; o glossário não as altera.
