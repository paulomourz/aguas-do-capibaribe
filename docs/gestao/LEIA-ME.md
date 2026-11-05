# Documentos de gestão do projeto

| Documento | Para ler | Para editar |
|---|---|---|
| **TAP** — Termo de Abertura do Projeto e backlog de histórias (v3.0, 05/11/2026) | [`TAP.pdf`](TAP.pdf) | [`fonte/TAP.md`](fonte/TAP.md) |
| **ERS** — Especificação de Requisitos de Software, norma IEEE 830 (v1.2, 05/11/2026) | [`ERS.pdf`](ERS.pdf) | [`fonte/ERS.md`](fonte/ERS.md) |

```
gestao/
├── TAP.pdf, ERS.pdf    versões atuais, para ler e entregar
├── fonte/              o texto em Markdown e o gerador dos PDFs
└── historico/          versões anteriores (TAP v2.1, assinada)
```

O guia geral do sistema (como funciona e como rodar) fica em [`../guia/`](../guia/).

## Como atualizar o TAP ou o ERS

1. Edite o `.md` em `fonte/`. O comentário `<!-- sumario -->` marca onde entra o sumário no PDF.
2. Gere os PDFs de novo, a partir da pasta `fonte/`:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\gerar-pdf.ps1
   ```

   Precisa do Node.js e do Chrome ou do Edge. Na primeira vez, o `npx` baixa o conversor de Markdown.
3. Faça o commit do `.md` e do `.pdf` juntos.

## Cuidados

- Nada de dados pessoais (CPF, telefone, endereço) nem senhas. Senhas ficam em `docs/privado/`, que não vai para o Git.
- Arquivos pesados (vídeos, imagens grandes) ficam fora do Git: guarde num drive e coloque o link aqui.
