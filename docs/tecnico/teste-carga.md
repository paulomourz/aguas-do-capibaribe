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

## Observação sobre os alertas

O teste terminou com 12.499 alertas abertos nos 4 processos. Isso segue a regra atual: cada nova sequência de 3 lotes
acima da meta cria outro alerta se a anterior foi interrompida por um lote dentro da meta. Com os lotes sorteados, a conta
esperada era de cerca de 12.600.

Em uso real, um mesmo processo pode acumular vários alertas abertos. O parecer técnico descreve o lote sendo anexado ao
alerta já aberto do processo, então vale confirmar com o orientador se é esse o comportamento desejado.
