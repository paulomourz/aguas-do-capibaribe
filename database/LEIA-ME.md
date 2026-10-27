# Banco de dados

`banco.sql` é o esquema oficial do sistema: um dump do PostgreSQL 18.6 com tabelas, triggers e views.
A API não cria nem altera nada no esquema; ela só confere, ao subir, se as tabelas batem.

| Tabela | Guarda |
|---|---|
| `usuario` | pessoas que entram no sistema (gestor ou operador), com a senha só como hash BCrypt |
| `processo` | tipos de processo de lavagem e a meta de cada um (litros por lote ou por peça) |
| `lote` | cada lote registrado: processo, peças, litros usados e litros esperados |
| `alerta` / `alerta_lote` | alertas de 3 lotes seguidos acima da meta e os lotes de cada alerta |
| `auditoria_usuario` | quem (gestor) redefiniu a senha, desativou ou reativou quem, e quando; sem nenhuma senha |

Regras que moram no próprio banco:

- `trg_lote_esperado` calcula o esperado do lote a partir da meta do processo no momento do registro.
- `trg_lote_imutavel` impede alterar ou apagar lotes: o histórico de consumo é a prova do que
  aconteceu.
- `trg_auditoria_imutavel` faz o mesmo com os registros de auditoria.
- As views `v_historico_lotes` e `v_alertas` entregam o desvio já calculado.

## Banco oficial

O banco em uso é o **`aguas`** (situação atual e permissões recomendadas em
[`../docs/tecnico/banco-remoto.md`](../docs/tecnico/banco-remoto.md)). Para criar um banco novo a partir
do esquema (psql 18 ou mais novo):

```bash
psql -U postgres -c "create database aguas"
psql -U postgres -d aguas -v ON_ERROR_STOP=1 -f database/banco.sql
```

## Atualizar um banco que já existe (migrações)

O `banco.sql` sempre traz a estrutura mais nova, para bancos criados do zero. Quem já tem um banco
criado com uma versão anterior aplica, **uma vez e em ordem**, os scripts de [`migracoes/`](migracoes/)
que ainda não rodou, **antes** de subir a API nova (ela confere as tabelas ao subir e não sobe se
faltar alguma):

| Migração | O que faz | Desde |
|---|---|---|
| [`001-auditoria-usuario.sql`](migracoes/001-auditoria-usuario.sql) | cria `auditoria_usuario` e dá ao `aguas_api` permissão de ler e inserir nela | 27/10/2026 |

```bash
psql -U postgres -d aguas -v ON_ERROR_STOP=1 -f database/migracoes/001-auditoria-usuario.sql
```

Cada migração roda numa transação: se der erro, nada muda. Rodar de novo uma migração já aplicada dá
erro de "já existe" e também não muda nada.

Na primeira vez que a API sobe num banco vazio, ela cria o administrador principal
(`capibaribe.admin`). Os testes automáticos usam bancos temporários terminados em `_teste`, criados e
apagados na hora; nunca rode os testes no `aguas`.
