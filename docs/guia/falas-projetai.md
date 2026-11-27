# Falas da apresentação na feira ProjetAÍ

O texto de cada slide, para ensaiar. São **7 min 40 s** de fala, seguidos das perguntas da banca. **Pedro** fala os
slides 1 a 6, até a demonstração, e **Matheus Andrade** os slides 7 a 12. O roteiro, com o vídeo da demonstração e o
plano para as perguntas, está em [`roteiro-apresentacao.md`](roteiro-apresentacao.md#apresentação-na-feira-projetaí).

| Tempo | Slide | Quem fala |
|---|---|---|
| 0:00 | 1. Nome do projeto | Pedro |
| 0:15 | 2. Equipe | Pedro |
| 0:35 | 3. Problema | Pedro |
| 1:20 | 4. Oportunidade e público-alvo | Pedro |
| 2:00 | 5. Solução | Pedro |
| 2:45 | 6. Demonstração em vídeo | Pedro |
| 4:15 | 7. O sistema por dentro | Matheus |
| 4:50 | 8. Diferenciais e inovação | Matheus |
| 5:30 | 9. Viabilidade e sustentabilidade | Matheus |
| 6:15 | 10. Impactos esperados | Matheus |
| 6:50 | 11. Próximos passos | Matheus |
| 7:20 | 12. Encerramento | Matheus, com Pedro no "obrigado" |

## Pedro

**1. Nome do projeto (15 s)**

"Boa tarde! Nós somos o Águas do Capibaribe, um sistema para lavanderias de jeans do Agreste controlarem a água de
cada lote. A nossa ideia é simples: cada lote com a água que ele precisa, nem uma gota a mais."

**2. Equipe (20 s)**

"Somos seis: eu, Pedro, como PO e full stack; Abraão e João no back-end; Matheus no front-end; Mateus Basilio no
banco de dados; e Paulo no DevOps. O nosso orientador é o professor Fábio Chicout."

**3. Problema (45 s)**

"O polo de Toritama, Caruaru e Santa Cruz do Capibaribe produz de 14% a 16% do jeans do Brasil. Lavar jeans gasta
muita água, e no Agreste essa água é cara: vem de poço ou de caminhão-pipa. E 77% dela volta ao rio sem tratamento. O
pior é que a lavanderia não sabe quanto cada processo gasta. Ela paga a conta no fim do mês, mas não sabe onde está o
desperdício."

**4. Oportunidade e público-alvo (40 s)**

"Quem ganha com isso? O gestor, que paga a água; o operador, que lava os lotes; o MPPE e a CPRH, que fiscalizam;
e as marcas, que cobram produção sustentável. São dezenas de lavanderias em Toritama, Caruaru e Santa Cruz. Com
medição e reúso, a nossa estimativa é uma economia de até 40 mil reais por mês numa lavanderia média. E não existe
hoje uma ferramenta simples e barata para isso no polo."

**5. Solução (45 s)**

"O Águas do Capibaribe funciona assim: o gestor cadastra a meta de água de cada processo, como estonagem e
tingimento. A cada lote, o operador ou o sensor registra quanto gastou, e o sistema compara na hora com a meta:
verde, amarelo ou vermelho. Se três lotes seguidos passam da meta, abre um alerta e o gestor recebe o aviso no
Telegram. No fim do mês, ele tem o relatório e o custo da água em reais."

**6. Demonstração em vídeo (1 min 30 s)**

"Agora, o sistema funcionando. À esquerda está o nosso sensor, um ESP32 simulado no Wokwi. Ele mede a vazão da água
durante o lote.

*(o vídeo começa)* Aqui eu começo um lote de estonagem e abro a água no máximo. O sensor conta os litros em tempo
real.

*(o lote encerra)* Encerrei o lote: deu cerca de 20 litros, contra uma meta de 15. O LED fica vermelho e o buzzer
apita, então o operador sabe na hora, na própria máquina.

*(o celular)* E olhem o celular: esse foi o terceiro lote seguido acima da meta, então o sistema abriu um alerta e
mandou o aviso no Telegram do gestor. Ninguém digitou nada.

Do sensor ao celular do dono da lavanderia, em segundos. Agora o Matheus mostra o que o gestor vê no dia a dia."

## Matheus Andrade

**7. O sistema por dentro (35 s)**

"Aqui é o que o gestor vê no dia a dia. O alerta que o sensor abriu aparece sozinho, com os três lotes e o desvio
médio, e ele marca em análise e depois resolvido. Além disso, o Dashboard mostra o consumo do mês e os gráficos por
processo e por dia, ele baixa o relatório em PDF ou Excel, vê o custo da água e do excesso em reais e registra o
descarte dos efluentes. E funciona no celular, até sem internet."

**8. Diferenciais e inovação (40 s)**

"O que nos diferencia? Primeiro, o sensor fala com a nossa API de verdade, pela internet, com segurança. Segundo, se
o Wi-Fi da fábrica cair, o sensor guarda as leituras e envia quando a conexão volta, sem duplicar nada. Terceiro, o
sensor manda um sinal de vida a cada 15 segundos, então sabemos se ele parou. E o site registra lotes mesmo sem
internet no celular do operador."

**9. Viabilidade e sustentabilidade (45 s)**

"É viável porque custa quase nada: o sistema roda em serviços gratuitos ou num computador comum, com Docker, e
aguentou 120 sensores ao mesmo tempo sem nenhum erro. E ele se paga: uma lavanderia compra cerca de 56 mil reais de
água por mês. Com meta por lote e alerta, o excesso aparece na hora e deixa de virar prejuízo. Pela nossa estimativa,
são até 40 mil reais a menos por mês, cerca de 2.760 metros cúbicos que deixam de sair do poço e do rio. Em seis meses
de piloto, 240 mil reais. E é confiável: 625 testes automáticos, SonarQube aprovado e documentação nas normas ISO/IEC."

**10. Impactos esperados (35 s)**

"O impacto é econômico e ambiental. A lavanderia economiza com reúso e enxerga em reais quanto perde com o excesso,
como nesta tela do custo da água. Se o efluente sai fora da faixa de pH da CONAMA 430, o sistema avisa na hora. E todo registro fica guardado sem poder
ser alterado, o que dá confiança para a fiscalização e para as marcas."

**11. Próximos passos (30 s)**

"Os próximos passos são um piloto numa lavanderia real, com o sensor físico YF-S201, um sensor por máquina. Depois,
previsão de consumo, aviso também por WhatsApp e um laudo pronto para a CPRH."

**12. Encerramento (20 s)**

Matheus: "Esse é o Águas do Capibaribe. Pelo QR code, vocês acessam o sistema no ar e o nosso código no GitHub. Se
você conhece uma lavanderia que queira testar, fale com a gente."

Pedro e Matheus: "Obrigado!"

## Nas perguntas, se pedirem

A demonstração ao vivo no Wokwi; o operador registrando um lote no celular sem internet; os relatórios em PDF e
Excel; o custo da água; os efluentes; a auditoria; no GitHub, o CI verde, o Quality Gate do SonarQube e a release.
