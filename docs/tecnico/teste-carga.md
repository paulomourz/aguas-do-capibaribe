# Teste de carga do registro de lotes

Mede como a API se comporta com vários sensores enviando lotes ao mesmo tempo (issue #56). O teste usa o
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

## O que o teste faz

| Etapa | Sensores simultâneos | Duração |
|---|---|---|
| 1 | 10 | 30 s |
| 2 | 25 | 30 s |
| 3 | 50 | 2 min |

Cada sensor envia um lote atrás do outro, sem pausa, para um dos 4 processos iniciais, com litros de 20% abaixo a 20%
acima da meta. Assim, o teste também exercita a regra de alerta e o bloqueio por processo.

**Metas:** 95% das respostas em menos de 200 ms (p95) e nenhuma falha.

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

## Observação sobre os alertas

O teste terminou com 12.499 alertas abertos nos 4 processos. Isso segue a regra atual: cada nova sequência de 3 lotes
acima da meta cria outro alerta se a anterior foi interrompida por um lote dentro da meta. Com os lotes sorteados, a conta
esperada era de cerca de 12.600.

Em uso real, um mesmo processo pode acumular vários alertas abertos. O parecer técnico descreve o lote sendo anexado ao
alerta já aberto do processo, então vale confirmar com o orientador se é esse o comportamento desejado.
