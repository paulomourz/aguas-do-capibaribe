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

## Demonstração cronometrada (issue #115)

Cerca de 12 minutos, mostrando o ciclo **lote → alerta → resolução → relatório**. Funciona igual nos dois planos,
depois de preparar a área de demonstração (seção seguinte).

| Tempo | Parte | O que mostrar | Entrega de | Quem fala |
|---|---|---|---|---|
| 0:00 a 1:00 | O problema | Lavanderias do Agreste sem controle da água por lote; a ideia do sistema (TAP, seção 3) | Pedro | Pedro |
| 1:00 a 2:30 | Acesso | Aviso de privacidade na tela de login; o **administrador** entra, cadastra um operador em **Usuários** e mostra o registro em **Auditoria** | Paulo Moura, Matheus Andrade | Matheus Andrade |
| 2:30 a 4:30 | Registro de lote | O **operador** novo registra um lote no celular e vê o gauge; com a conexão desligada, registra outro, religa e mostra o selo **Sincronizado** | Abraão Filipe, Matheus Andrade | Matheus Andrade |
| 4:30 a 6:00 | Sensor | Lote enviado pelo ESP32 no Wokwi, com o token de API; o lote aparece no **Histórico** | Pedro, Paulo Moura, João Bezerra | Pedro |
| 6:00 a 8:00 | Alertas | O alerta **aberto** da Estonagem vai para **Em análise** e depois **Resolvido**; 3 lotes acima da meta no Amaciamento abrem um alerta novo e o aviso chega ao Telegram | Abraão Filipe, Paulo Moura | Pedro |
| 8:00 a 10:00 | Acompanhamento | **Dashboard** com os gráficos dos 20 dias e a água por peça; **Relatórios** com o PDF e a planilha Excel | Matheus Andrade, Mateus Basilio, Paulo Moura | Matheus Andrade |
| 10:00 a 11:00 | Qualidade e operação | No GitHub: CI verde, Quality Gate do SonarQube, SBOM na release e o runbook de recuperação | Paulo Moura | Pedro |
| 11:00 a 12:00 | Fechamento | Limitações (operador real e sensor simulado) e perguntas | equipe | Pedro e Matheus Andrade |

**Ensaio:** cronometre uma passada completa antes da apresentação e anote aqui o tempo e os ajustes.

| Data | Tempo total | Ajustes |
|---|---|---|
| | | |

### Preparar a área de demonstração

A demonstração usa o próprio site publicado (ou o Docker, no plano B), com a massa de dados
[`database/demonstracao/massa-demonstracao.sql`](../../database/demonstracao/massa-demonstracao.sql): 65 lotes dos
4 processos nos últimos 20 dias, lançados por 3 operadores fictícios, e 3 alertas (Tingimento resolvido, Alvejamento
em análise e Estonagem aberto). Assim o Dashboard, os gráficos e os relatórios já abrem cheios. As datas contam a partir
do dia em que o script roda, e ele só roda num banco **sem lotes**: se houver algum, para sem mudar nada.

- **Plano A (publicado):** limpe o histórico ([seção abaixo](#começar-com-o-histórico-limpo)) e, no mesmo **SQL
  Editor** do Neon, cole e rode o arquivo da massa. Faça isso na véspera ou até 1 hora antes.
- **Plano B (Docker):** com o sistema de pé, rode:
  ```bash
  docker compose exec -T db psql -U postgres -d aguas -v ON_ERROR_STOP=1 < database/demonstracao/massa-demonstracao.sql
  ```

Os operadores da massa não entram no sistema. Para o registro ao vivo, use o operador cadastrado na hora.

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
TRUNCATE alerta_lote, aviso_pendente, alerta, efluentes_descarte, telemetria, lote RESTART IDENTITY;
```

Isso apaga de vez todos os lotes, alertas, avisos pendentes, descartes e leituras do sensor, sem como desfazer.
Usuários, processos, metas e auditoria continuam. As tabelas `aviso_pendente` e `efluentes_descarte` apontam para
`alerta` e `lote`, por isso entram no mesmo comando; sem elas, o PostgreSQL recusa a limpeza.
