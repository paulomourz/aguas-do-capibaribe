# Documentação

| Pasta | Para quem | Conteúdo |
|---|---|---|
| [`guia/`](guia/) | toda a equipe, banca e quem vai usar | **Guia do Águas do Capibaribe** em PDF (ISO/IEC/IEEE 26514): como o sistema funciona e como rodar. [Roteiro de apresentação](guia/roteiro-apresentacao.md), com o plano A (site publicado) e o plano B (Docker) |
| [`tecnico/`](tecnico/) | quem desenvolve | [arquitetura](tecnico/arquitetura.md) (ISO/IEC/IEEE 42010), [testes](tecnico/testes.md) (ISO/IEC/IEEE 29119), [aviso no Telegram](tecnico/telegram.md), [teste de carga](tecnico/teste-carga.md), [índices do banco](tecnico/desempenho-indices.md), [endpoints da API](tecnico/api.md) (com a API no ar, também no Swagger: `/api/swagger-ui.html`), [banco de dados e servidor](tecnico/banco-remoto.md), [runbook de recuperação de desastres](tecnico/runbook-disaster-recovery.md) e [bancada física com sensor](tecnico/hardware-bancada.md) |
| [`gestao/`](gestao/LEIA-ME.md) | equipe e orientador | termo de abertura (TAP v3.1), especificação de requisitos (ERS v2.0, ISO/IEC/IEEE 29148), segurança da informação (ISO/IEC 27001) e ciclo de vida (ISO/IEC 12207), em PDF e Markdown. Tabela das normas no [LEIA-ME](gestao/LEIA-ME.md) |
| [`validacao/`](validacao/LEIA-ME.md) | equipe e orientador | roteiro do teste de usabilidade com operador, questionário SUS, kit para imprimir e resultados |
| `assets/` | READMEs | imagens usadas na documentação |
| `privado/` | só a equipe | acessos e senhas; **fica fora do Git** |

Os guias de cada parte do código ficam junto dela: [`../backend/README.md`](../backend/README.md)
(API), [`../database/LEIA-ME.md`](../database/LEIA-ME.md) (banco) e [`../iot/LEIA-ME.md`](../iot/LEIA-ME.md)
(sensor simulado).
