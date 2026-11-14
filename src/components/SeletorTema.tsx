import { useState, useSyncExternalStore } from 'react'
import { IconMonitor, IconMoon, IconSun } from './icons'
import { cx } from './ui'
import { assinarTema, definirPreferencia, preferenciaAtual, proximaPreferencia, rotuloTema, type PreferenciaTema } from '../services/tema'

const icones: Record<PreferenciaTema, typeof IconSun> = { automatico: IconMonitor, claro: IconSun, escuro: IconMoon }

/** Botão que alterna entre automático (segue o sistema), claro e escuro. Mostra o ícone da opção que está valendo. */
export default function SeletorTema({ sobreFundoEscuro = false }: { sobreFundoEscuro?: boolean }) {
  const atual = useSyncExternalStore(assinarTema, preferenciaAtual)
  const [aviso, setAviso] = useState('')
  const proxima = proximaPreferencia(atual)
  const Icone = icones[atual]
  const descricao = `Tema ${rotuloTema[atual]}. Mudar para ${rotuloTema[proxima]}.`

  return (
    <>
      <button
        type="button"
        title={descricao}
        aria-label={descricao}
        onClick={() => {
          definirPreferencia(proxima)
          setAviso(`Tema ${rotuloTema[proxima]} ativado.`)
        }}
        className={cx(
          'grid h-11 w-11 shrink-0 place-items-center rounded-lg transition-colors',
          sobreFundoEscuro ? 'text-on-dark hover:bg-brand-hover hover:text-white' : 'text-ink-2 hover:bg-brand-soft hover:text-brand',
        )}
      >
        <Icone size={20} />
      </button>
      <span role="status" className="sr-only">
        {aviso}
      </span>
    </>
  )
}
