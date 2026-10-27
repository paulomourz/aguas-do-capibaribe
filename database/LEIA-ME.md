# Banco de dados

`banco.sql` é o esquema oficial do sistema: um dump do PostgreSQL 18.6 com tabelas, triggers e views.
A API não cria nem altera nada no esquema; ela só confere, ao subir, se as tabelas batem.

| Tabela | Guarda |
|---|---|
| `usuario` | pessoas que entram no sistema (gestor ou operador), com a senha só como hash BCrypt |
| `processo` | tipos de processo de lavagem e a meta de cada um (litros por lote ou por peça) |
| `lote` | cada lote registrado: processo, peças, litros usados e litros esperados |
| `alerta` / `alerta_lote` | alertas de 3 lotes seguidos acima da meta e os lotes de cada alerta |

Regras que moram no próprio banco:

- `trg_lote_esperado` calcula o esperado do lote a partir da meta do processo no momento do registro.
- `trg_lote_imutavel` impede alterar ou apagar lotes: o histórico de consumo é a prova do que
  aconteceu.
- As views `v_historico_lotes` e `v_alertas` entregam o desvio já calculado.

## Banco oficial

O banco em uso é o **`aguas`** (situação atual e permissões recomendadas em
[`../docs/tecnico/banco-remoto.md`](../docs/tecnico/banco-remoto.md)). Para criar um banco novo a partir
do esquema (psql 18 ou mais novo):

```bash
psql -U postgres -c "create database aguas"
psql -U postgres -d aguas -v ON_ERROR_STOP=1 -f database/banco.sql
psql -U postgres -d aguas -v ON_ERROR_STOP=1 -v papel=aguas_api -v banco=aguas -v senha='<senha forte>' -f database/seguranca-usuario-api.sql
```

| Arquivo | Para quê |
|---|---|
| `banco.sql` | estrutura do banco: tabelas, triggers e views, sem nenhum dado |
| `seguranca-usuario-api.sql` | cria o usuário `aguas_api`, que a API usa, só com ler, inserir e atualizar (sem apagar nem mudar a estrutura) |

Na primeira vez que a API sobe num banco vazio, ela cria o administrador principal
(`capibaribe.admin`). Os testes automáticos usam bancos temporários terminados em `_teste`, criados e
apagados na hora; nunca rode os testes no `aguas`.
