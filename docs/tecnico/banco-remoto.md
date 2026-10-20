# PostgreSQL remoto: o que o responsável pelo banco precisa fornecer

A API roda num computador e o PostgreSQL em outro. Este guia lista o que precisa ser combinado.
Nenhuma credencial deve ser enviada por chat nem gravada no Git: os valores vão só para o arquivo
`backend/.env` (ignorado pelo Git) ou para variáveis de ambiente do servidor.

## 1. Esquema

- Aplique [`../../database/banco.sql`](../../database/banco.sql), um dump do PostgreSQL 18.6, num banco
  vazio. Use o `psql` 18 ou mais recente, por causa dos comandos `\restrict` do dump:
  `psql -h <host> -U postgres -d <banco> -v ON_ERROR_STOP=1 -f database/banco.sql`
- A API **não cria nem altera** tabelas, triggers ou views. Se o esquema mudar, a API precisa ser
  ajustada junto. Na inicialização, ela confere tabelas e colunas e não sobe se algo divergir.

## 2. Dados a informar à equipe da API

| Item | Variável | Observação |
|---|---|---|
| Endereço do servidor | `DB_HOST` | IP fixo ou nome DNS acessível a partir da máquina da API |
| Porta | `DB_PORT` | normalmente 5432 |
| Nome do banco | `DB_NAME` | |
| Usuário da aplicação | `DB_USER` | **não** use o superusuário `postgres` |
| Senha desse usuário | `DB_PASSWORD` | entregue por canal seguro |
| Exigência de SSL | `DB_SSLMODE` | `require` ou `verify-full` se a conexão sair da rede local |

## 3. Usuário da aplicação (sugestão de permissões mínimas)

A API precisa ler e gravar dados, mas não alterar a estrutura. Execute como dono do banco, trocando os
nomes:

```sql
CREATE ROLE aguas_api LOGIN PASSWORD '<defina uma senha forte>';
GRANT CONNECT ON DATABASE <banco> TO aguas_api;
GRANT USAGE ON SCHEMA public TO aguas_api;
GRANT SELECT, INSERT, UPDATE ON usuario, processo, alerta TO aguas_api;
GRANT SELECT, INSERT ON lote, alerta_lote TO aguas_api;
GRANT SELECT ON v_alertas, v_historico_lotes TO aguas_api;
GRANT USAGE, SELECT ON SEQUENCE usuario_id_seq, processo_id_seq, lote_id_seq, alerta_id_seq TO aguas_api;
```

Por que esses privilégios:

- `UPDATE` em `processo` e `usuario` cobre a edição de metas, de nome e de senha e a
  ativação/desativação de acesso.
- Em `alerta`, o `UPDATE` serve para mudar o status.
- `lote` só precisa de `INSERT`, porque o trigger já impede alterações.
- A API não faz `DELETE` em nenhuma tabela.
- Sem `DELETE`, `TRUNCATE` e `CREATE`, um erro ou invasão na API não consegue apagar dados nem alterar
  o esquema.

## 4. Rede

- **Firewall do servidor do banco:** libere a porta do PostgreSQL (5432) **apenas** para o IP da
  máquina da API.
- **`postgresql.conf`:** `listen_addresses` precisa incluir a interface de rede usada (não só
  `localhost`).
- **`pg_hba.conf`:** adicione uma linha restrita ao IP da API, por exemplo
  `hostssl  <banco>  aguas_api  <IP_DA_API>/32  scram-sha-256`. Use `host` em vez de `hostssl` só
  numa rede local confiável e sem SSL configurado. Depois, recarregue o PostgreSQL.
- Para testar a partir da máquina da API, antes de subir a aplicação:
  `psql "host=<host> port=5432 dbname=<banco> user=aguas_api sslmode=require"`
  (ou `Test-NetConnection <host> -Port 5432` no PowerShell, para testar só a porta).

## 5. Primeiro gestor

Não é preciso inserir ninguém à mão. Na primeira inicialização num banco vazio, a API cria o
administrador principal (`capibaribe.admin`, perfil gestor) com a senha de `ADMIN_SENHA`, guardada só
como hash BCrypt. Detalhes em [`../../backend/README.md`](../../backend/README.md#administrador-principal).

## 6. Situação atual (20/10/2026)

- **Banco oficial:** `aguas`, no PostgreSQL 18 da máquina de DevOps (`DB_HOST=localhost`). Desde
  20/10/2026 ele tem só os **dois usuários fixos**: `capibaribe.admin` (gestor, administrador do
  site) e `sensor.wokwi` (operador, usado pelo sensor no Wokwi). As senhas estão em
  `docs/privado/acessos-e-senhas.md`, fora do Git. Não há processos, lotes nem alertas: os testes
  foram apagados (com a trava `trg_lote_imutavel` desligada só durante a limpeza). Os processos reais
  são cadastrados pela tela **Processos e metas**.
- **Não existe mais banco de teste permanente.** O antigo `aguas_teste` foi apagado. Os testes de
  integração usam um banco descartável criado só na hora e apagado ao final (ver
  [`../../backend/README.md`](../../backend/README.md#testes)). Nunca rode os testes no `aguas`.
- **Pendente:** a API ainda se conecta como `postgres` (superusuário). Antes de publicar, crie o
  usuário `aguas_api` da seção 3 e troque `DB_USER`/`DB_PASSWORD` no `backend/.env`.
- **Servidor remoto:** a conexão com um PostgreSQL em outra máquina ainda não foi testada. Na
  primeira conexão, confirme que:
  1. a API inicia sem erro de validação do esquema (`Started AguasApiApplication` no log);
  2. o login do administrador principal funciona;
  3. registrar um lote preenche `esperado` (trigger) e aparece no histórico.
