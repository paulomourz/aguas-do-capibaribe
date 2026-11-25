# Teste de carga do registro de lotes

Mede como a API se comporta com vários sensores enviando lotes ao mesmo tempo (issues #56 e #113). O teste usa o
[k6](https://k6.io), com o script [`testes-carga/lotes.js`](../../testes-carga/lotes.js).

## Como rodar

Precisa só do Docker. O projeto `aguas-carga` tem banco próprio, então os lotes do teste não caem em nenhum outro banco.
**Nunca aponte este teste para o site publicado:** ele grava milhares de lotes, que não podem ser apagados pelo sistema.

```bash
docker compose -p aguas-carga -f docker-compose.yml -f docker-compose.carga.yml --profile carga run --rm --no-TTY k6
docker compose -p aguas-carga -f docker-compose.yml -f docker-compose.carga.yml --profile carga down -v
```

O primeiro comando sobe o banco e a API e roda o teste. Ele termina com erro se alguma meta não for atingida. O segundo
apaga o ambiente e os dados do teste.

Também roda no **GitHub Actions**, sem precisar de Docker no PC: em **Actions > Teste de carga > Run workflow**,
informe o tamanho do pool (padrão 20). Ele roda sozinho em todo PR que mude o teste, comparando pool 10 e 20, e mostra
o resultado no resumo da execução.

## O que o teste faz

| Etapa | Sensores simultâneos | Duração |
|---|---|---|
| 1 | 10 | 30 s |
| 2 | 25 | 30 s |
| 3 | 50 | 2 min |
| 4 | 100 | 2 min |

Cada sensor envia um lote atrás do outro, sem pausa, para um dos 4 processos iniciais, com litros de 20% abaixo a 20%
acima da meta. Assim, o teste também exercita a regra de alerta e o bloqueio por processo.

**Metas:** nenhuma falha e 95% das respostas em menos de 200 ms (p95) no PC. No GitHub Actions, a meta de p95 é
500 ms, porque o k6, a API e o banco dividem 2 CPUs (variável `META_P95_MS`).

No fim, o teste lê no Actuator como o pool de conexões do banco (HikariCP) se comportou: quantos pedidos de conexão
houve, a espera média e a maior, e se algum pedido esgotou o tempo.

## Resultado em 03/11/2026

| Sensores simultâneos | Tempo médio | p95 | Maior tempo |
|---|---|---|---|
| 10 | 10,67 ms | 23,84 ms | 123,57 ms |
| 25 | 21,44 ms | 35,59 ms | 122,70 ms |
| 50 | 42,87 ms | 68,24 ms | 280,70 ms |

- **Volume:** 201.617 lotes, cerca de 1.006 por segundo.
- **Falhas:** nenhuma; todos os lotes receberam `201`, e o banco ficou com exatamente 201.617 lotes.
- **Banco:** nenhum deadlock e nenhum erro de conexão nos logs, com o pool de 10 conexões. Todos os lotes ficaram com
  `esperado` preenchido pelo trigger, e o `UPDATE` em um lote continuou sendo recusado depois do teste.

**Limites deste resultado:** ele vale para esta máquina e para o ambiente local.

- O teste e a API rodaram no mesmo computador, com a API acessada direto, sem Nginx e sem HTTPS.
- Todos os sensores usaram um só usuário, com o limite de lotes por minuto desligado. Em uso normal, o limite é de 60 por usuário.
- O site publicado não foi testado. O plano grátis tem 0,1 de CPU e o pool foi configurado com 3 conexões, então os números lá devem ser bem menores.

## Resultado em 10/11/2026: 100 sensores e pool do banco (GitHub Actions)

Runner do GitHub com 2 CPUs e 7 GB, com k6, API e banco na mesma máquina. Os dois testes rodaram ao mesmo tempo, em
máquinas separadas, com o mesmo script.

| Sensores simultâneos | p95 com pool 10 | p95 com pool 20 |
|---|---|---|
| 10 | 85,56 ms | 69,75 ms |
| 25 | 120,06 ms | 115,85 ms |
| 50 | 169,01 ms | 158,32 ms |
| 100 | 377,38 ms | **261,85 ms** |

| Indicador | Pool 10 | Pool 20 |
|---|---|---|
| Lotes aceitos | 184.115 (557 por segundo) | 210.820 (638 por segundo) |
| Falhas | 0 | 0 |
| Espera média por conexão | 42,77 ms | 30,72 ms |
| Maior espera por conexão | 1.195 ms | 647 ms |
| Pedidos que esgotaram o tempo | 0 | 0 |

**Conclusão.** Com 100 sensores, o pool de 10 conexões vira parte do gargalo: o registro de lote segura uma conexão
enquanto espera o bloqueio do processo (RNF10), e com só 4 processos muitos lotes esperam juntos. Com 20 conexões, o
p95 caiu 31% e a vazão subiu 15%, sem nenhuma falha. Por isso o padrão da API passou a ser **20**. No Render, com 0,1
de CPU, o pool continua definido por `DB_POOL_MAX` com um valor menor.

Os números do GitHub Actions não se comparam direto com os do PC (seção anterior): a máquina é outra e mais fraca.
A mesma configuração rodada duas vezes variou cerca de 15% no p95 de 100 sensores.

## Turno industrial: 120 sensores com picos de lavagem (issue #165)

O teste de lotes acima manda requisições sem pausa para achar o limite. Este, em
[`testes-carga/turno-industrial.js`](../../testes-carga/turno-industrial.js), imita um turno da fábrica (RNF17):
**120 sensores**, cada um mandando uma leitura a cada **2 segundos** (60 por segundo), com dois picos repentinos de
lavagem química, em que o ritmo triplica (180 por segundo).

| Etapa | Duração | Leituras por segundo |
|---|---|---|
| Rampa: sensores entram no turno | 1 min | 0 a 60 |
| Platô | 3 min | 60 |
| Pico de lavagem química (sobe em 10 s) | 1 min | 180 |
| Platô | 2 min | 60 |
| Segundo pico (sobe em 10 s) | 1 min | 180 |
| Platô e rampa de saída | 1,5 min | 60 a 0 |

- **Como o sensor de verdade:** cada leitura é um `POST /lotes` com o token de API da conta de sensor e uma
  `Idempotency-Key`, sem login (o mesmo caminho do ESP32). O teste rotaciona o token da `sensor.wokwi` no início.
  Cada sensor fica numa das 4 máquinas (processos); no pico, o consumo sobe e mais lotes passam da meta.
- **Ritmo fixo:** as leituras saem no horário mesmo que a API demore (modelo aberto do k6), com no máximo 120 sensores
  esperando resposta ao mesmo tempo. Se a API não der conta, o k6 conta as leituras que não saíram (`dropped_iterations`).
- **Pool do banco durante o turno:** a cada 2 s, o teste lê no Actuator as conexões ativas e os pedidos esperando
  conexão, separados por fase. No fim, lê a espera média, a maior e os pedidos que esgotaram o tempo.

**Metas (critérios da issue):** p95 das leituras abaixo de **250 ms** no pico e no turno todo, **0% de respostas 5xx**,
nenhuma leitura recusada e nenhum pedido de conexão esgotado. Leituras que não saem no horário (os 120 sensores
esperando resposta) podem ser até 1% das 50.700 previstas: o ESP32 guarda a leitura no buffer e reenvia, então
algumas atrasadas não perdem dado. A meta é a mesma no PC e no GitHub Actions,
porque a carga aqui é bem menor que a do teste sem pausa.

### Como rodar

```bash
docker compose -p aguas-carga -f docker-compose.yml -f docker-compose.carga.yml --profile carga run --rm --no-TTY   -e K6_WEB_DASHBOARD=true -e K6_WEB_DASHBOARD_EXPORT=/resultados/turno-painel.html k6 run /scripts/turno-industrial.js
docker compose -p aguas-carga -f docker-compose.yml -f docker-compose.carga.yml --profile carga down -v
```

Para um ensaio rápido, encurte o turno com `-e ESCALA_TEMPO=0.2` (2 minutos). No GitHub Actions, roda no mesmo
workflow **Teste de carga**, no job *turno industrial*.

### Relatórios

Ficam em `testes-carga/resultados/` (no GitHub Actions, no artefato `carga-turno-industrial`):

- `turno-industrial.html`: o relatório do teste, com os critérios de aceitação, p95 e requisições por segundo por fase e o pool de conexões.
- `turno-painel.html`: o painel do próprio k6, com os gráficos ao longo do tempo (latência, requisições e VUs).
- `turno-industrial.json`: todas as métricas, para comparar execuções.

**Limites:** os 120 sensores usam uma só conta de sensor, com o limite de lotes por minuto desligado, e o teste roda
no ambiente descartável do Docker, sem Nginx e sem HTTPS. O site publicado não é testado.

### Resultado em 17/11/2026 (GitHub Actions)

Runner do GitHub com 2 CPUs, com k6, API e banco na mesma máquina, pool de 20 conexões. O mesmo turno rodou três
vezes (a primeira, antes do ajuste no relatório HTML; a segunda, com a regra antiga de nenhuma leitura atrasada):

| Rodada | p95 no platô | p95 no pico | p95 no turno | Maior tempo | Respostas 5xx | Leituras atrasadas |
|---|---|---|---|---|---|---|
| 1 | 6,42 ms | 16,02 ms | 8,25 ms | 470 ms | 0 | 0 |
| 2 | 7,69 ms | 177,96 ms | 52,56 ms | 1.006 ms | 0 | 32 (0,06%) |
| 3 | 72,61 ms | **150,73 ms** | 112,36 ms | 956 ms | 0 | 0 |

- **Volume:** 50.699 leituras por turno (as 50.700 previstas, menos a última, cortada no fim), cerca de 83 por segundo
  em média, todas com `201`.
- **Critérios da issue:** atingidos nas três: p95 abaixo de 250 ms no pico e 0% de 5xx.
- **Pool (HikariCP):** na maior parte do turno, menos de 1 conexão ativa em média (p95 de 4). Mas nas rodadas 2 e 3 o
  pool chegou às 20 conexões, com até 49 pedidos esperando, e algumas leituras levaram perto de 1 s. A espera média
  por conexão ficou entre 2 e 3 ms, a maior em ~820 ms, e nenhum pedido esgotou o tempo.

**Conclusão.** A API aguenta o turno de 120 sensores com folga na média, mas tem picos curtos em que o pool enche. É o
mesmo gargalo do teste de 100 sensores (seção anterior): o registro de lote segura uma conexão enquanto espera o
bloqueio do processo (RNF10), e os 120 sensores se dividem em só 4 processos, então muitos esperam pelo mesmo bloqueio
ao mesmo tempo. Como o runner é compartilhado, a mesma configuração variou bastante entre as rodadas (p95 do pico de
16 a 178 ms); o critério de 250 ms passou em todas.

## Observação sobre os alertas

O teste terminou com 12.499 alertas abertos nos 4 processos. Isso segue a regra atual: cada nova sequência de 3 lotes
acima da meta cria outro alerta se a anterior foi interrompida por um lote dentro da meta. Com os lotes sorteados, a conta
esperada era de cerca de 12.600.

Em uso real, um mesmo processo pode acumular vários alertas abertos. O parecer técnico descreve o lote sendo anexado ao
alerta já aberto do processo, então vale confirmar com o orientador se é esse o comportamento desejado.
