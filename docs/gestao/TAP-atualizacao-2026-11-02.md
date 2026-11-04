# Atualização do TAP em 02/11/2026

Registra o que mudou desde o [`TAP.pdf`](TAP.pdf) (v2.1, 20/10/2026). O PDF assinado continua como está: este arquivo
não substitui o documento nem conta como aprovação do orientador.

**Pendente:** o parecer técnico de 27/10/2026 cita um TAP v3.0, que não está no repositório. Quando a equipe localizar
esse arquivo ou gerar a nova versão, estas mudanças devem entrar nele.

## O que mudou

| Seção do TAP | Na v2.1 | Em 02/11/2026 |
|---|---|---|
| 4.1 Status por cor | calculado no front-end, com faixas provisórias | calculado pela API, com limites de 0% e 8%; totais e médias continuam no site, com os mesmos limites |
| 4.1 Relatório | PDF pela impressão do navegador | download direto em PDF |
| 4.2 e 6 IoT | túnel temporário em HTTP | projeto público em HTTPS, com endereço fixo; projeto local pelo túnel, para testes |
| 5 Banco | PostgreSQL na máquina de DevOps | banco publicado no Neon; o banco da máquina de DevOps continua separado |
| 5 Implantação | API ainda não publicada | site e API publicados no Render; Docker Compose para rodar no computador |
| 5 Versionamento do banco | script SQL | migrações Flyway, V1 a V4 |
| 5 Usuário do banco | `postgres` | usuário restrito `aguas_api` |
| 5 Qualidade | sem CI | GitHub Actions e 64 testes automatizados, incluindo o ciclo completo |
| 11.1 Pendências | status, PDF e publicação | concluídas; versão 1.0.0 lançada em 02/11/2026 |

## Decisão a formalizar

- **Bancada física (seção 6):** a equipe pretende ficar com a simulação do Wokwi, o que a seção 6 prevê como plano de
  contingência. O parecer pede ata e parecer assinado pelo orientador no repositório (issue #14), e isso ainda não foi feito.

## Novos riscos

| Risco | Mitigação |
|---|---|
| A API do plano grátis dorme sem uso e leva cerca de 2 minutos para acordar | abrir o site antes de apresentar; plano B com Docker |
| O banco do plano grátis pode ser apagado depois de 90 dias parado | usar o banco regularmente; backup (item #25 do parecer) |
| O certificado da API muda (o atual vale até 20/12/2026), e o sensor recusa a conexão | atualizar `IMPRESSAO_DIGITAL` no sketch |
| A senha do sensor fica no projeto público do Wokwi | conta só de operador e senha exclusiva; o gestor redefine se preciso |

## Em aberto

- **SemVer:** o parecer orienta não declarar 1.0.0 antes de concluir a homologação, e a validação com um operador real
  (item #22 do parecer) ainda não foi feita. A versão 1.0.0 precisa ser alinhada com o orientador.
- **Validação com persona (seção 8):** roteiro, questionário SUS e kit prontos em [`../validacao/`](../validacao/LEIA-ME.md);
  falta aplicar com um operador de Toritama e alinhar com o orientador o critério de decisão proposto no roteiro.
- **Data final de entrega (seção 10):** ainda a confirmar.
- **Itens #18 a #27 do parecer:** não implementados; falta definir quais são obrigatórios.
