/* Conversões do modo simulado: ids de texto do mock viram ids numéricos estáveis. */
const mapa = new Map<string, number>()
const reverso = new Map<number, string>()

export function idNum(s: string): number {
  let n = mapa.get(s)
  if (n === undefined) {
    n = mapa.size + 1
    mapa.set(s, n)
    reverso.set(n, s)
  }
  return n
}
export const idTexto = (n: number) => reverso.get(n) ?? String(n)
export const atraso = <T,>(v: T, ms = 150) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms))
