# IoT simulado (Wokwi): como rodar

Um ESP32 simulado no [Wokwi](https://wokwi.com) mede a água de um lote e envia o lote para a API,
como um dispositivo real faria (US-09, fase 1 do IoT).

```
[Wokwi no navegador] → HTTPS → API publicada → banco
```

Existem dois projetos no Wokwi, com o mesmo código e endereços diferentes:

| Projeto | Fala com | Para quê |
|---|---|---|
| [`aguas-capibaribe-sensor`](https://wokwi.com/projects/479626230908397569) (público) | API publicada, em HTTPS | apresentar |
| [`aguas-capibaribe-local`](https://wokwi.com/projects/479631012643004417) (local) | Docker no computador, em HTTP pelo túnel | testar antes de publicar e plano B |

O passo a passo de cada um está no [roteiro de apresentação](../docs/guia/roteiro-apresentacao.md).

| Arquivo | O que é |
|---|---|
| `sketch.ino` | código do ESP32. O endereço da API já vem preenchido; a senha fica em branco (`COLE-AQUI-...`) e é preenchida só no Wokwi |
| `diagram.json` | circuito: ESP32, potenciômetro (vazão), botão (iniciar/encerrar lote), LED azul (lote em andamento), LED vermelho e buzzer (lote crítico) |

### Pinos

| Peça | Pino do ESP32 | Função |
|---|---|---|
| Potenciômetro | 34 | vazão de 0 a 30 L/min |
| Gerador de pulsos → entrada | 25 → 27 | simula o sensor YF-S201 |
| Botão verde | 4 | inicia e encerra o lote |
| LED azul (220 Ω) | 2 | lote em andamento |
| LED vermelho (220 Ω) | 33 | lote crítico |
| Buzzer | 26 | apito do lote crítico |

## 1. Conta do sensor

A API cria a conta `sensor.wokwi` sozinha ao subir, com a senha da variável `SENSOR_SENHA`. Ela tem o perfil
**sensor**, que só consulta os processos e registra lotes, e não entra no site. Se a conta já existir, nada muda. Se
a senha se perder, um administrador a redefine em **Usuários → Redefinir senha**.

## 2. Rodar no Wokwi

1. Em [wokwi.com](https://wokwi.com), crie um projeto **ESP32** (em *Starter Templates*, o primeiro).
2. Na aba `sketch.ino`, apague tudo e cole o conteúdo de `sketch.ino`.
3. Na aba `diagram.json`, apague tudo e cole o conteúdo de `diagram.json`.
4. No começo do `sketch.ino` (bloco CONFIGURAÇÃO), preencha a senha:
   ```cpp
   const char* SENHA = "a senha do sensor.wokwi";
   ```
   **Não salve** o projeto com a senha preenchida: os projetos do Wokwi são públicos. Cole a senha só na hora de
   usar. No repositório, a linha continua com `COLE-AQUI-...`.
5. Em `PROCESSO_NOME`, escreva o nome do processo como aparece no site (maiúsculas não importam). O sensor
   consulta a API e descobre o id sozinho.
6. Clique em ▶. **Abra o site antes**: a API do plano grátis dorme sem uso e leva cerca de 2 minutos para acordar.

## 3. Testar

1. Gire o potenciômetro para abrir a água.
2. Clique no botão verde: o LED azul acende e o monitor serial mostra a vazão e os litros.
3. Clique de novo para encerrar. A conexão segura é lenta no simulador, então o envio pode levar alguns
   minutos. O resultado esperado é:
   ```
   POST https://.../api/auth/login ...
     -> HTTP 200
   GET https://.../api/processos ...
     -> HTTP 200
   POST https://.../api/lotes ...
     -> HTTP 201
   Lote registrado na API: {...}
   ```
4. Logo depois, o monitor mostra o status que a API deu ao lote, como `Status do lote: ATENCAO (desvio de 3.10%)`.
5. No site, o lote aparece no **Histórico**, registrado por "Sensor de vazão (Wokwi)".

### Aviso de lote crítico (som e luz)

Quando a API classifica o lote como **crítico** (desvio acima de 8%), o sensor avisa na hora:

- o buzzer apita 3 vezes;
- o LED vermelho pisca junto e **fica aceso** até o próximo lote começar;
- o monitor mostra `!!! LOTE CRITICO: desvio acima de 8%. Confira o processo. !!!`.

Quem decide é a API, pelo campo `statusConformidade` da resposta do `POST /lotes`. Assim o sensor usa a mesma
regra do site, e mudar a faixa no backend já muda o aviso. Com 8% exatos o lote fica em atenção, sem apito. Se
o lote não for registrado, não há status, e o sensor não avisa.

Para provocar um lote crítico: abra bem o potenciômetro e deixe o lote correr até os litros passarem 8% do
esperado do processo (meta × peças). Por exemplo, com meta de 12 L/peça e 50 peças, o esperado é 600 L, e
acima de 648 L o lote é crítico. Isso leva uns 22 minutos com a vazão no máximo (30 L/min). Para mostrar
o aviso numa apresentação, use `PECAS = 1` no sketch: o esperado cai para 12 L, e passar de 12,96 L leva cerca
de 30 segundos com a vazão no máximo e a simulação perto de 100% (a velocidade aparece no canto de cima do
Wokwi). O som do buzzer só toca com o áudio do navegador ligado.

## Usar com a API do seu PC

Com o Docker, o túnel já vem pronto: `docker compose --profile tunel up -d --build` liga tudo, e o endereço aparece em
`docker compose --profile tunel logs tunel`. No projeto local, use esse endereço em `API_URL`, com `http://` e `/api` no final, e a
senha que aparece em `docker compose logs segredos`. Ao terminar, desligue com `docker compose --profile tunel stop tunel`.

Sem Docker, abra o túnel com `cloudflared tunnel --url http://localhost:8080` e defina `SENSOR_SENHA` no `backend/.env`.

## Se der errado

| Mensagem no monitor | Causa provável |
|---|---|
| `undefined reference to setup` (ao compilar) | o código não foi colado na aba `sketch.ino` |
| `Sem resposta da API` | a API está acordando (ele tenta de novo sozinho) ou o endereço está errado |
| `SSL - The connection indicated an EOF` em todas as tentativas | a simulação está lenta (bem abaixo de 100% no canto de cima), e a API desiste da conexão segura: feche programas pesados no PC e reinicie a simulação |
| `certificado da API diferente do esperado` | o Render renovou o certificado (o atual vale até 20/12/2026): atualize `IMPRESSAO_DIGITAL`; o comando está no sketch |
| `Falha no login (HTTP 401)` | senha errada; confira a senha ou redefina em **Usuários** |
| `Processo "..." não encontrado` | `PROCESSO_NOME` diferente dos nomes cadastrados no site (a lista aparece logo depois) |
| Lote crítico sem som | o áudio da aba do Wokwi está mudo, ou o `diagram.json` antigo ainda está colado (sem buzzer no pino 26) |

## Observações

- No projeto público, a conexão usa HTTPS e confere a impressão digital do certificado da API. No local, usa HTTP até a Cloudflare, sem criptografia nesse trecho: use só dados de teste.
- O gerador de pulsos para durante o envio porque deixa o TLS lento demais no simulador.
- O apito é gerado no próprio código, sem o PWM (LEDC), porque o gerador de pulsos já usa o LEDC e dois canais
  no mesmo timer disputam a frequência. Ele toca enquanto o gerador está parado, logo depois do envio, e leva
  cerca de 1,5 s.
- O login é renovado sozinho quando a sessão de 8 horas vence.
- Os projetos do Wokwi são públicos: quem tiver o link vê o que estiver salvo. Por isso a senha do sensor não fica
  salva lá, e a conta tem o perfil sensor, que só registra lotes. O simulador não tem armazenamento protegido; no
  dispositivo físico, guarde a senha fora do código.
- No dispositivo físico: remova o fio entre os pinos 25 e 27, ligue o sinal do sensor de vazão no pino 27 e
  calibre `PULSOS_POR_LITRO`.
