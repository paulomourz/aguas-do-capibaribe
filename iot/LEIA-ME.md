# IoT simulado (Wokwi): como rodar

Um ESP32 simulado no [Wokwi](https://wokwi.com) mede a água de um lote e envia o lote para a API,
como um dispositivo real faria (US-09, fase 1 do IoT).

```
[Wokwi no navegador] → internet → túnel (cloudflared) → API no seu PC → seu PostgreSQL
```

| Arquivo | O que é |
|---|---|
| `sketch.ino` | código do ESP32. Endereço do túnel e senha ficam em branco (`COLE-AQUI-...`) e são preenchidos só no Wokwi |
| `diagram.json` | circuito: ESP32, potenciômetro (vazão), botão (iniciar/encerrar lote) e LED |
| `criar-sensor.sql` | cria a conta do sensor no banco |

## Antes de começar

- PostgreSQL com o esquema de `database/banco.sql` aplicado. A API confere as tabelas ao subir e não
  sobe se forem diferentes.
- JDK 25 (LTS ou mais novo) e Maven 3.9+. Para conferir: `java -version` e `mvn -v`.

## 1. Conta do sensor no banco (uma vez só)

Abra `criar-sensor.sql`, troque `TROQUE-ESTA-SENHA` por uma senha de pelo menos 8 caracteres e rode o
arquivo no banco que a API usa (psql, pgAdmin ou a extensão PostgreSQL do VS Code).

O resultado lista os processos. Se a lista vier vazia, crie um processo pelo site ou descomente o
`INSERT` de processo no próprio arquivo. Anote o **nome** do processo que o sensor vai medir.

> **No banco oficial `aguas`:** a conta `sensor.wokwi` já existe; pule a criação e use a senha que
> está em `docs/privado/acessos-e-senhas.md` (fora do Git). O banco não tem processos:
> cadastre pelo menos um no site (**Processos e metas**) e use o nome dele em `PROCESSO_NOME`. Se a senha se perder,
> o gestor a redefine em **Usuários → Redefinir senha**.

## 2. Subir a API

Na pasta `backend/`, crie o arquivo `.env` a partir de `.env.example`. Para um banco local, fica assim:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nome_do_seu_banco
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_SSLMODE=disable
JWT_SECRET=cole_aqui_um_texto_aleatorio_com_pelo_menos_32_caracteres
CORS_ORIGINS=http://localhost:8443
```

Para gerar o `JWT_SECRET` no PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Depois, ainda em `backend/`:

```powershell
mvn spring-boot:run
```

Quando aparecer `Started AguasApiApplication`, a API está no ar em `http://localhost:8080/api`.
Deixe esse terminal aberto.

## 3. Abrir o túnel

Instale o cloudflared (uma vez só):

```powershell
winget install Cloudflare.cloudflared
```

Abra um **terminal novo** (o antigo não enxerga o programa recém-instalado) e rode:

```powershell
cloudflared tunnel --url http://localhost:8080
```

No meio da saída aparece um endereço como `https://palavras-aleatorias.trycloudflare.com`. Copie esse
endereço e deixe o terminal aberto: fechar desliga o túnel. O endereço muda toda vez que o túnel é
reiniciado.

> Enquanto o túnel estiver aberto, a API fica acessível pela internet (protegida por login). Feche-o
> quando terminar.
## 4. Rodar no Wokwi

1. Em [wokwi.com](https://wokwi.com), crie um projeto **ESP32** (em *Starter Templates*, o primeiro).
2. Na aba `sketch.ino`, apague tudo e cole o conteúdo de `sketch.ino`.
3. Na aba `diagram.json`, apague tudo e cole o conteúdo de `diagram.json`.
4. No começo do `sketch.ino` (bloco CONFIGURAÇÃO), preencha:
   ```cpp
   const char* API_URL = "http://SEU-ENDERECO.trycloudflare.com/api";  // http, não https
   const char* SENHA   = "a senha do sensor.wokwi";
   ```
   Use **`http://`**: com `https://` o ESP32 simulado trava na conexão segura. Não esqueça o `/api`
   no final. O projeto fica só com as duas abas (`sketch.ino` e `diagram.json`). Salve no Wokwi
   (Ctrl+S); quando o túnel mudar, troque só o `API_URL`. Essas duas linhas preenchidas ficam **só no
   Wokwi**: no repositório elas continuam com `COLE-AQUI-...`.
5. Em `PROCESSO_NOME`, no `sketch.ino`, escreva o nome do processo exatamente como aparece no site
   (maiúsculas não importam). O sensor consulta a API e descobre o id sozinho; se o nome não existir,
   o monitor serial lista os processos cadastrados.
6. Clique em ▶.

## 5. Testar

1. Gire o potenciômetro para abrir a água.
2. Clique no botão verde: o LED azul acende e o monitor serial mostra a vazão e os litros.
3. Clique de novo para encerrar. O resultado esperado é:
   ```
   POST http://.../api/auth/login ...
     -> HTTP 200
   GET http://.../api/processos ...
     -> HTTP 200
   POST http://.../api/lotes ...
     -> HTTP 201
   Lote registrado na API: {...}
   ```
4. No site, o lote aparece no **Histórico**, registrado por "Sensor de vazão (Wokwi)".

## Se der errado

| Mensagem no monitor | Causa provável |
|---|---|
| `undefined reference to setup` (ao compilar) | o código não foi colado na aba `sketch.ino` |
| trava em `POST ...` sem resposta | usou `https://`; troque por `http://` |
| `HTTP -1` ou outro número negativo | túnel fechado ou endereço errado (confira o `/api` no final) |
| `HTTP 530` ou `HTTP 502` | o túnel está aberto, mas a API não está rodando |
| `Falha no login (HTTP 401)` | senha errada; confira `docs/privado/acessos-e-senhas.md` ou redefina em **Usuários** |
| `Processo "..." não encontrado` | `PROCESSO_NOME` diferente dos nomes cadastrados no site (a lista aparece logo depois) |

## Observações

- Os projetos do Wokwi são públicos por padrão: quem tiver o link vê a senha do sensor. Use uma senha
  só para isso.
- Com `http://`, a senha passa sem criptografia entre o Wokwi e a Cloudflare. Serve para teste. No
  dispositivo físico e com a API publicada, use HTTPS.
- No dispositivo físico: remova o fio entre os pinos 25 e 27, ligue o sinal do sensor de vazão no
  pino 27 e calibre `PULSOS_POR_LITRO`.
