import { useEffect, useState } from 'react'

// Tema do painel (escuro ou claro). Fica salvo neste navegador.
export function useTema() {
  const [tema, setTema] = useState(() => {
    try { return localStorage.getItem('conex.tema') === 'claro' ? 'claro' : 'escuro' } catch { return 'escuro' }
  })
  useEffect(() => {
    if (tema === 'claro') document.documentElement.dataset.theme = 'claro'
    else delete document.documentElement.dataset.theme
    try { localStorage.setItem('conex.tema', tema) } catch { /* sem armazenamento: vale só nesta visita */ }
  }, [tema])
  return [tema, setTema]
}
