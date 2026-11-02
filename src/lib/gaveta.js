import { useCallback, useEffect, useRef, useState } from 'react'

// Menu lateral do celular ("gaveta").
// Abre pelo botão de menu ou arrastando a partir da borda esquerda ou direita da tela;
// a gaveta sai do lado de onde foi puxada e acompanha o dedo. Fecha arrastando de volta,
// tocando fora, com Esc ou ao escolher uma tela.
const BORDA = 28        // px a partir da borda que contam como "puxar o menu"
const LARGURA = () => Math.min(320, window.innerWidth * 0.84)

export function useGaveta(consulta = '(max-width: 860px)') {
  const [movel, setMovel] = useState(() => window.matchMedia(consulta).matches)
  const [aberto, setAberto] = useState(false)
  const [lado, setLado] = useState('esq')
  const [arraste, setArraste] = useState(null) // deslocamento em px enquanto o dedo arrasta
  const toque = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia(consulta)
    const mudou = () => { setMovel(mq.matches); if (!mq.matches) setAberto(false) }
    mq.addEventListener('change', mudou)
    return () => mq.removeEventListener('change', mudou)
  }, [consulta])

  const abrir = useCallback((l = 'esq') => { setLado(l); setAberto(true) }, [])
  const fechar = useCallback(() => setAberto(false), [])

  // trava a rolagem da página com o menu aberto; Esc fecha
  useEffect(() => {
    if (!movel || !aberto) return
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('keydown', esc)
    return () => { document.body.style.overflow = antes; document.removeEventListener('keydown', esc) }
  }, [movel, aberto])

  useEffect(() => {
    if (!movel) return
    function inicio(e) {
      const t = e.touches[0]
      const W = LARGURA()
      if (!aberto) {
        if (t.clientX <= BORDA) toque.current = { modo: 'abrir', lado: 'esq', x: t.clientX, y: t.clientY, W }
        else if (t.clientX >= window.innerWidth - BORDA) toque.current = { modo: 'abrir', lado: 'dir', x: t.clientX, y: t.clientY, W }
        else toque.current = null
      } else {
        toque.current = { modo: 'fechar', lado, x: t.clientX, y: t.clientY, W }
      }
      if (toque.current) toque.current.t0 = Date.now()
    }
    function mover(e) {
      const s = toque.current
      if (!s) return
      const t = e.touches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (!s.decidido) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        if (Math.abs(dy) > Math.abs(dx)) { toque.current = null; return } // é rolagem vertical
        s.decidido = true
        if (s.modo === 'abrir') setLado(s.lado)
      }
      s.dx = dx
      const W = s.W
      const lim = (v, a, b) => Math.max(a, Math.min(b, v))
      let pos
      if (s.modo === 'abrir') pos = s.lado === 'esq' ? lim(dx, 0, W) - W : W - lim(-dx, 0, W)
      else pos = s.lado === 'esq' ? lim(dx, -W, 0) : lim(dx, 0, W)
      setArraste(pos)
    }
    function fim() {
      const s = toque.current
      toque.current = null
      if (!s || !s.decidido) return
      const W = s.W
      const dx = s.dx || 0
      const rapido = Math.abs(dx) / Math.max(1, Date.now() - s.t0) > 0.5 // gesto rápido também vale
      const andou = Math.abs(dx) > W / 3 || rapido
      const paraFora = s.lado === 'esq' ? dx > 0 : dx < 0
      if (s.modo === 'abrir') setAberto(andou && paraFora)
      else setAberto(!(andou && !paraFora))
      setArraste(null)
    }
    window.addEventListener('touchstart', inicio, { passive: true })
    window.addEventListener('touchmove', mover, { passive: true })
    window.addEventListener('touchend', fim)
    window.addEventListener('touchcancel', fim)
    return () => {
      window.removeEventListener('touchstart', inicio)
      window.removeEventListener('touchmove', mover)
      window.removeEventListener('touchend', fim)
      window.removeEventListener('touchcancel', fim)
    }
  }, [movel, aberto, lado])

  // estilos enquanto arrasta (a gaveta segue o dedo e o fundo escurece junto)
  const W = typeof window !== 'undefined' ? LARGURA() : 320
  const estiloGaveta = arraste !== null ? { transform: `translateX(${arraste}px)`, transition: 'none' } : undefined
  const estiloVeu = arraste !== null ? { opacity: 1 - Math.abs(arraste) / W, transition: 'none', pointerEvents: 'auto' } : undefined

  return { movel, aberto, lado, abrir, fechar, arrastando: arraste !== null, estiloGaveta, estiloVeu }
}
