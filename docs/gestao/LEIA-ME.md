# Documentos de gestão do projeto

| Documento | Versão | PDF | Texto |
|---|---|---|---|
| **TAP** — Termo de Abertura do Projeto e backlog de histórias | 3.0, 05/11/2026 | [`TAP.pdf`](TAP.pdf) | [`TAP.md`](TAP.md) |
| **ERS** — Especificação de Requisitos de Software (IEEE 830) | 1.2, 05/11/2026 | [`ERS.pdf`](ERS.pdf) | [`ERS.md`](ERS.md) |

O PDF é gerado a partir do `.md`. Para mudar um documento, edite o `.md` e rode, nesta pasta:

```powershell
powershell -ExecutionPolicy Bypass -File .\gerar-pdf.ps1
```

Precisa do Node.js e do Chrome ou do Edge. Faça o commit do `.md` e do `.pdf` juntos.

Nada de dados pessoais nem senhas nestes documentos: senhas ficam em `docs/privado/`, fora do Git.
