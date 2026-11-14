import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from './ui'
import { assinarLimite, segundosRestantes, type EscopoLimite } from '../services'

/*
 * Contagem regressiva do 429 (RNF19). A API manda o Retry-After; o http.ts guarda o prazo por ação (login ou
 * envio de lotes) e recusa novos disparos até ele acabar. Aqui a tela lê quanto falta, segundo a segundo.
 */

/** Segundos até liberar a ação; 0 = liberada. Atualiza a cada segundo enquanto houver espera. */
export function useEsperaLimite(escopo: EscopoLimite): number {
  const [segundos, setSegundos] = useState(() => segundosRestantes(escopo))

  useEffect(() => {
    const ler = () => setSegundos(segundosRestantes(escopo))
    ler()
    return assinarLimite(ler)
  }, [escopo])

  useEffect(() => {
    if (segundos <= 0) return
    const t = window.setTimeout(() => setSegundos(segundosRestantes(escopo)), 1000)
    return () => window.clearTimeout(t)
  }, [segundos, escopo])

  return segundos
}

export const textoEspera = (s: number) => (s === 1 ? '1 segundo' : `${s} segundos`)

/**
 * Faixa de "aguarde". O número muda todo segundo, mas fica fora da região anunciada: o leitor de tela fala o aviso
 * uma vez, e não a cada segundo.
 */
export function AvisoLimite({ segundos, titulo, children }: { segundos: number; titulo: string; children: ReactNode }) {
  const [inicial] = useState(segundos)
  if (segundos <= 0) return null
  return (
    <div data-testid="aviso-limite">
      <Banner tone="warn" title={titulo}>
        <p>{children}</p>
        <p className="mt-1 font-semibold">
          <span className="sr-only">Aguarde cerca de {textoEspera(inicial)}.</span>
          <span aria-hidden="true">
            Tente de novo em <span className="tabular-nums">{textoEspera(segundos)}</span>.
          </span>
        </p>
      </Banner>
    </div>
  )
}
