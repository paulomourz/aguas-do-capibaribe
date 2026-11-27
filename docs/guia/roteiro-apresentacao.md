# Roteiro de apresentação

Como mostrar o sistema funcionando. Use o **plano A**. Se o site publicado ou o sensor falharem, vá para o **plano B**.

| | Plano A: público | Plano B: local |
|---|---|---|
| **Site** | <https://aguas-do-capibaribe.onrender.com> | <http://localhost:3000> |
| **Banco** | Neon, na internet | Docker, no computador |
| **Sensor no Wokwi** | [`aguas-capibaribe-sensor`](https://wokwi.com/projects/479626230908397569) | [`aguas-capibaribe-local`](https://wokwi.com/projects/479631012643004417) |
| **Conexão do sensor** | HTTPS | HTTP, pelo túnel |
| **Precisa instalar** | só um navegador | Docker Desktop |

Os dois planos são separados: usuários, senhas e lotes de um não aparecem no outro. Para a disciplina de Banco de
Dados há um plano C, fora da apresentação: o plano B com o banco aberto ao pgAdmin, o log de SQL e o Adminer ([roteiro do banco](roteiro-banco-de-dados.md)).

## Apresentação na feira ProjetAÍ

**7 a 8 minutos** de fala, seguidos das perguntas da banca, no auditório. A fala dá **7 min 35 s**. **Pedro** fala os
slides 1 a 6, até a demonstração, e **Matheus Andrade** os slides 7 a 12. O texto de cada slide está em
[`falas-projetai.md`](falas-projetai.md); o deck, em [`estande-projetai.pdf`](estande-projetai.pdf).

| Tempo | Slide | O que dizer ou mostrar | Quem fala |
|---|---|---|---|
| 0:00 a 0:15 | 1. Nome do projeto | Quem somos e o slogan: cada lote com a água que ele precisa | Pedro |
| 0:15 a 0:35 | 2. Equipe | Os seis integrantes, a função de cada um e o orientador | Pedro |
| 0:35 a 1:20 | 3. Problema | 14% a 16% do jeans do Brasil; água cara; 77% volta ao rio sem tratamento; ninguém mede por processo | Pedro |
| 1:20 a 2:00 | 4. Oportunidade e público-alvo | Gestor, operador, fiscalização e marcas; economia de até R$ 40 mil por mês com reúso | Pedro |
| 2:00 a 2:45 | 5. Solução | Meta por processo, lote comparado na hora, alerta no Telegram, relatórios e custo em reais | Pedro |
| 2:45 a 4:15 | 6. **Demonstração em vídeo** | O vídeo do lote do sensor, com o celular ao lado mostrando o Telegram (abaixo) | Pedro |
| 4:15 a 4:50 | 7. O sistema por dentro | Telas do Dashboard, dos alertas, dos relatórios, do custo e dos efluentes | Matheus Andrade |
| 4:50 a 5:30 | 8. Diferenciais e inovação | Sensor falando com a API de verdade; sem Wi-Fi guarda e envia sem duplicar; sinal de vida a cada 15 s; site sem internet no celular | Matheus Andrade |
| 5:30 a 6:10 | 9. Viabilidade e sustentabilidade | Grátis no Render e no Neon ou no Docker; 120 sensores sem erro; 625 testes, SonarQube, normas ISO/IEC | Matheus Andrade |
| 6:10 a 6:45 | 10. Impactos esperados | Economia com reúso; efluente fora da CONAMA 430 na hora; custo do excesso em reais; histórico que não muda | Matheus Andrade |
| 6:45 a 7:15 | 11. Próximos passos | Piloto com o sensor físico YF-S201, um sensor por máquina, previsão, WhatsApp, laudo para a CPRH | Matheus Andrade |
| 7:15 a 7:35 | 12. Encerramento | Apontar os QR codes, convidar lavanderias para um piloto e agradecer | Matheus Andrade, com Pedro no "obrigado" |

**Demonstração em vídeo (1 min 30 s).** O slide 6 passa um vídeo gravado antes, com o celular ao lado: não depende da
API acordada, do Wokwi rápido nem da internet do auditório. O vídeo mostra, em sequência:

1. No Wokwi, a vazão no máximo e o botão verde: o lote começa a contar.
2. O botão de novo: o lote dá cerca de 20 L contra a meta de 15 L, o LED vermelho acende e o buzzer apita 3 vezes.
3. No celular, ao lado, o aviso do alerta chegando ao grupo do Telegram: é o 3º lote seguido acima da meta na
   Estonagem.
4. No site, como gestor, **F5**: o lote no **Histórico**, registrado pelo sensor, e o alerta novo em **Alertas**.

**Gravado em 26/11/2026,** na pasta [`estande/demonstracao/`](estande/demonstracao/LEIA-ME.md): o vídeo do sensor
(`demo-iot-sensor-loop.mp4`, 19 s em loop, para o slide; `demo-iot-sensor-3x.mp4`, 38 s em 3x; `demo-iot-sensor.mp4`, 1 min 53 s, de reserva) e as
prints do Wokwi com o LED vermelho, do alerta aberto, do Histórico e da mensagem do alerta no Telegram.

**Para gravar de novo:** prepare a área de demonstração (seção seguinte) e deixe a janela do Chrome com o Wokwi
**sempre visível**, por exemplo com a tela dividida (Win+← e Win+→): coberta por outra janela, a simulação cai para
3% da velocidade, e o lote sai dentro da meta. Com a vazão no máximo, cada lote precisa de uns 75 s para passar de
16,2 L, a meta mais 8%. Depois de gravar, limpe o banco e rode a massa de novo.

**Nas perguntas, se pedirem:** a mesma demonstração **ao vivo**, pelo passo a passo acima; o operador registrando um
lote de **Amaciamento** no celular, com a conexão desligada, e o selo **Sincronizado**; **Relatórios** em PDF e
Excel; **Custo da água** e **Efluentes**; a **Auditoria**; o sensor sem Wi-Fi (**Q** no monitor serial derruba o
sinal por 60 s e o lote vai sozinho quando ele volta); no GitHub, o CI verde, o Quality Gate do SonarQube e o SBOM na
release.

**Telegram:** a massa deixa a Estonagem com 2 lotes seguidos acima da meta, sem alerta, para o lote crítico do sensor
abrir o alerta ao vivo. Por isso, **ninguém registra lote de Estonagem antes do sensor**, nem no ensaio. Se ensaiar
no mesmo banco, limpe e rode a massa de novo depois. Antes de começar, deixe o grupo do Telegram aberto no celular.

**Se atrasar:** junte os slides 10 e 11 numa frase. O vídeo da demonstração fica inteiro.

**Sensor:** antes de começar, cole o token, clique em ▶ e espere `Sinal de vida OK`: a primeira conexão ao Wi-Fi e à
API leva alguns segundos (até uns 2 minutos se a API estiver dormindo). A partir daí, o sensor manda um sinal de vida a
cada 15 s, o que também mantém a API acordada. Faça cada lote em menos de 1 minuto: durante o lote o sinal não sai, e
a saúde do sensor (`/api/actuator/health/sensor`, [`iot/LEIA-ME.md`](../../iot/LEIA-ME.md#sinal-de-vida-a-saúde-do-sensor-na-api))
cairia para DOWN. Durante cada envio, deixe a aba do Wokwi na frente (o simulador desacelera em
segundo plano). Detalhes do buffer em [`iot/LEIA-ME.md`](../../iot/LEIA-ME.md#sem-wi-fi-as-leituras-ficam-guardadas).

**Ensaio:** cronometre uma passada completa antes da apresentação e anote aqui o tempo e os ajustes.

| Data | Tempo total | Ajustes |
|---|---|---|
| | | |

### Preparar a área de demonstração

A demonstração usa o próprio site publicado (ou o Docker, no plano B), com a massa de dados
[`database/demonstracao/massa-demonstracao.sql`](../../database/demonstracao/massa-demonstracao.sql): 64 lotes dos
4 processos nos últimos 20 dias, lançados por 3 operadores fictícios, e 2 alertas (Tingimento resolvido e Alvejamento
em análise); a Estonagem termina com 2 lotes acima da meta, à espera do sensor. Assim o Dashboard, os gráficos e os relatórios já abrem cheios. As datas contam a partir
do dia em que o script roda, e ele só roda num banco **sem lotes**: se houver algum, para sem mudar nada.

**Antes da massa, ajuste a meta da Estonagem à escala do sensor.** O sensor envia os lotes como Estonagem, e no Wokwi
um lote de 1 minuto mede uns 15 a 30 L (vazão de até 30 L/min). Com a meta padrão (12 L por peça, 600 L num lote de
50 peças), todo lote do sensor sairia "dentro da meta" e o LED e o buzzer não apareceriam. No site, como gestor ou
administrador, abra **Processos e metas**, edite a **Estonagem** e deixe **por lote, 15 L**. Faça isso pelo site, e
não direto no banco: a API guarda a lista de processos em cache e só a atualiza quando a meta muda pelo site. Depois
rode a massa, que usa a meta que estiver cadastrada.

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

1. No Wokwi, clique em ▶ e espere `Sinal de vida OK` (o sensor avisa a API que está no ar; com a API dormindo, leva
   até uns 2 minutos, e até lá o botão não responde).
2. Gire o potenciômetro e clique no botão verde para iniciar o lote.
3. Clique de novo para encerrar e espere `Lote registrado na API`. Deixe a aba do Wokwi na frente nesse tempo.
4. No site, atualize com **F5** e mostre o lote no **Histórico**.
5. Para mostrar o alerta, faça 3 lotes seguidos acima da meta do processo: o alerta aparece no site e o aviso chega
   no grupo do Telegram.

**Antes de um dia importante**

- Peça para ninguém fazer merge na `develop`: o site publicado atualiza sozinho e reinicia.
- Se aparecer `certificado da API diferente do esperado`, atualize `IMPRESSAO_DIGITAL`
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

O operador cadastrado ao vivo também continua: no próximo ensaio, cadastre outro login. Para conferir a massa e este
reset sem mexer no banco publicado, rode `bash database/demonstracao/testar-massa.sh` (precisa do Docker; leva menos
de 1 segundo para limpar e recarregar).
