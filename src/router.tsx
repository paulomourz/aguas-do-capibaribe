import { useEffect, useState, type AnchorHTMLAttributes } from 'react'

function ler() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, qs = ''] = raw.split('?')
  return { path: path.replace(/\/+$/, '') || '/', query: new URLSearchParams(qs) }
}

export function useRoute() {
  const [r, setR] = useState(ler)
  useEffect(() => {
    const on = () => {
      setR(ler())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

export function navigate(to: string, opts?: { replace?: boolean }) {
  const url = '#' + to
  if (opts?.replace) {
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = to
  }
}

export function Link({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a href={'#' + to} {...rest} />
}
