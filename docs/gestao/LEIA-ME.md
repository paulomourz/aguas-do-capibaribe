# Documentos de gestão do projeto

Documentos do projeto que não são código.

| Arquivo | Conteúdo | Situação |
|---|---|---|
| [`TAP.md`](TAP.md) e [`TAP.pdf`](TAP.pdf) | Termo de Abertura do Projeto e backlog de histórias (v3.0, 05/11/2026) | a assinar |
| [`ERS.md`](ERS.md) e [`ERS.pdf`](ERS.pdf) | Especificação de Requisitos de Software, norma IEEE 830 (v1.2, 05/11/2026) | ✅ |
| [`TAP-v2.1.pdf`](TAP-v2.1.pdf) | Versão anterior do TAP (v2.1, 20/10/2026), assinada | histórico |
| [`gerar-pdf.ps1`](gerar-pdf.ps1) | Gera os PDFs a partir dos arquivos `.md` | — |
| `pitch/` | Roteiro e slides do pitch (vídeos: só o link, num arquivo `.md`) | a adicionar |

O guia geral do sistema (como funciona e como rodar) fica em [`../guia/`](../guia/).

## Como atualizar o TAP ou o ERS

1. Edite o `.md`. O comentário `<!-- sumario -->` marca onde entra o sumário no PDF.
2. Gere os PDFs de novo, a partir desta pasta:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\gerar-pdf.ps1
   ```

   Precisa do Node.js e do Chrome ou do Edge. Na primeira vez, o `npx` baixa o conversor de Markdown.
3. Faça o commit do `.md` e do `.pdf` juntos.

## Cuidados

- Nada de dados pessoais (CPF, telefone, endereço) nem senhas. Senhas ficam em `docs/privado/`, que não vai para o Git.
- Arquivos pesados (vídeos, imagens grandes) ficam fora do Git: guarde num drive e coloque o link aqui.
