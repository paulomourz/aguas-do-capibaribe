<p align="center"><img src="../assets/logo-referencia.png" width="120" alt="Logo do Águas do Capibaribe"></p>

# Águas do Capibaribe — Segurança da Informação

Política de segurança, análise de riscos e plano de continuidade do Águas do Capibaribe, organizados conforme a
norma **ISO/IEC 27001** (sistema de gestão de segurança da informação). O documento segue a estrutura que a norma
pede, adaptada ao porte de um projeto acadêmico, sem certificação formal.

| Campo | Descrição |
|---|---|
| Versão | 1.0, 9 de novembro de 2026 |
| Escopo | Site, API, banco publicado (Render e Neon), ambiente Docker, sensor simulado, repositório no GitHub e aviso no Telegram |
| Responsável | Paulo Moura (DevOps), com apoio da equipe |
| Revisão | A cada versão do sistema ou depois de qualquer incidente |

<!-- sumario -->

# 1. Política de segurança da informação

## 1.1 Objetivo

Proteger os dados de consumo de água das lavanderias e as contas de acesso, garantindo:

- **Confidencialidade:** só quem tem permissão vê cada dado.
- **Integridade:** os registros de consumo e de auditoria não podem ser alterados nem apagados.
- **Disponibilidade:** o sistema volta a funcionar rápido depois de uma falha, sem perder dados.

## 1.2 Regras

1. **Senha e segredo nunca vão para o Git.** Senhas, tokens, a chave JWT e dados do banco ficam só em variáveis de
   ambiente do Render, em `backend/.env` e em `docs/privado/`, que estão fora do controle de versão.
2. **Cada pessoa tem a própria conta**, com o menor perfil que atende ao trabalho dela (operador, gestor ou
   administrador). Contas não são compartilhadas. O dispositivo usa a conta técnica `sensor.wokwi`.
3. **Sem autocadastro.** Só o administrador cria contas. Quem sai da equipe é desativado, nunca apagado.
4. **Dados de consumo são permanentes.** Ninguém altera nem apaga um lote ou um registro de auditoria.
5. **Toda mudança passa por pull request e CI.** O Render só publica depois que os testes passam.
6. **Testes nunca usam o banco oficial.** Dados de teste ficam no Docker ou num banco temporário.
7. **Senha do sensor só é colada no Wokwi na hora do uso**, sem salvar no projeto público.
8. **Incidente se comunica na hora** no grupo da equipe, e o responsável segue a seção 4.

## 1.3 Papéis e responsabilidades

| Papel | Responsabilidade |
|---|---|
| DevOps | Guardar os segredos, configurar o Render e o Neon, fazer backup, revisar os pull requests e conduzir incidentes. |
| Administrador do sistema | Criar, desativar e reativar contas, redefinir senhas e acompanhar a auditoria. |
| Equipe de desenvolvimento | Seguir as regras da seção 1.2 e não colocar segredos em código, issue, print ou conversa aberta. |
| Orientador | Aprovar as decisões que mudam o escopo ou o risco do projeto. |

# 2. Análise de riscos

Probabilidade e impacto em três níveis (baixo, médio, alto). O risco residual é o que sobra depois dos controles.

| ID | Ameaça | Prob. | Impacto | Controles | Risco residual |
|---|---|---|---|---|---|
| R01 | Senha ou token vazar no repositório | Média | Alto | `.gitignore` para `.env`, `.env.local`, `.env.backup` e `docs/privado/`; revisão dos PRs; repositório privado | Baixo |
| R02 | Tentativas de adivinhar senhas | Média | Médio | 5 tentativas de login por minuto por IP (429); mensagem genérica; BCrypt | Baixo |
| R03 | Pessoa acessar função de outro perfil | Média | Alto | Autorização na API, com o perfil lido do banco a cada requisição; testes de cada perfil | Baixo |
| R04 | Alguém alterar ou apagar registros de consumo | Baixa | Alto | Triggers que impedem UPDATE e DELETE; usuário `aguas_api` sem DELETE nem TRUNCATE | Baixo |
| R05 | Perda do banco publicado (o Neon grátis pode apagar o banco depois de 90 dias parado) | Média | Alto | Backup com `database/backup.sh`, conferido por restauração num banco temporário; 7 dias guardados | Médio |
| R06 | Senha do sensor exposta no simulador público | Média | Baixo | Perfil `sensor` só consulta processos e registra lotes; senha não fica salva; administrador redefine | Baixo |
| R07 | Interceptação dos dados na rede | Baixa | Médio | HTTPS no site, na API e no sensor, que confere a impressão digital do certificado | Baixo |
| R08 | Publicação com erro derrubar o sistema | Média | Médio | CI obrigatório para publicar; checagem de saúde; rollback no Render (README) | Baixo |
| R09 | Indisponibilidade do Render, do Neon ou da internet na apresentação | Média | Médio | Plano B com Docker no computador, sem internet | Baixo |
| R10 | Token do bot do Telegram vazar | Baixa | Baixo | Token só nas variáveis do Render; `/revoke` no BotFather (docs/tecnico/telegram.md) | Baixo |
| R11 | Sessão roubada ou usada por muito tempo | Baixa | Médio | JWT de 8 horas, sem renovação; desativar a conta corta o acesso na hora | Baixo |
| R12 | Certificado da API mudar e o sensor recusar a conexão | Alta | Baixo | Impressão digital atual vale até 20/12/2026; o comando para atualizar está no sketch | Baixo |
| R13 | Dependência com vulnerabilidade conhecida (CVE) | Alta | Alto | Job `dependencias` do CI com o OSV-Scanner; atualização das versões; exceção só com motivo e prazo | Baixo |

# 3. Controles aplicados

Controles do Anexo A da ISO/IEC 27001 que se aplicam ao projeto:

| Tema do Anexo A | Controle no projeto | Requisito da ERS |
|---|---|---|
| Controle de acesso | Quatro perfis, sem autocadastro, desativação imediata | RF03, RF17, RF18, RNF03 |
| Autenticação | Senha de 8 a 72 bytes com BCrypt; JWT de 8 horas; limite de tentativas | RF01, RF02, RNF01, RNF02, RNF19 |
| Registro de eventos | Auditoria das ações sobre contas, que não pode ser alterada nem apagada | RF27 |
| Criptografia | HTTPS em todo o tráfego publicado; senhas só como hash | RNF06, RNF01 |
| Segurança no desenvolvimento | Pull request, CI com 148 testes, revisão, segredos fora do Git | RNF05, RNF24 |
| Proteção de segredos em execução | No Docker, a API lê as senhas e a chave JWT como arquivos só de leitura (`/run/secrets/aguas`), sem variáveis de ambiente; o CI confere que nenhuma aparece em `docker inspect` nem no processo | RNF05 |
| Separação de ambientes | Desenvolvimento, Docker, CI e publicado separados; testes nunca no banco oficial | RNF15 |
| Backup | `backup.sh` com verificação e `restore.sh` só em banco vazio | RNF21 |
| Monitoramento | Saúde aberta, métricas só para o administrador, nada mais do Actuator exposto | RNF20 |
| Menor privilégio | Usuário `aguas_api` sem DELETE, TRUNCATE nem mudança de esquema; perfil `sensor` restrito | RNF07 |
| Gestão de vulnerabilidades técnicas | Versões atuais (Java 25, Spring Boot 3.5, PostgreSQL 18); CORS sem `*`; job `dependencias` do CI (OSV-Scanner) bloqueia dependência com vulnerabilidade alta ou crítica, e as exceções ficam em `osv-scanner.toml`, com motivo e data de revisão | RNF04, RNF24 |

# 4. Resposta a incidentes

| Incidente | O que fazer na hora | Depois |
|---|---|---|
| Senha de uma pessoa vazou | Administrador redefine a senha em **Usuários** | Conferir a auditoria daquela conta |
| Senha do sensor vazou | Administrador redefine a senha de `sensor.wokwi` | Atualizar `docs/privado/hospedagem.md` |
| Token do Telegram vazou | `/revoke` no BotFather e novo token no Render | Atualizar `docs/privado/hospedagem.md` |
| Chave JWT vazou | Trocar `JWT_SECRET` no Render (todas as sessões caem) | Pedir para todos entrarem de novo |
| Segredo entrou num commit | Trocar o segredo na hora (o histórico do Git guarda o antigo) | Revisar o `.gitignore` |
| Publicação com erro | Rollback no Render (**Events > Rollback**) | Revert do PR na `develop` |

Todo incidente é registrado numa issue do GitHub, **sem colocar o segredo nela**.

# 5. Plano de continuidade

| Situação | Plano | Tempo estimado |
|---|---|---|
| API dormindo (plano grátis) | Abrir o site uns 2 minutos antes de usar | 2 minutos |
| Render, Neon ou internet fora do ar | Plano B: `docker compose up -d --build` no computador (roteiro em docs/guia/roteiro-apresentacao.md) | 5 minutos |
| Publicação com erro | Rollback no Render | Poucos minutos |
| Banco publicado perdido | Criar banco novo no Neon, restaurar o último backup com `restore.sh` e apontar a API para ele | Cerca de 30 minutos |
| Conexão caindo no chão de fábrica | O site guarda os lotes no aparelho e envia quando a conexão volta, sem duplicar | Automático |
| Telegram fora do ar | Lote e alerta continuam gravados; os próximos avisos voltam sozinhos | Automático |

**Rotina de backup:** rodar `bash database/backup.sh` com o `.env.backup` do Neon pelo menos uma vez por semana e
antes de cada apresentação ou mudança de banco. O backup fica em `database/backups/`, fora do Git.
