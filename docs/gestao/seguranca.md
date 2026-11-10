<p align="center"><img src="../assets/logo-referencia.png" width="120" alt="Logo do Águas do Capibaribe"></p>

# Águas do Capibaribe — Segurança da Informação

Política de segurança, análise de riscos e plano de continuidade do Águas do Capibaribe, organizados conforme a
norma **ISO/IEC 27001** (sistema de gestão de segurança da informação). O documento segue a estrutura que a norma
pede, adaptada ao porte de um projeto acadêmico, sem certificação formal.

| Campo | Descrição |
|---|---|
| Versão | 1.1, 10 de novembro de 2026 (aviso de privacidade e LGPD, seção 6) |
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
| R14 | Exposição de dados pessoais além do necessário (LGPD) | Média | Médio | Aviso de privacidade no login; login de outras pessoas mascarado na API; CSV e PDF só com o nome (seção 6) | Baixo |

# 3. Controles aplicados

Controles do Anexo A da ISO/IEC 27001 que se aplicam ao projeto:

| Tema do Anexo A | Controle no projeto | Requisito da ERS |
|---|---|---|
| Controle de acesso | Quatro perfis, sem autocadastro, desativação imediata | RF03, RF17, RF18, RNF03 |
| Autenticação | Senha de 8 a 72 bytes com BCrypt; JWT de 8 horas; limite de tentativas | RF01, RF02, RNF01, RNF02, RNF19 |
| Registro de eventos | Auditoria das ações sobre contas, que não pode ser alterada nem apagada | RF27 |
| Privacidade e proteção de dados pessoais (5.34) | Aviso de privacidade aberto a todos na tela de login; login de outras pessoas mascarado na API (ex.: `ca****in`); CSV e PDF sem login, senha nem perfil (seção 6) | RNF27 |
| Criptografia | HTTPS em todo o tráfego publicado; senhas só como hash | RNF06, RNF01 |
| Segurança no desenvolvimento | Pull request, CI com 148 testes, revisão, segredos fora do Git | RNF05, RNF24 |
| Imagem mínima do contêiner | API em imagem distroless (sem shell, sem gerenciador de pacotes, usuário não root), presa por digest; o CI falha se a imagem tiver shell | RNF05, RNF24 |
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

# 6. Privacidade e proteção de dados pessoais (LGPD)

O sistema trata dados pessoais de quem o usa: nome, login e a autoria de cada lote e de cada ação nas contas. Esta
seção adequa o projeto à **Lei Geral de Proteção de Dados** (Lei nº 13.709/2018) no que cabe a ele (issue #117,
requisito RNF27 da ERS).

## 6.1 Papéis

| Papel na LGPD | Quem é |
|---|---|
| Controladora | A lavanderia que usa o sistema. O administrador da lavanderia responde por ela no sistema. |
| Operadora | A equipe do Águas do Capibaribe, que mantém o sistema e trata os dados só para fazê-lo funcionar. |
| Titulares | Operadores, gestores e administradores com conta no sistema. |
| Suboperadores | Render (site e API) e Neon (banco de dados), com servidores que podem ficar fora do Brasil. |

## 6.2 Aviso de privacidade

O aviso fica na tela **Aviso de privacidade** (`/#/privacidade`), aberta pelo link da tela de login, sem precisar
entrar, e pelo rodapé de todas as telas. O texto da tela vem de `src/domain/privacidade.ts`; ao mudar o aviso,
mudar nos dois lugares.

| Dado | Para quê (base legal, art. 7º) | Por quanto tempo | Quem vê |
|---|---|---|---|
| Nome | Identificar quem registrou cada lote e quem fez cada ação nas contas, para comprovar o consumo de água a clientes e órgãos ambientais (II e IX) | Enquanto a lavanderia usar o sistema; a conta é desativada, nunca apagada, para os lotes e a auditoria continuarem mostrando quem fez | A pessoa, o administrador e os gestores; no histórico, no CSV, na auditoria e, para quem emitiu, no PDF |
| Usuário (login) | Entrar no sistema (V) | O mesmo do nome | Inteiro, só a pessoa e o administrador; para os outros, mascarado (`ca****in`) |
| Senha | Confirmar a identidade no login (V) | Até ser trocada | Ninguém: só o hash BCrypt é guardado |
| Perfil, situação da conta e data de criação | Definir o que cada pessoa pode fazer (V e IX) | O mesmo do nome | Perfil e situação: a pessoa, o administrador e os gestores; a data de criação não aparece nas telas |
| Lotes registrados (data, hora e autoria) | Medir e comprovar o consumo de água (II e IX) | Permanente; o banco impede alterar ou apagar | A pessoa, os gestores e o administrador; o operador vê só os próprios |
| Auditoria das contas | Segurança das contas (IX) | Permanente; o banco impede alterar ou apagar | Só o administrador |
| Endereço IP | Limitar as tentativas de login (IX) | Só na memória da API, sem ir para o banco nem para os logs; some quando a API reinicia (ou quando passa de 10.000 endereços, os parados há mais de 1 minuto saem) | Ninguém consulta; o Render pode registrar o endereço nos logs de acesso dele, pelo prazo que ele define |
| Dados no aparelho | Manter a sessão e registrar lotes sem conexão | Sessão de até 8 horas, apagada ao fechar a aba; o resto é apagado ao sair, menos os lotes ainda não enviados | Só quem usa o aparelho |

**Com quem falar:** o administrador da lavanderia. Ele resolve o que for da conta (cópia dos dados, correção,
desativação) e leva à equipe o que depender do sistema. A própria pessoa vê o nome, o usuário e o perfil em
**Configurações da conta** e corrige o nome por lá.

**Limite do direito de eliminação:** lotes e registros de auditoria não são apagados, mesmo a pedido, porque a
lavanderia precisa guardá-los para comprovar o consumo de água (art. 16, I, da LGPD). A conta é desativada.

## 6.3 Minimização: o login de outras pessoas

O login só é necessário para quem entra com ele e para o administrador, que cria e cuida das contas. Nos outros
lugares, a API o envia mascarado (`Privacidade.mascararLogin`): no máximo metade dos caracteres e sempre quatro
asteriscos, para não revelar o tamanho. O nome continua inteiro, porque é ele que identifica quem fez.

| Onde | Antes | Agora |
|---|---|---|
| Auditoria (`GET /auditoria`), "Feita por" e "Usuário afetado" | Nome e login inteiro | Nome e login mascarado (`ca****in`) |
| Lista de usuários (`GET /usuarios`) pedida pelo gestor, usada só para mostrar quem registrou cada lote | Login inteiro de todos | Login dos outros mascarado; o próprio, inteiro |
| Lista de usuários pedida pelo administrador (tela Usuários) | Login inteiro | Login inteiro (necessário para cuidar das contas) |
| Configurações da conta (o próprio login) | Login inteiro | Login inteiro |

Regra: login com até 4 caracteres mostra o primeiro (`ana` → `a****`); de 5 a 7, o primeiro e o último
(`maria` → `m****a`); com 8 ou mais, os dois primeiros e os dois últimos (`carlos.martin` → `ca****in`).

## 6.4 Arquivos exportados

Conferido em 10/11/2026 que os arquivos levam só o necessário:

| Arquivo | Dados pessoais | Por que são necessários |
|---|---|---|
| Histórico em CSV (RF29) | Só o **nome** de quem registrou cada lote ("Registrado por"). Sem login, perfil ou id de usuário. | A auditoria fiscal e ambiental precisa saber quem registrou cada lote (RF08). |
| Relatório mensal em PDF (RF15) | Só o **nome** de quem emitiu ("Emitido por", assinatura e autor do arquivo). Os totais são por processo, sem nenhum operador. | O relatório é assinado pelo responsável técnico. |
| Aviso no Telegram (RF30) | Nenhum: só o processo e o número dos lotes e do alerta. | — |

Quem baixa um arquivo passa a responder por ele: não deve publicá-lo nem enviá-lo para fora da lavanderia sem
necessidade.
