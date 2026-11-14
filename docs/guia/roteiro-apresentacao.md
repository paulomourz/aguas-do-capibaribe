# Roteiro de apresentação

Como mostrar o sistema funcionando. Use o **plano A**. Se o site publicado ou o sensor falharem, vá para o **plano B**.

| | Plano A: público | Plano B: local |
|---|---|---|
| **Site** | <https://aguas-do-capibaribe.onrender.com> | <http://localhost:3000> |
| **Banco** | Neon, na internet | Docker, no computador |
| **Sensor no Wokwi** | [`aguas-capibaribe-sensor`](https://wokwi.com/projects/479626230908397569) | [`aguas-capibaribe-local`](https://wokwi.com/projects/479631012643004417) |
| **Conexão do sensor** | HTTPS | HTTP, pelo túnel |
| **Precisa instalar** | só um navegador | Docker Desktop |

Os dois planos são separados: usuários, senhas e lotes de um não aparecem no outro.

## Plano A: site publicado

Não precisa de deploy nem de login no Render e no Neon.

**Antes de começar**

1. Abra o site uns 5 minutos antes. A API dorme sem uso e leva cerca de 2 minutos para acordar.
2. Entre com `capibaribe.admin`. A senha fica em `docs/privado/hospedagem.md`, só no computador de quem cuida da
   hospedagem, ou é a que você trocou pelo site.
3. No site, em **Usuários**, clique em **Rotacionar token** na linha do `sensor.wokwi` e copie o token.
4. Abra o projeto [`aguas-capibaribe-sensor`](https://wokwi.com/projects/479626230908397569) e, na linha
   `TOKEN_API` do `sketch.ino`, cole o token. **Não salve** o projeto.

**Durante a apresentação**

1. No Wokwi, clique em ▶ e espere `Gire o potenciômetro...`.
2. Gire o potenciômetro e clique no botão verde para iniciar o lote.
3. Clique de novo para encerrar e espere `Lote registrado na API`. Deixe a aba do Wokwi na frente nesse tempo.
4. No site, atualize com **F5** e mostre o lote no **Histórico**.
5. Para mostrar o alerta, faça 3 lotes seguidos acima da meta do processo: o alerta aparece no site e o aviso chega
   no grupo do Telegram.

**Antes de um dia importante**

- Peça para ninguém fazer merge na `develop`: o site publicado atualiza sozinho e reinicia.
- Depois de 20/12/2026, ou se aparecer `certificado da API diferente do esperado`, atualize `IMPRESSAO_DIGITAL`
  no projeto público ([`iot/LEIA-ME.md`](../../iot/LEIA-ME.md#se-der-errado)).

## Plano B: Docker no computador

Serve também para testar uma mudança antes de ela ir para o site publicado. Precisa do Docker Desktop aberto, e a
primeira subida precisa de internet e demora alguns minutos. Se a rede bloquear o Docker ou o túnel, use o plano A.

**Só o site**

```bash
git checkout develop
git pull
docker compose up -d --build
docker compose logs segredos
```

Abra <http://localhost:3000> e entre com o login e a senha que aparecem no último comando.

**Com o sensor**

O Wokwi roda na internet e não enxerga o `localhost`, então o sensor precisa do túnel. O túnel só liga com este comando:

```bash
docker compose --profile tunel up -d --build
docker compose --profile tunel logs tunel
```

1. Nos logs, copie o endereço `https://...trycloudflare.com`.
2. Abra o projeto [`aguas-capibaribe-local`](https://wokwi.com/projects/479631012643004417).
3. Em `API_URL`, cole o endereço, **trocando `https` por `http`** e colocando `/api` no final:
   ```cpp
   const char* API_URL = "http://palavras-aleatorias.trycloudflare.com/api";
   ```
4. No site local (<http://localhost:3000>), entre como `capibaribe.admin` com a senha de `docker compose logs segredos`,
   vá em **Usuários > Rotacionar token** na linha do `sensor.wokwi` e cole o token em `TOKEN_API`.
5. Clique em ▶ e siga os mesmos passos do plano A, olhando o site em <http://localhost:3000>.

**Ao terminar, desligue o túnel:**

```bash
docker compose --profile tunel stop tunel
```

Com o túnel ligado, o site e a API locais ficam acessíveis pela internet, e o token passa sem criptografia até a
Cloudflare. Use só dados de teste. O endereço do túnel muda toda vez que ele é ligado.

**Não clique em SAVE no projeto local depois de colar o token:** ele é público. Sem salvar, o token e o endereço valem
enquanto a aba estiver aberta.

Para desligar tudo, use `docker compose --profile tunel down`. Só use `-v` se quiser **apagar** os dados e as senhas
do Docker.

## Testar uma mudança antes de publicar

1. Na sua branch, rode o plano B com o sensor.
2. Passe um lote pelo projeto local e confira no site local.
3. Abra o PR para a `develop`. Depois do merge, o site publicado atualiza sozinho.
4. Se o `iot/sketch.ino` mudou, cole o novo código no projeto público e salve, com o `TOKEN_API` ainda como
   `COLE-AQUI-...`.

## Começar com o histórico limpo

O site não apaga lotes, de propósito. Para limpar o banco publicado, abra o **SQL Editor** do Neon, confira se o banco é
`aguas` e rode:

```sql
TRUNCATE alerta_lote, alerta, lote RESTART IDENTITY;
```

Isso apaga de vez todos os lotes e alertas, sem como desfazer. Usuários, processos, metas e auditoria continuam.
