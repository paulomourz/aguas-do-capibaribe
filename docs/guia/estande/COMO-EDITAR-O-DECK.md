# Como editar o deck da feira ProjetAÍ

Guia para quem for mexer nos slides depois de 26/11/2026. O deck fica no Canva, e o repositório guarda as imagens, os
vídeos e as molduras usados nele.

| O quê | Onde |
|---|---|
| Deck (12 slides) | Canva, "Águas do Capibaribe · ProjetAÍ": [ver](https://www.canva.com/d/u275mK6GgoRvjYo). Para editar, peça acesso ao Paulo |
| Falas de cada slide e quem fala | [`../falas-projetai.md`](../falas-projetai.md) e as notas de cada slide no Canva |
| Roteiro da apresentação | [`../roteiro-apresentacao.md`](../roteiro-apresentacao.md#apresentação-na-feira-projetaí) |
| Vídeo e prints da demonstração | [`demonstracao/`](demonstracao/LEIA-ME.md) |
| Molduras prontas e o script que as gera | [`molduras/`](molduras/LEIA-ME.md) |

## Regras para não quebrar o deck

1. **Telão primeiro.** Texto com pelo menos 30 px, e prints só da parte que importa, ampliadas. Print da tela inteira
   do site fica ilegível de longe.
2. **Mesmo padrão de moldura.** Telas do site e do Wokwi vão na janela de navegador azul-marinho; o Telegram vai no
   celular. Use as imagens de [`molduras/`](molduras/LEIA-ME.md), não molduras do Canva nem bordas desenhadas à mão.
3. **Cores do deck:** azul-marinho `#0A3654`, terracota `#C6532D`, areia `#F2E9E0` e azul-água `#9AC5CE`. Títulos em
   maiúsculas, como nos outros slides.
4. **Sem fotos geradas por IA.** As fotos de fundo são as originais do deck.
5. **Os números têm que bater** entre os slides, as falas e o sistema: 625 testes automáticos, 120 sensores no teste de
   carga, e o Alerta 3 da Estonagem com os lotes 72, 73 e 74 e +41,5% de desvio médio (slides 6 e 7 e Telegram). Se
   mudar um, mude nos três lugares.
6. **Nada de senha ou token em print.** No Wokwi, esconda o código antes de capturar: o token do sensor fica no
   sketch.

## Trocar uma print do site

1. No site publicado, entre como gestor e abra a tela.
2. Amplie e tire o menu: no console do navegador (F12), rode
   `document.querySelector('aside').style.display='none'; document.querySelector('header').style.display='none'; document.querySelector('main').style.zoom='1.55'`.
   Depois da captura, aperte F5 para a página voltar ao normal.
3. Capture e salve em `molduras/fonte/`, com o mesmo nome do arquivo que vai substituir (`pub-dashboard.png` ou
   `pub-alerta.png`).
4. Na raiz do projeto, rode `node docs/guia/estande/molduras/gerar-molduras.mjs`. Ele refaz todas as molduras.
5. No Canva, envie a imagem nova em **Uploads**, clique na imagem antiga com o botão direito, escolha **Substituir**
   e confira se o tamanho continuou o mesmo.

## Slide 6: o vídeo

- O vídeo (`demonstracao/demo-iot-sensor-loop.mp4`, 19 s) fica **por baixo** da moldura vazada
  (`molduras/navegador-video-vazado.png`). Para mover, selecione os dois juntos com Shift e mova como um grupo.
- Sempre que trocar o vídeo, clique nele, abra **Reprodução** e marque **Reproduzir automaticamente** e **Repetir**.
- O vídeo só toca no modo **Apresentar** do Canva ou no PowerPoint baixado (.pptx). No PDF ele vira uma imagem parada.
- Para gravar de novo, siga "Para gravar de novo" no [roteiro](../roteiro-apresentacao.md#apresentação-na-feira-projetaí).
  Depois, limpe o banco publicado e rode a massa de novo, para a Estonagem voltar a esperar o sensor.

## Depois de mudar o deck

1. No Canva, baixe o deck em **PDF** e em **PowerPoint (.pptx)**. O .pptx leva o vídeo e serve para apresentar sem
   internet.
2. Exporte cada slide em JPG e troque `slide-NN.jpg` nesta pasta. Atualize `../estande-projetai.pdf`.
3. Abra um PR só com os arquivos do deck e registre a mudança no `CHANGELOG.md`.
