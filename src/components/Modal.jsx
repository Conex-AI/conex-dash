import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Janela sobre a página: fecha com Esc ou clicando fora.
export default function Modal({ titulo, aoFechar, children, className = '' }) {
  const caixa = useRef(null)
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') aoFechar() }
    document.addEventListener('keydown', esc)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    caixa.current?.focus()
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes }
  }, [aoFechar])
  return createPortal(
    <div className="modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar() }}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={caixa}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
