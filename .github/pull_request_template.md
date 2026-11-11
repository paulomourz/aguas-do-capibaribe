> [!CAUTION]
> **Este PR precisa ir para a `develop`, não para a `main`.**
> Olhe no topo da página: tem que estar escrito `base: develop`. Se estiver `base: main`, troque antes de criar o PR.
> A `main` só recebe versões, em branches `release/...` ou `hotfix/...`.

> [!IMPORTANT]
> **Não faça o merge do seu próprio PR.** Quem revisa e faz o merge é o Paulo. Depois que o CI ficar verde, avise no
> grupo. Se ele pedir ajustes, faça na mesma branch.

## O que muda

<!-- O que mudou e por quê. Troque o N pelo número da issue: "Closes" fecha a issue sozinho no merge. -->

Closes #N

## Como foi testado

<!-- Testes que rodou e o que conferiu na tela, no Wokwi ou no banco. -->

## Antes do merge

- [ ] A base do PR é a `develop`.
- [ ] O CI passou.
- [ ] Se tem migração nova, usei o próximo número livre da `develop`.
