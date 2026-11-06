import { useEffect, useId, useRef, useState } from 'react'
import { IconInfo } from './icons'
import { cx } from './ui'
import { REFERENCIA_POR_PECA, termoDe } from '../domain/glossario'

/**
 * Dica do glossário têxtil (issue #55) ao lado do nome de um processo.
 * Botão que abre e fecha com clique, Enter ou Espaço; Esc fecha e devolve o foco ao botão.
 * Também abre ao passar o mouse. Não aparece se o processo não estiver no glossário.
 */
export default function DicaGlossario({ processo, className }: { processo: string; className?: string }) {
  const termo = termoDe(processo)
  const [aberta, setAberta] = useState(false)
  const [fixa, setFixa] = useState(false)
  const id = useId()
  const raiz = useRef<HTMLSpanElement>(null)
  const botao = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberta) return
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) {
        setAberta(false)
        setFixa(false)
      }
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setAberta(false)
        setFixa(false)
        botao.current?.focus()
      }
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla, true)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla, true)
    }
  }, [aberta])

  if (!termo) return null

  return (
    <span
      ref={raiz}
      className={cx('relative inline-flex align-middle', className)}
      onMouseEnter={() => setAberta(true)}
      onMouseLeave={() => !fixa && setAberta(false)}
    >
      <button
        ref={botao}
        type="button"
        aria-label={`O que é ${termo.nome}?`}
        aria-expanded={aberta}
        aria-controls={id}
        onClick={() => {
          // Aberta só pelo mouse: o clique a fixa. Já fixa: o clique fecha.
          const abrir = !(aberta && fixa)
          setAberta(abrir)
          setFixa(abrir)
        }}
        className="grid h-8 w-8 place-items-center rounded-full text-link transition-colors hover:bg-brand-soft"
      >
        <IconInfo size={18} />
      </button>
      <span
        id={id}
        role="note"
        hidden={!aberta}
        className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[80vw] rounded-lg border border-line bg-surface p-4 text-left text-[13px] font-normal leading-snug text-ink-2 shadow-lg"
      >
        <strong className="block text-[15px] font-semibold text-ink">{termo.nome}</strong>
        <span className="mt-1 block">{termo.definicao}</span>
        <span className="mt-2 block">
          <span className="font-semibold text-ink">Água: </span>
          {termo.agua}
        </span>
        <span className="mt-2 block">
          <span className="font-semibold text-ink">Referência: </span>a lavanderia completa de uma peça de jeans usa de {REFERENCIA_POR_PECA.min} a{' '}
          {REFERENCIA_POR_PECA.max} litros, somando todas as etapas.
        </span>
      </span>
    </span>
  )
}
