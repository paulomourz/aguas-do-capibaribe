# Histórico de versões

Todas as mudanças relevantes do projeto ficam registradas aqui. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Funcionalidades

- **Documentação interativa da API (Swagger UI)** em `/api/swagger-ui.html`, com as 16 rotas por grupo,
  exemplos, erros possíveis e login por token (botão Authorize). Desligável com `SWAGGER_ATIVO=false`.
- **Auditoria das ações do gestor** (issue #16): redefinir senha, desativar e reativar outra pessoa
  ficam registrados em `auditoria_usuario` (quem, em quem, o quê, quando), sem senha e sem poder ser
  alterados ou apagados. 46 testes (30 unitários e de web + 16 de integração).

### Banco de dados

- **Migração obrigatória** para bancos já existentes, antes de subir a API nova:
  `database/migracoes/001-auditoria-usuario.sql`. Bancos novos já recebem a tabela pelo `banco.sql`.

### Segurança

- Usuário restrito `aguas_api` para a API (`database/seguranca-usuario-api.sql`): lê, insere e
  atualiza, sem `DELETE`, `TRUNCATE`, `DROP` nem `ALTER`. O `backend/.env.example` já vem com ele.

### Documentação

- Passo do `aguas_api` no "Como rodar" do README, no guia e no `database/LEIA-ME.md`.
- README e guia: passo a passo para começar num PC novo (clonar e usar a `develop`).

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

[0.1.0-alpha]: https://github.com/paulomourz/aguas-do-capibaribe/releases/tag/v0.1.0-alpha
