# IoT simulado (Wokwi): como rodar

Um ESP32 simulado no [Wokwi](https://wokwi.com) mede a água de um lote e envia o lote para a API,
como um dispositivo real faria (US-09, fase 1 do IoT).

```
[Wokwi no navegador] → HTTPS → API publicada → banco
```

| Arquivo | O que é |
|---|---|
| `sketch.ino` | código do ESP32. O endereço da API já vem preenchido; a senha fica em branco (`COLE-AQUI-...`) e é preenchida só no Wokwi |
| `diagram.json` | circuito: ESP32, potenciômetro (vazão), botão (iniciar/encerrar lote) e LED |

## 1. Conta do sensor

A API cria a conta `sensor.wokwi` (operador) sozinha ao subir, com a senha da variável `SENSOR_SENHA`.
Se a conta já existir, nada muda. Se a senha se perder, o gestor a redefine em **Usuários → Redefinir senha**.

## 2. Rodar no Wokwi

1. Em [wokwi.com](https://wokwi.com), crie um projeto **ESP32** (em *Starter Templates*, o primeiro).
2. Na aba `sketch.ino`, apague tudo e cole o conteúdo de `sketch.ino`.
3. Na aba `diagram.json`, apague tudo e cole o conteúdo de `diagram.json`.
4. No começo do `sketch.ino` (bloco CONFIGURAÇÃO), preencha a senha:
   ```cpp
   const char* SENHA = "a senha do sensor.wokwi";
   ```
   Salve no Wokwi (Ctrl+S). A senha preenchida fica **só no Wokwi**: no repositório a linha continua com
   `COLE-AQUI-...`.
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
4. No site, o lote aparece no **Histórico**, registrado por "Sensor de vazão (Wokwi)".

## Usar com a API do seu PC

Abra um túnel para a API (`cloudflared tunnel --url http://localhost:8080`, ou a porta `3000` com o Docker) e
troque o `API_URL` pelo endereço `https://...trycloudflare.com/api`. A conta do sensor é criada se `SENSOR_SENHA`
estiver definida no `backend/.env`; no Docker, a senha é sorteada e aparece em `docker compose logs segredos`.

## Se der errado

| Mensagem no monitor | Causa provável |
|---|---|
| `undefined reference to setup` (ao compilar) | o código não foi colado na aba `sketch.ino` |
| `Sem resposta da API` | a API está acordando (ele tenta de novo sozinho) ou o endereço está errado |
| `Sem resposta da API` com erro de certificado | o site passou a usar uma autoridade que não está em `CERTIFICADOS_RAIZ` |
| `Falha no login (HTTP 401)` | senha errada; confira a senha ou redefina em **Usuários** |
| `Processo "..." não encontrado` | `PROCESSO_NOME` diferente dos nomes cadastrados no site (a lista aparece logo depois) |

## Observações

- A conexão usa HTTPS e verifica o certificado da API. O login é renovado sozinho quando a sessão de 8 horas vence.
- Os projetos do Wokwi são públicos por padrão: quem tiver o link vê a senha do sensor. Use uma senha só para
  isso. O simulador não tem armazenamento protegido; no dispositivo físico, guarde a senha fora do código.
- No dispositivo físico: remova o fio entre os pinos 25 e 27, ligue o sinal do sensor de vazão no pino 27 e
  calibre `PULSOS_POR_LITRO`.
