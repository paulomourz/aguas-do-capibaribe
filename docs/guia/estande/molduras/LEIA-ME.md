# Molduras do deck para o telão

Imagens em PNG 2x, com fundo transparente, usadas nos slides da feira ProjetAÍ. Todas seguem o mesmo padrão: janela
de navegador azul-marinho com cantos arredondados, sombra e barra de endereço grande, ou celular com a tela
arredondada.

| Arquivo | Slide | Conteúdo |
|---|---|---|
| `navegador-dashboard.png` | 5. A solução | O Dashboard do gestor, com os alertas ativos e os indicadores do mês |
| `navegador-video-vazado.png` | 6. A demonstração | Só a moldura, com a tela transparente, para pôr por cima do vídeo `../demonstracao/demo-iot-sensor-loop.mp4` |
| `celular-telegram.png` | 6. A demonstração | A mensagem do Alerta 3 no grupo do Telegram |
| `caderno-economia.png` | 9. Viável e sustentável | Anotações e gráfico da economia estimada; refaça com `node docs/guia/estande/molduras/gerar-caderno.mjs` |
| `navegador-alerta.png` | 7. O sistema por dentro | O detalhe do Alerta 3, com os 3 lotes do sensor |
| `navegador-wokwi.png` | 8. Diferenciais | O circuito do sensor no simulador Wokwi |

## Refazer as molduras

As capturas de origem ficam em [`fonte/`](fonte/): o Dashboard e o Alerta 3 do site publicado, ampliados e sem o menu
lateral, e o circuito do Wokwi. Para refazer, troque a captura em `fonte/` e rode, na raiz do projeto:

```bash
node docs/guia/estande/molduras/gerar-molduras.mjs
```

O passo a passo para trocar uma print e subir no Canva está em [`../COMO-EDITAR-O-DECK.md`](../COMO-EDITAR-O-DECK.md).
