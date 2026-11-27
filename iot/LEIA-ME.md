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
| `sketch.ino` | código do ESP32. O endereço da API já vem preenchido; o token fica em branco (`COLE-AQUI-...`) e é preenchido só no Wokwi |
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

## 1. Conta e token do sensor

A API cria a conta `sensor.wokwi` sozinha ao subir (com a senha da variável `SENSOR_SENHA`). Ela tem o perfil
**sensor**, que só consulta os processos e registra lotes, e não entra no site.

O sensor **não usa a senha**: ele se identifica por um **token de API**, mandado em toda requisição
(`Authorization: Bearer <token>`), sem fazer login.

1. No site, entre como administrador e abra **Usuários**.
2. Na linha do `sensor.wokwi`, clique em **Rotacionar token** e confirme.
3. Copie o token (64 letras e números). Ele aparece **uma vez só**; o banco guarda apenas o SHA-256 dele.

Gerar outro token invalida o anterior na hora, e a troca fica na **Auditoria**. Faça isso se o token vazar, por
exemplo se alguém salvar o projeto público do Wokwi com ele.

## 2. Rodar no Wokwi

1. Em [wokwi.com](https://wokwi.com), crie um projeto **ESP32** (em *Starter Templates*, o primeiro).
2. Na aba `sketch.ino`, apague tudo e cole o conteúdo de `sketch.ino`.
3. Na aba `diagram.json`, apague tudo e cole o conteúdo de `diagram.json`.
4. No começo do `sketch.ino` (bloco CONFIGURAÇÃO), cole o token:
   ```cpp
   const char* TOKEN_API = "o token gerado em Usuários > Rotacionar token";
   ```
   **Não salve** o projeto com o token preenchido: os projetos do Wokwi são públicos. Cole o token só na hora de
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

### Sem Wi-Fi: as leituras ficam guardadas

Se o Wi-Fi cair, o sensor **continua medindo**. Cada lote encerrado sem conexão vira uma **leitura** (pulsos, litros
e hora, pelo relógio da internet no fuso de Brasília) num buffer de até **100 leituras** na memória. Quando o Wi-Fi
volta, o sensor envia as leituras em ordem, sozinho.

- Cada leitura tem a própria chave `Idempotency-Key`, a mesma em todas as tentativas: se a resposta da API se perder
  e o sensor reenviar, o lote **não é duplicado**.
- Se a API não responder, o sensor espera 15 s e tenta de novo; se ela responder 429 (limite de lotes por minuto),
  espera 60 s.
- Com o buffer cheio, a leitura mais antiga é descartada, com aviso no monitor (`Buffer cheio`).
- O envio do buffer só acontece sem lote em andamento, porque o envio para o contador de pulsos.
- A API grava a hora em que o lote **chega**; a hora em que ele foi medido aparece no monitor serial.
- A memória é RAM: se o ESP32 for reiniciado, as leituras guardadas se perdem.

**Para testar no Wokwi:**

1. Com a simulação rodando, clique no monitor serial, digite **Q** e aperte Enter: o Wi-Fi cai por 60 segundos
   (`Perda de sinal simulada`).
2. Faça um ou mais lotes nesse tempo. Cada um mostra `Leitura guardada (N de 100 no buffer)`.
3. Quando o Wi-Fi voltar (`Fim da perda de sinal simulada`), o monitor mostra `Enviando N leitura(s)
   guardada(s)...` e termina em `Buffer vazio: todas as leituras foram enviadas`.
4. Confira no **Histórico** do site: um lote para cada leitura, sem repetição.

### Sinal de vida: a saúde do sensor na API

Sem lote em andamento, o sensor envia a vazão atual (L/min do potenciômetro) para `POST /telemetria`, com o mesmo
token, **a cada 15 s**. Também envia logo depois de cada lote e, com a API respondendo, ao iniciar um lote. Pela hora
da última leitura, a API diz se o sensor está no ar (issue #158): o componente `sensorWokwi` de
`GET /api/actuator/health/sensor` fica **UP** com leitura há menos de 60 s e **DOWN** (HTTP 503) depois disso.

- O monitor serial só fala do sinal de vida quando ele começa (`Sinal de vida OK`) ou deixa de chegar
  (`Sinal de vida NAO chegou`). Os envios a cada 15 s não aparecem, para não esconder os lotes.
- **Durante um lote, nada é enviado**: o envio para o contador de pulsos e mudaria os litros. Como o lote começa com
  um sinal recém-enviado, um lote de **menos de 1 minuto** mantém o sensor UP. O lote crítico da demonstração (uns
  40 s) cabe nisso.
- Ao ligar o sensor, o primeiro sinal acorda a API do plano grátis do Render, o que leva até uns 2 minutos. Espere
  `Sinal de vida OK` antes do primeiro lote: até lá, o botão não responde.
- Sem Wi-Fi (comando **Q**), o sinal não sai: depois de 60 s a saúde mostra **DOWN** e volta a **UP** quando o
  Wi-Fi volta. Assim dá para mostrar na demonstração que a API percebe a queda do sensor.
- `ENVIAR_TELEMETRIA = false` desliga o sinal de vida (a saúde do sensor fica DOWN).
- A raiz `GET /api/actuator/health` não depende do sensor: é a checagem do Render, e um sensor parado não pode fazer
  a API reiniciar.

**Validar no Render (issue #218):**

1. Rode o sensor no Wokwi com o token e espere `Sinal de vida OK`.
2. Entre com uma conta de **operador**, **gestor** ou **administrador** e copie o token (o do sensor não vê a saúde):

   ```bash
   API=https://aguas-api-a0vq.onrender.com/api
   TOKEN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
     -d '{"usuario":"<login>","senha":"<senha>"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
   ```

3. Consulte a saúde do sensor. Esperado: HTTP 200, `"status":"UP"` e, em `components.sensorWokwi.details`, a
   `ultimaLeitura`, os `segundosDesdeUltimaLeitura` (menos de 60) e a Estonagem em `linhasAtivas`:

   ```bash
   curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer $TOKEN" "$API/actuator/health/sensor"
   ```

4. Digite **Q** no Wokwi, espere uns 70 s e repita o passo 3. Esperado: HTTP 503, `"status":"DOWN"` e o `motivo`
   com os segundos sem leitura. Quando o Wi-Fi voltar, o passo 3 mostra UP de novo.
5. Confira que a raiz continua no ar mesmo com o sensor DOWN: `curl -s "$API/actuator/health"` responde
   `{"status":"UP"}`.

## Calibrar o coeficiente K

O sensor de vazão gera um número de pulsos por litro, o **coeficiente K**. O sketch calcula
`litros = pulsos / K`. O valor fica em `PULSOS_POR_LITRO`, no bloco CONFIGURAÇÃO, e aparece no monitor serial ao
ligar (`Coeficiente K: 450.0 pulsos por litro`). O padrão, 450, é o do YF-S201. Outros modelos têm outro valor, e
mesmo duas unidades do mesmo modelo variam cerca de 10%. Com um sensor novo, comece pelo valor do fabricante e
calibre.

O K fica no próprio sketch, e não no banco: ele é do sensor físico, e o sistema não tem cadastro de sensores.

**Procedimento** (no dispositivo físico, com a montagem final, porque a vazão e a pressão mudam a contagem):

1. No sketch, use `MODO_CALIBRACAO = true` e, em `LITROS_CALIBRACAO`, o volume do recipiente, por exemplo
   `10.0`. Nesse modo, **o lote não é enviado à API**, então nenhum consumo falso fica no histórico. O sensor
   também não conecta ao Wi-Fi, então dá para calibrar sem rede.
2. Clique no botão verde, encha o recipiente graduado passando a água pelo sensor e clique de novo. O monitor
   mostra os pulsos contados e o K calculado:
   ```
   >>> Calibração encerrada: 4680 pulsos para 10.0 L.
       K calculado = 4680 / 10.0 = 468.0 pulsos por litro.
       Com o K atual (450.0), o sensor mediria 10.40 L.
   ```
3. Repita pelo menos 3 vezes e coloque a média em `PULSOS_POR_LITRO`.
4. Volte para `MODO_CALIBRACAO = false`. Na operação normal, o monitor mostra os pulsos a cada segundo
   (`Pulsos: ...`) e no fim do lote, para conferência.

**Testar no Wokwi.** O gerador de pulsos imita um sensor com o K de `PULSOS_POR_LITRO_SIMULADO`, separado do K
usado na conta. Com os dois iguais, os litros batem com a vazão do potenciômetro. Para ver o efeito da calibração:

| `PULSOS_POR_LITRO_SIMULADO` | `PULSOS_POR_LITRO` | 20 s com a vazão no máximo (30 L/min, 10 L) |
|---|---|---|
| 450 | 450 | cerca de 10 L: calibrado |
| 330 | 450 | cerca de 7,3 L: K errado, mede 27% a menos |
| 330 | 330 | cerca de 10 L: calibrado de novo |

Com `MODO_CALIBRACAO = true` e `LITROS_CALIBRACAO = 10.0`, deixar a vazão no máximo por 20 s mostra um K calculado
perto de 330. O tempo é contado à mão, e a simulação abaixo de 100% conta menos pulsos, então o valor varia um
pouco. No dispositivo físico, deixe `PULSOS_POR_LITRO_SIMULADO` como está: o gerador sai junto com o fio
25 → 27.

## Usar com a API do seu PC

Com o Docker, o túnel já vem pronto: `docker compose --profile tunel up -d --build` liga tudo, e o endereço aparece em
`docker compose --profile tunel logs tunel`. No projeto local, use esse endereço em `API_URL`, com `http://` e `/api` no final, e um
token gerado no **site local** (<http://localhost:3000>, entrando como `capibaribe.admin` com a senha de
`docker compose logs segredos`, em **Usuários > Rotacionar token**). O token do site publicado não vale no Docker. Ao terminar, desligue com `docker compose --profile tunel stop tunel`.

Sem Docker, abra o túnel com `cloudflared tunnel --url http://localhost:8080`, defina `SENSOR_SENHA` no `backend/.env` (para a conta ser criada) e gere o token no site local.

## Se der errado

| Mensagem no monitor | Causa provável |
|---|---|
| `undefined reference to setup` (ao compilar) | o código não foi colado na aba `sketch.ino` |
| `Sem resposta da API` | a API está acordando (ele tenta de novo sozinho) ou o endereço está errado |
| `SSL - The connection indicated an EOF` em todas as tentativas | a simulação está lenta (bem abaixo de 100% no canto de cima), e a API desiste da conexão segura: feche programas pesados no PC e reinicie a simulação |
| `certificado da API diferente do esperado` | o Render renovou o certificado (o atual, emitido em 19/11/2026, vale até 17/02/2027, mas o Render renova uns 30 dias antes): atualize `IMPRESSAO_DIGITAL`; o comando está no sketch |
| `Buffer cheio (100 leituras)` | o Wi-Fi ficou fora tempo demais: a leitura mais antiga foi descartada |
| `Sem envio agora (HTTP ...)`, `A leitura continua guardada` | a API não respondeu ou recusou por limite: o sensor tenta de novo sozinho |
| `Lote NAO enviado: cole o token de API` | `TOKEN_API` ainda com `COLE-AQUI-...` ou colado incompleto (são 64 letras e números) |
| `token recusado (HTTP 401)` | o token foi trocado por outra rotação, é de outro ambiente (publicado × Docker) ou a conta foi desativada: gere outro em **Usuários > Rotacionar token** |
| `Processo "..." não encontrado` | `PROCESSO_NOME` diferente dos nomes cadastrados no site (a lista aparece logo depois) |
| Lote crítico sem som | o áudio da aba do Wokwi está mudo, ou o `diagram.json` antigo ainda está colado (sem buzzer no pino 26) |

## Observações

- No projeto público, a conexão usa HTTPS e confere a impressão digital do certificado da API. No local, usa HTTP até a Cloudflare, sem criptografia nesse trecho: use só dados de teste.
- O gerador de pulsos para durante o envio porque deixa o TLS lento demais no simulador.
- O apito é gerado no próprio código, sem o PWM (LEDC), porque o gerador de pulsos já usa o LEDC e dois canais
  no mesmo timer disputam a frequência. Ele toca enquanto o gerador está parado, logo depois do envio, e leva
  cerca de 1,5 s.
- O token não vence sozinho: vale até o administrador gerar outro. Não há login nem sessão de 8 horas.
- Os projetos do Wokwi são públicos: quem tiver o link vê o que estiver salvo. Por isso o token do sensor não fica
  salvo lá, e a conta tem o perfil sensor, que só registra lotes. Se vazar, basta rotacionar. O simulador não tem
  armazenamento protegido; no dispositivo físico, guarde o token fora do código.
- No dispositivo físico: remova o fio entre os pinos 25 e 27, ligue o sinal do sensor de vazão no pino 27 e
  calibre o coeficiente K (`PULSOS_POR_LITRO`), como em [Calibrar o coeficiente K](#calibrar-o-coeficiente-k).
