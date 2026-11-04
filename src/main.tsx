import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA: guarda a casca do site para abrir sem conexão (só no build; no `vite dev` fica desligado).
// Sem chamar updateSW: uma versão nova assume quando todas as abas forem fechadas, nunca no meio de um registro.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}
