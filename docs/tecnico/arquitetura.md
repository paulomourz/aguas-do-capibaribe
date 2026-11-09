# Descrição da arquitetura

Descrição da arquitetura do Águas do Capibaribe, organizada conforme a norma **ISO/IEC/IEEE 42010** (descrição de
arquitetura de sistemas e software). A norma pede que se identifiquem as partes interessadas e as preocupações delas,
os pontos de vista usados e as visões do sistema, com as decisões e a justificativa de cada uma.

| Campo | Descrição |
|---|---|
| Sistema | Águas do Capibaribe — gestão de consumo de água por lote em lavanderias de jeans |
| Versão | 1.0, 9 de novembro de 2026 (branch `develop`) |
| Requisitos | [ERS v2.0](../gestao/ERS.md) (ISO/IEC/IEEE 29148) |
| Responsáveis | Equipe Águas do Capibaribe |

## 1. Partes interessadas e preocupações

| Parte interessada | Preocupações com a arquitetura | Visão que responde |
|---|---|---|
| Operador de máquina | O registro precisa funcionar no celular e com a conexão oscilando. | Lógica (fila no aparelho), implantação |
| Gestor da lavanderia | Os números precisam estar certos e não podem ser alterados depois. | Dados, lógica (regras na API e no banco) |
| Administrador do sistema | Só quem tem permissão acessa cada função; as ações sobre contas ficam registradas. | Lógica (segurança), dados (auditoria) |
| Equipe de desenvolvimento | Código fácil de entender, testar e mudar sem quebrar o resto. | Lógica (camadas), desenvolvimento |
| DevOps | Publicar só código testado, com segredos fora do Git e um plano B sem internet. | Implantação |
| Orientador e banca | Clareza das decisões e ligação com os requisitos. | Todas; seção 7 |

## 2. Pontos de vista

| Ponto de vista | Pergunta que responde | Notação |
|---|---|---|
| Contexto | Com quem o sistema conversa? | Diagrama de blocos em texto e tabela |
| Lógico | Quais são as partes do software e o que cada uma faz? | Camadas e pacotes |
| Dados | O que é guardado, com quais regras? | Tabelas, triggers e migrações |
| Implantação | Onde cada parte roda? | Tabela de ambientes e serviços |
| Desenvolvimento | Como o código vira sistema publicado? | Fluxo de branches e CI/CD |

## 3. Visão de contexto

```
  Operador / Gestor / Administrador          Sensor (ESP32 no Wokwi)
          │  navegador (PWA)                        │  HTTPS + JSON
          ▼                                         ▼
     ┌─────────────┐   HTTPS + JSON   ┌──────────────────────────┐   SQL    ┌──────────────┐
     │  Site React │ ───────────────▶ │ API REST (Spring Boot)    │ ───────▶ │ PostgreSQL 18│
     └─────────────┘                  └──────────────────────────┘          └──────────────┘
                                                   │ HTTPS (opcional)
                                                   ▼
                                          Bot API do Telegram
```

Regras do contexto:

- O site e o sensor são **clientes iguais** da mesma API. Nenhum deles fala com o banco.
- Só a API fala com o banco, com um usuário restrito (`aguas_api`).
- O Telegram é opcional: se faltar ou falhar, o resto funciona igual.

## 4. Visão lógica

### 4.1 Front-end (pasta `src/`)

| Parte | Responsabilidade |
|---|---|
| `screens/` | Uma tela por função: Acesso, Dashboard, Alertas, Relatórios, Registro de lote, Histórico, Processos, Usuários, Auditoria e Configurações. |
| `components/` | Peças reutilizáveis: interface base, gráficos, fila offline, seletor de tema e dica do glossário. |
| `services/` | Comunicação com a API (`http.ts` e um arquivo por recurso), fila de lotes no IndexedDB (`filaOffline.ts`), sincronização, exportação em CSV, PDF e tema. |
| `domain/` | Tipos, regras de apresentação (faixas de status), formatação, gráficos e glossário. |
| `store.tsx`, `router.tsx` | Estado da sessão e navegação entre telas. |

O service worker (PWA) guarda o site para abrir sem conexão. Os lotes registrados sem conexão ficam na fila do
aparelho e são enviados com a mesma chave de envio (`Idempotency-Key`) até a API confirmar.

### 4.2 Back-end (pasta `backend/`, pacote `br.com.aguas`)

| Camada / pacote | Responsabilidade |
|---|---|
| `controller` | Recebe as requisições HTTP e devolve JSON: autenticação, usuários, processos, lotes, alertas, relatórios e auditoria. |
| `service` | Regras de negócio: cálculo do desvio, regra de alerta (`RegraDeAlerta`), relatórios, usuários e auditoria. |
| `repository` | Acesso ao banco com Spring Data JPA. |
| `entity`, `dto` | Modelo de dados e formatos de entrada e saída da API. |
| `security` | JWT, perfis, limite de requisições (`FiltroDeLimite`, `Limitador`) e respostas 401/403 no formato da API. |
| `notificacao` | Aviso de alerta no Telegram, enviado depois do commit e em outra thread. |
| `exception` | Formato único de erro `{codigo, mensagem, campos}`. |
| `config` | Segurança, cache, documentação (Swagger) e criação das contas iniciais. |

A dependência segue sempre o mesmo sentido: `controller → service → repository → banco`.

## 5. Visão de dados

| Elemento | Regra |
|---|---|
| `usuario`, `processo`, `lote`, `alerta`, `alerta_lote`, `auditoria_usuario` | Tabelas principais (detalhe na ERS, seção 3.5). |
| `trg_lote_esperado` | O banco calcula o esperado de cada lote pela meta do momento. |
| `trg_lote_imutavel`, `trg_auditoria_imutavel` | Lote e auditoria não podem ser alterados nem apagados, nem pela API. |
| `v_historico_lotes`, `v_alertas` | Visões que entregam o desvio já calculado. |
| Migrações Flyway V1 a V8 | O esquema muda só por migração nova, aplicada pelo dono do banco. A API só confere o esquema ao iniciar. |
| Usuário `aguas_api` | Lê e grava, mas não pode apagar dados nem mudar o esquema. |

## 6. Visão de implantação

| Ambiente | Site | API | Banco | Uso |
|---|---|---|---|---|
| Publicado | Render (site estático, HTTPS) | Render (contêiner Docker, HTTPS, checagem em `/api/actuator/health`) | Neon (PostgreSQL 18) | Uso real e apresentação (plano A) |
| Local com Docker | contêiner `frontend` (Nginx, porta 3000) | contêiner `backend` | contêiner `db` | Plano B sem internet e testes |
| Desenvolvimento | Vite na porta 8443 | Spring Boot na porta 8080 | PostgreSQL local | Programar |
| CI | build e testes no GitHub Actions | testes com PostgreSQL em contêiner | contêiner temporário | Conferir cada pull request |

No Docker, o serviço `segredos` gera as senhas na primeira subida, e o serviço `tunel` (perfil `tunel`) liga o
Wokwi à API local por um túnel temporário.

## 7. Visão de desenvolvimento

1. Cada mudança nasce numa branch `feature/`, `fix/` ou `docs/` a partir da `develop`.
2. O pull request para a `develop` roda o CI: testes do back-end, build e testes do site e teste do Docker.
3. Com o CI verde e o merge feito, o Render publica sozinho (Auto-Deploy "After CI Checks Pass").
4. Versões vão para a `main` por uma branch `release/`, com tag.

Detalhes dos processos em [ciclo de vida](../gestao/ciclo-de-vida.md) (ISO/IEC 12207).

## 8. Decisões de arquitetura e justificativa

| Decisão | Justificativa |
|---|---|
| API REST única para site e sensor | O sensor reaproveita as mesmas regras e validações; trocar o simulador por um dispositivo físico não muda a API. |
| Regras de integridade também no banco (triggers) | Os dados continuam corretos mesmo com erro na API ou acesso direto ao banco. |
| JWT sem sessão no servidor, com o perfil lido do banco a cada requisição | A API fica sem estado, e desativar alguém corta o acesso na hora. |
| Fila no aparelho com chave de envio | O operador registra sem conexão, e o reenvio nunca duplica o lote. |
| Aviso no Telegram depois do commit, em outra thread | O registro do lote não espera nem depende do Telegram. |
| Render e Neon nos planos grátis, com Docker como plano B | Custo zero; o Docker cobre a falta de internet ou a API dormindo. |

## 9. Correspondência com os requisitos

| Visão | Requisitos da ERS |
|---|---|
| Contexto e lógica | RF01 a RF31, RNF03, RNF08 |
| Dados | RF09, RF10, RF27, RNF07, RNF09, RNF10, RNF22 |
| Implantação | RNF06, RNF11, RNF14, RNF20, RNF21 |
| Desenvolvimento | RNF15, RNF16, RNF24 |
