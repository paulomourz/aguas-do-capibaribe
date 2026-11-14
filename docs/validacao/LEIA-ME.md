# Validação de usabilidade

Teste do perfil **operador** com um operador real de lavanderia do Polo de Toritama, com tarefas observadas e o
questionário SUS. Atende ao item #22 da seção 7 do Parecer Técnico de 27/10/2026 e ao critério de validação com persona
da seção 8 do TAP.

**Situação:** roteiro e material prontos. O **teste com operador real não foi aplicado**: ficou como limitação aceita
pelo orientador. Como mitigação, foi feita uma
[avaliação simulada por inspeção, com apoio de IA](resultados/2026-11-11-avaliacao-simulada-ia.md), sem nota SUS. O kit
continua pronto para um teste real.

| Arquivo | Para que serve |
|---|---|
| [`roteiro-teste-usabilidade.md`](roteiro-teste-usabilidade.md) | protocolo completo: preparação, tarefas, critério de decisão, limitações |
| [`questionario-sus.md`](questionario-sus.md) | os 10 itens do SUS em português, cálculo e interpretação da nota |
| [`ficha-observador.md`](ficha-observador.md) | o que o observador anota durante a sessão |
| [`kit-validacao-usabilidade.pdf`](kit-validacao-usabilidade.pdf) | **para imprimir e levar**: termo, cartões de tarefa, SUS e ficha |
| [`resultados/`](resultados/LEIA-ME.md) | um arquivo por sessão, a partir do modelo |
| `fonte/` | HTML do kit e o script que gera o PDF |

## Passo a passo

1. Administrador cria a conta de teste `validacao.op01` (perfil operador) e confere as metas
   ([roteiro, seção 1](roteiro-teste-usabilidade.md#1-antes-do-dia)).
2. Imprimir o kit e combinar o horário com a lavanderia.
3. Aplicar: abertura, tarefas T1 a T6, SUS e conversa final (cerca de 30 min).
4. No mesmo dia, passar a ficha a limpo em `resultados/AAAA-MM-DD-operador-01.md` e abrir issues para os problemas de
   gravidade 3 ou 4.
5. Levar o resultado ao orientador para a decisão sobre a versão 1.0.0.

## Gerar o PDF de novo

Depois de editar `fonte/kit.html`, na pasta `fonte/`:

```powershell
powershell -ExecutionPolicy Bypass -File .\gerar-pdf.ps1
```

Ou abra o `kit.html` no Chrome e use **Imprimir → Salvar como PDF**, sem cabeçalhos e rodapés.
