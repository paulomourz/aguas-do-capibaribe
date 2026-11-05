# Histórico de versões

Todas as mudanças relevantes do projeto ficam registradas aqui. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Banco de dados

- **Backup e restore do PostgreSQL** (issue #53, item #25 do parecer): `database/backup.sh` faz o backup com
  `pg_dump` compactado e o restaura num banco temporário para conferir as linhas de cada tabela. Ele guarda 7 dias de
  backups e só apaga os antigos depois de um backup bom. `database/restore.sh` restaura só em banco vazio, nunca por
  cima de dados. Funciona com o banco do Docker, do PC e do Neon. Sem `pg_dump` instalado, usa o Docker. Uso em
  `database/LEIA-ME.md#backup-e-restore`.

### Desempenho

- **Índices da regra de alerta e dos lotes de um alerta** (issue #59): migração `V8` cria `ix_lote_processo_data`
  (substitui `ix_lote_processo`) e `ix_alerta_lote_alerta`. Com 200.000 lotes, a busca da regra de alerta num processo
  pouco usado cai de 73,5 ms para 0,19 ms, e a dos lotes de um alerta de 9,8 ms para 0,40 ms. Medição e scripts em
  `docs/tecnico/desempenho-indices.md` e `database/desempenho/`.

### Removido

- **Modo simulado do site** (item #21 do parecer): saem `src/mock/`, `src/services/mockUtil.ts`, a variável
  `VITE_USAR_MOCK` e a faixa amarela de aviso. Os serviços em `src/services/` passam a chamar só a API. Os dados e a
  senha de demonstração (`gestor.demo`, `operador01`) deixam de ir no bundle de produção, e o arquivo principal
  diminui de 337,7 kB para 331,2 kB (97,9 kB para 95,6 kB com gzip). Para demonstrar sem internet, use o Docker
  (plano B do roteiro de apresentação).

### Funcionalidades

- **Registro de lotes com a Wi-Fi oscilando (PWA):** o site vira PWA (`vite-plugin-pwa`) e abre sem conexão. Lote
  registrado sem conexão fica guardado no aparelho (IndexedDB) e é enviado sozinho quando a conexão volta, na ordem
  em que foi feito. O operador vê o que falta enviar no cabeçalho e em **Registro de lotes → Guardados neste
  aparelho**, com **Enviar agora**, **Tentar de novo** e **Descartar** (para lote recusado pela API).
- **`POST /lotes` aceita `Idempotency-Key`:** reenviar a mesma chave devolve o lote já gravado (`200`), sem duplicar
  nem reaplicar a regra de alerta. Migração `V5` cria `lote.chave_envio` com índice único. O sensor continua igual.

- **Sensor local no Wokwi:** o `iot/sketch.ino` aceita `http://` além de `https://`, e o projeto
  `aguas-capibaribe-local` fala com o Docker. O projeto público continua em HTTPS.
- **Túnel no Docker Compose:** `docker compose --profile tunel up -d --build` liga o túnel sem instalar o cloudflared.
  Ele fica desligado por padrão.

### Testes

- **Modo offline do site:** `pnpm test` (Vitest, 20 testes da fila e da sincronização) e `pnpm test:e2e`
  (Playwright, 3 testes com a conexão caindo e voltando no site de produção). 3 testes de integração novos na API
  para a `Idempotency-Key`.

### Documentação

- **Validação de usabilidade com operador** em `docs/validacao/` (item #22 do parecer): roteiro com 6 tarefas,
  questionário SUS em português, ficha do observador, kit em PDF para imprimir e modelo de resultado. Ainda não
  aplicado.
- **Roteiro de apresentação** em `docs/guia/roteiro-apresentacao.md`, com o plano A (site publicado) e o plano B (Docker).
- **ERS v1.1** e **atualização do TAP** em `docs/gestao/`, com o que mudou até a versão 1.0.0 e o que falta formalizar.
- `docs/tecnico/banco-remoto.md` e `docs/tecnico/api.md` com o banco e a API publicados.
- Guia, README e `iot/LEIA-ME.md` com o site publicado, o Docker e os dois projetos do Wokwi.

## [1.0.0] - 2026-11-02

Primeira versão completa, publicada na internet, com o sensor simulado enviando lotes por HTTPS.

### Funcionalidades

- **ESP32 em HTTPS com endereço fixo** (issue #13): o sensor confere a impressão digital do certificado da API publicada, reaproveita
  a conexão, tenta de novo enquanto a API acorda e renova o login quando a sessão vence.
- **Conta do sensor automática:** com `SENSOR_SENHA` definida, a API cria `sensor.wokwi` ao subir. O
  `iot/criar-sensor.sql` foi removido.
- **Sistema publicado:** site e API no Render, banco no Neon.
- **Docker Compose** (issue #10): `docker compose up -d --build` sobe banco, API e site em
  `http://localhost:3000`, com o Nginx encaminhando `/api`. As senhas são sorteadas na primeira subida,
  fora do Git.
- **Documentação interativa da API (Swagger UI)** em `/api/swagger-ui.html`, com as 16 rotas por grupo,
  exemplos, erros possíveis e login por token (botão Authorize). Desligável com `SWAGGER_ATIVO=false`.
- **Auditoria das ações do gestor** (issue #16): redefinir senha, desativar e reativar outra pessoa
  ficam registrados em `auditoria_usuario` (quem, em quem, o quê, quando), sem senha e sem poder ser
  alterados ou apagados. 46 testes (30 unitários e de web + 16 de integração).
- **Site usa a API real por padrão** (issue #5): sem `.env.local`, conecta em
  `http://localhost:8080/api`. O modo simulado só liga com `VITE_USAR_MOCK=true` e mostra uma faixa de
  aviso. Com a API fora do ar, o login e a recarga da página mostram "Não foi possível conectar ao
  servidor." (com "Tentar novamente"), em vez de "sessão expirada". Rodapé com a versão do
  `package.json`.
- **Status do lote calculado pela API** (issue #3): cada lote sai com `statusConformidade`
  (`DENTRO_DA_META`, `ATENCAO` ou `CRITICO`) e o site usa essa faixa no Histórico, nos lotes do alerta
  e no registro. Limites oficiais de 0% e 8%. Totais e médias são classificados no site, com os mesmos limites.
  57 testes (41 unitários e de web + 16 de integração).

### Testes

- **Teste de aceitação do ciclo completo** (issue #12): `CicloCompletoLavanderiaE2ETest` percorre por HTTP
  a jornada da lavanderia: login, processo, operador, lotes, alerta aberto e resolvido, e relatório do mês
  com os totais exatos. 60 testes (41 unitários e de web + 19 de integração).
- **Cadastro de processos coberto por testes** (issue #17): `ProcessoControllerTest` confere que meta zero
  ou negativa, unidade ou meta faltando e nome repetido (ao criar e ao editar) voltam com o erro no campo
  certo (422 ou 409) e não gravam nada. 56 testes (40 unitários e de web + 16 de integração).
- **CI no GitHub Actions** (issue #7): `backend-test` roda `mvn clean test` no Java 25 e falha se a
  integração for pulada; `frontend-build` roda `tsc --noEmit` e `pnpm build`. Badge no README.

### Banco de dados

- **Versionamento com Flyway** (issue #8): o esquema passa a ser criado e evoluído por migrações em
  `backend/src/main/resources/db/migration/`, aplicadas pela API ao subir: V1 (tabelas, índices e
  views), V2 (triggers do esperado e da imutabilidade do lote), V3 (processos iniciais) e V4
  (`auditoria_usuario`). O `database/banco.sql` e o `database/migracoes/` saem (V1, V2 e V4 reproduzem o
  mesmo esquema). Novas variáveis: `FLYWAY_USER`, `FLYWAY_PASSWORD`, `FLYWAY_ATIVO`, `FLYWAY_BASELINE`.
  **Banco oficial:** subir uma vez com `FLYWAY_BASELINE=true` (ver `database/LEIA-ME.md`).
  59 testes (41 unitários e de web + 18 de integração).
- **Migração obrigatória** para bancos já existentes, antes de subir a API nova:
  `database/migracoes/001-auditoria-usuario.sql` (hoje V4 do Flyway).

### Segurança

- Usuário restrito `aguas_api` para a API (`database/seguranca-usuario-api.sql`): lê, insere e
  atualiza, sem `DELETE`, `TRUNCATE`, `DROP` nem `ALTER`. O `backend/.env.example` já vem com ele.

### Documentação

- **Bancada física** (issue #14): `docs/tecnico/hardware-bancada.md`, com peças, preços pesquisados, circuito,
  calibração do YF-S201 e mudanças no sketch.
- Passo do `aguas_api` no "Como rodar" do README, no guia e no `database/LEIA-ME.md`.
- README e guia: passo a passo para começar num PC novo (clonar e usar a `develop`).
- README: como trabalhar numa issue (fechar à mão depois do merge na `develop`, migrações quando o
  banco muda) e próximos passos apontando para as Issues do GitHub.
- Guia: auditoria nas regras de acesso, migrações no "Como rodar" e o erro de esquema nos problemas
  comuns.

## [0.1.0-alpha] - 2026-10-27

Primeira versão preliminar: baseline das semanas 1 a 3 do cronograma do TAP.

### Funcionalidades

- **Acesso:** login com JWT, perfis gestor e operador, mesma mensagem para senha errada e usuário
  desativado; o administrador principal é criado pela API na primeira inicialização.
- **Usuários e conta:** o gestor cadastra, desativa, reativa e redefine a senha de outras pessoas;
  cada usuário altera o próprio nome e senha.
- **Processos e metas:** meta em litros por lote ou por peça, sem valores zero ou negativos.
- **Lotes:** registro com confirmação, esperado calculado pelo banco, desvio calculado pela API e lote
  imutável; histórico por perfil (operador vê os seus, gestor vê todos).
- **Alertas:** abertos quando 3 lotes seguidos do mesmo processo passam da meta, com status aberto,
  em análise e resolvido.
- **Dashboard e relatório mensal** por processo, com download direto em PDF
  (`aguas-do-capibaribe-relatorio-AAAA-MM.pdf`).
- **IoT fase 1:** ESP32 simulado no Wokwi mede a vazão e registra o lote pela API, encontrando o
  processo pelo nome.
- **Interface:** identidade visual "sertão e água", site em pt-BR, navegação por teclado nos modais e
  contraste conforme WCAG 2.1 AA.

### Técnico

- Front-end React 19 + Vite + Tailwind CSS 4; API Java 25 (LTS) + Spring Boot 3.5; PostgreSQL 18.
- 40 testes automatizados passando (25 unitários e de web + 15 de integração em banco temporário).

### Documentação

- README, guia em PDF, Termo de Abertura v2.1 e Especificação de Requisitos de Software (IEEE 830).

[1.0.0]: https://github.com/paulomourz/aguas-do-capibaribe/releases/tag/v1.0.0
[0.1.0-alpha]: https://github.com/paulomourz/aguas-do-capibaribe/releases/tag/v0.1.0-alpha
