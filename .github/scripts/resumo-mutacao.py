#!/usr/bin/env python3
"""Resume o relatório do PIT (mutations.xml) em Markdown, para o resumo do GitHub Actions.

Uso: resumo-mutacao.py backend/target/pit-reports/mutations.xml [limite de sobrevivência em %]
Sai com código 1 se a sobrevivência (mutantes vivos + sem cobertura) não ficar abaixo do limite.
"""
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

ROTULOS = {
    "KILLED": "Mortos por teste",
    "TIMED_OUT": "Mortos por tempo esgotado",
    "MEMORY_ERROR": "Mortos por falta de memória",
    "RUN_ERROR": "Mortos por erro na execução",
    "NON_VIABLE": "Inviáveis (não chegam a rodar)",
    "SURVIVED": "Sobreviveram",
    "NO_COVERAGE": "Sem cobertura de teste",
}
VIVOS = ("SURVIVED", "NO_COVERAGE")


def main() -> int:
    caminho = sys.argv[1]
    limite = float(sys.argv[2]) if len(sys.argv) > 2 else 20.0
    mutantes = ET.parse(caminho).getroot().findall("mutation")
    total = len(mutantes)
    if total == 0:
        print("### Teste de mutação (PIT)\n\nNenhum mutante foi gerado.")
        return 1

    por_status = Counter(m.get("status") for m in mutantes)
    vivos = sum(por_status[s] for s in VIVOS)
    sobrevivencia = 100.0 * vivos / total
    passou = sobrevivencia < limite

    print("### Teste de mutação (PIT)\n")
    print(f"**Sobrevivência: {sobrevivencia:.1f}%** ({vivos} de {total} mutantes); "
          f"limite: abaixo de {limite:g}%. {'Atende.' if passou else 'NÃO atende.'}\n")
    print("| Situação | Mutantes |")
    print("|---|---|")
    for status, rotulo in ROTULOS.items():
        if por_status[status]:
            print(f"| {rotulo} | {por_status[status]} |")
    for status in sorted(set(por_status) - set(ROTULOS)):
        print(f"| {status} | {por_status[status]} |")

    por_classe = defaultdict(lambda: [0, 0])
    for m in mutantes:
        classe = m.findtext("mutatedClass", "?").replace("br.com.aguas.", "")
        por_classe[classe][0] += 1
        por_classe[classe][1] += m.get("status") in VIVOS
    print("\n| Classe | Mutantes | Vivos | Sobrevivência |")
    print("|---|---|---|---|")
    for classe, (n, v) in sorted(por_classe.items(), key=lambda c: (-c[1][1], c[0])):
        print(f"| `{classe}` | {n} | {v} | {100.0 * v / n:.0f}% |")

    if vivos:
        print("\n<details><summary>Mutantes vivos, um por linha</summary>\n")
        print("```")
        linhas = sorted(
            (m.findtext("mutatedClass", "?").replace("br.com.aguas.", ""), int(m.findtext("lineNumber", "0")),
             m.findtext("mutatedMethod", "?"), m.get("status"), m.findtext("description", "?"))
            for m in mutantes if m.get("status") in VIVOS)
        for classe, linha, metodo, status, descricao in linhas:
            print(f"{classe}:{linha} {metodo} [{status}] {descricao}")
        print("```\n</details>")
    return 0 if passou else 1


if __name__ == "__main__":
    sys.exit(main())
