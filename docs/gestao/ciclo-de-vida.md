<p align="center"><img src="../assets/logo-referencia.png" width="120" alt="Logo do Águas do Capibaribe"></p>

# Águas do Capibaribe — Processos do Ciclo de Vida

Como o projeto aplica os processos de ciclo de vida de software da norma **ISO/IEC 12207**, da concepção ao
descarte, e qual documento ou artefato registra cada um. A norma agrupa os processos em quatro grupos: acordo,
habilitadores organizacionais, gestão técnica e técnicos.

| Campo | Descrição |
|---|---|
| Versão | 1.1, 20 de novembro de 2026 (versão 1.2.0 do sistema) |
| Modelo de ciclo de vida | Incremental, em entregas semanais (TAP, seção 10), com integração e entrega contínuas |
| Responsáveis | Equipe Águas do Capibaribe; orientador como patrocinador |

<!-- sumario -->

# 1. Visão geral

O ciclo do projeto tem cinco estágios. Cada um termina num marco verificável:

| Estágio | O que acontece | Marco |
|---|---|---|
| Concepção | Problema, solução, escopo e partes interessadas | TAP v1.0 (22/09/2026) |
| Desenvolvimento | Requisitos, arquitetura, código e testes, em incrementos semanais | ERS v1.0 (27/10/2026) |
| Produção e entrega | Versão publicada no Render e no Neon | Versão 1.0.0 (02/11/2026) |
| Utilização e suporte | Uso, monitoramento, correções e melhorias pela `develop` | Itens dos pareceres; versões 1.1.0 (14/11/2026) e 1.2.0, a última, com a demonstração (23/11/2026) |
| Descarte | Encerramento dos serviços e arquivamento | Seção 6 |

# 2. Processos de acordo

| Processo | Como é feito | Registro |
|---|---|---|
| Aquisição e fornecimento | O orientador (patrocinador) define o objetivo acadêmico e valida as entregas; a equipe entrega o sistema e a documentação. | TAP, seções 1, 2 e 12 (assinatura) |

# 3. Processos habilitadores organizacionais

| Processo | Como é feito | Registro |
|---|---|---|
| Gestão do modelo de ciclo de vida | Fluxo GitFlow e incrementos semanais, iguais para toda a equipe. | Este documento; README |
| Gestão de infraestrutura | GitHub (código, issues, CI), Render, Neon, Docker e Wokwi. | docs/tecnico/arquitetura.md, seção 6 |
| Gestão de portfólio | Um único projeto; prioridades no backlog de histórias. | TAP, Parte 2 |
| Gestão de recursos humanos | Papéis por pessoa, com revezamento conforme a afinidade. | TAP, seção 2 |
| Gestão da qualidade | Revisão de cada pull request, CI obrigatório para publicar e Quality Gate do SonarQube (nenhum problema novo, cobertura de pelo menos 80% no código novo). | Modelo de PR em `.github/`; docs/tecnico/testes.md; `sonar-project.properties` |
| Gestão do conhecimento | Documentação no repositório, perto do código. | docs/README.md |

# 4. Processos de gestão técnica

| Processo | Como é feito | Registro |
|---|---|---|
| Planejamento do projeto | Marcos semanais e issues com responsável. | TAP, seção 10; issues do GitHub |
| Avaliação e controle | Acompanhamento das issues e dos pareceres do orientador. | Issues e pull requests |
| Gestão de decisões | Decisões da equipe registradas e citadas nos documentos (P1, P3, P7). | Registro de Decisões v1; TAP |
| Gestão de riscos | Riscos do projeto e de segurança, com mitigação; runbook de recuperação de desastres. | TAP, seção 9; docs/gestao/seguranca.md; docs/tecnico/runbook-disaster-recovery.md |
| Gestão de configuração | Git com GitFlow: `develop` padrão, `main` só com versões e tags; banco versionado com Flyway; SBOM com os componentes de cada versão. | Repositório; database/LEIA-ME.md; anexos das releases |
| Gestão da informação | Documentos em Markdown no Git, com PDF gerado; segredos fora do Git. | docs/; docs/gestao/LEIA-ME.md |
| Medição | Testes por execução do CI, cobertura, análise estática, teste de carga e métricas da API. | docs/tecnico/teste-carga.md; SonarQube; `/api/actuator/metrics` |
| Garantia da qualidade | Revisão e teste das entregas antes do merge. | Pull requests |

# 5. Processos técnicos

| Processo | Como é feito | Registro |
|---|---|---|
| Análise de negócio ou missão | Problema das lavanderias do Agreste e justificativa de custo e de impacto. | TAP, seção 3 |
| Necessidades e requisitos dos stakeholders | Partes interessadas e histórias de usuário com cenários. | TAP, seção 7 e Parte 2; ERS, seção 1.3.5 |
| Requisitos do sistema e do software | Especificação com 37 requisitos funcionais e 29 não funcionais. | ERS v2.6 (ISO/IEC/IEEE 29148) |
| Definição da arquitetura | Visões de contexto, lógica, dados, implantação e desenvolvimento. | docs/tecnico/arquitetura.md (ISO/IEC/IEEE 42010) |
| Definição do projeto (design) | Contrato da API, modelo do banco e protótipo das telas. | docs/tecnico/api.md; migrações Flyway |
| Análise do sistema | Medições de desempenho. | docs/tecnico/teste-carga.md; docs/tecnico/desempenho-indices.md |
| Implementação | Código em branches `feature/`, `fix/` e `docs/`, por pull request. | Repositório |
| Integração | CI no GitHub Actions a cada pull request, com Docker Compose, SBOM e Quality Gate. | `.github/workflows/` (`ci.yml`, `sbom.yml`, `qualidade.yml`) |
| Verificação | Testes automáticos e demonstrações ligados a cada requisito. | ERS, seção 4; docs/tecnico/testes.md (ISO/IEC/IEEE 29119) |
| Transição | Publicação automática no Render depois do CI; versões na `main` por `release/`. | README; CHANGELOG.md |
| Validação | Avaliação simulada, teste com pessoas de fora da equipe e avaliação heurística (Nielsen); o teste com operador real ficou como limitação. | docs/validacao/; docs/gestao/avaliacao-heuristica-usabilidade.md; issue #50 |
| Operação | Uso pelo site e pelo sensor; guia para usuários e para quem roda o sistema. | Guia (ISO/IEC/IEEE 26514); roteiro de apresentação |
| Manutenção | Correções e melhorias pela `develop`; rollback no Render se uma publicação der erro. | Issues; README |
| Descarte | Encerramento planejado (seção 6). | Este documento |

# 6. Descarte

Quando o projeto for encerrado:

1. Fazer o backup final do banco publicado com `database/backup.sh` e guardá-lo com a equipe.
2. Desativar o aviso: `/revoke` do token no BotFather e remoção das variáveis do Telegram no Render.
3. Excluir os serviços no Render e o banco no Neon.
4. Apagar `docs/privado/` e os arquivos `.env` das máquinas da equipe.
5. Gerar a versão final na `main` e arquivar o repositório no GitHub (somente leitura).

Os dados de consumo de lavanderias reais, se houver, só são apagados depois do backup final e com a concordância do
responsável pela lavanderia.
