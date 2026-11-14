# Documentos de gestão do projeto

| Documento | Versão | PDF | Texto |
|---|---|---|---|
| **TAP** — Termo de Abertura do Projeto e backlog de histórias | 3.2, 14/11/2026 | [`TAP.pdf`](TAP.pdf) | [`TAP.md`](TAP.md) |
| **ERS** — Especificação de Requisitos de Software (ISO/IEC/IEEE 29148) | 2.4, 14/11/2026 | [`ERS.pdf`](ERS.pdf) | [`ERS.md`](ERS.md) |
| **Segurança da informação** — política, riscos e continuidade (ISO/IEC 27001) | 1.2, 14/11/2026 | [`seguranca.pdf`](seguranca.pdf) | [`seguranca.md`](seguranca.md) |
| **Ciclo de vida** — processos da concepção ao descarte (ISO/IEC 12207) | 1.0, 09/11/2026 | [`ciclo-de-vida.pdf`](ciclo-de-vida.pdf) | [`ciclo-de-vida.md`](ciclo-de-vida.md) |

### Normas de documentação

| Norma | Documento |
|---|---|
| ISO/IEC/IEEE 29148 — Engenharia de requisitos | [ERS](ERS.md) |
| ISO/IEC/IEEE 42010 — Arquitetura de software | [PDF](../tecnico/arquitetura.pdf) · [`../tecnico/arquitetura.md`](../tecnico/arquitetura.md) |
| ISO/IEC/IEEE 26514 — Documentação do usuário | [Guia](../guia/guia-aguas-do-capibaribe.pdf) |
| ISO/IEC/IEEE 29119 — Testes de software | [PDF](../tecnico/testes.pdf) · [`../tecnico/testes.md`](../tecnico/testes.md) |
| ISO/IEC 12207 — Ciclo de vida do software | [Ciclo de vida](ciclo-de-vida.md) |
| ISO/IEC 27001 — Segurança da informação | [Segurança da informação](seguranca.md) |

O PDF é gerado a partir do `.md`. Para mudar um documento, edite o `.md` e rode, nesta pasta:

```powershell
powershell -ExecutionPolicy Bypass -File .\gerar-pdf.ps1
```

O script gera também os PDFs da arquitetura e dos testes, em `docs/tecnico/`. Precisa do Node.js e do Chrome ou do
Edge. Faça o commit do `.md` e do `.pdf` juntos.

Nada de dados pessoais nem senhas nestes documentos: senhas ficam em `docs/privado/`, fora do Git.
