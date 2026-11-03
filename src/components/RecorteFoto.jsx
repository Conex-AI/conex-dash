import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'

// Editor de enquadramento: arrastar para posicionar, zoom pelo controle, rodinha do mouse ou pinça.
// Devolve um Blob quadrado (512x512, webp) com exatamente o que aparece no quadro.
const QUADRO = 280
const SAIDA = 512
const ZOOM_MAX = 5

export default function RecorteFoto({ fonte, aoConfirmar, aoCancelar, redondo = false }) {
  const [img, setImg] = useState(null)       // { el, w, h }
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // deslocamento do centro, em px do quadro
  const [erro, setErro] = useState('')
  const toque = useRef(null)

  useEffect(() => {
    let url = null
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => setImg({ el, w: el.naturalWidth, h: el.naturalHeight })
    el.onerror = () => setErro('Não foi possível abrir essa imagem. Tente outro arquivo.')
    if (typeof fonte === 'string') el.src = fonte + (fonte.includes('?') ? '&' : '?') + 'v=' + Date.now()
    else { url = URL.createObjectURL(fonte); el.src = url }
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [fonte])

  const base = img ? Math.max(QUADRO / img.w, QUADRO / img.h) : 1 // cobre o quadro em zoom 1
  const escala = base * zoom
  const largura = img ? img.w * escala : 0
  const altura = img ? img.h * escala : 0

  // não deixa aparecer espaço vazio dentro do quadro
  function limitar(p, l = largura, a = altura) {
    const mx = Math.max(0, (l - QUADRO) / 2)
    const my = Math.max(0, (a - QUADRO) / 2)
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) }
  }
  function mudarZoom(z) {
    const nz = Math.min(ZOOM_MAX, Math.max(1, z))
    const f = nz / zoom
    setZoom(nz)
    setPos((p) => limitar({ x: p.x * f, y: p.y * f }, img.w * base * nz, img.h * base * nz))
  }

  function inicio(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const t = toque.current || { pontos: new Map() }
    t.pontos.set(e.pointerId, { x: e.clientX, y: e.clientY })
    t.ultimo = { x: e.clientX, y: e.clientY, pos }
    if (t.pontos.size === 2) {
      const [a, b] = [...t.pontos.values()]
      t.dist = Math.hypot(a.x - b.x, a.y - b.y); t.zoom0 = zoom
    }
    toque.current = t
  }
  function mover(e) {
    const t = toque.current
    if (!t || !t.pontos.has(e.pointerId)) return
    t.pontos.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (t.pontos.size === 2 && t.dist) {
      const [a, b] = [...t.pontos.values()]
      mudarZoom(t.zoom0 * (Math.hypot(a.x - b.x, a.y - b.y) / t.dist))
      return
    }
    setPos(limitar({ x: t.ultimo.pos.x + (e.clientX - t.ultimo.x), y: t.ultimo.pos.y + (e.clientY - t.ultimo.y) }))
  }
  function fim(e) {
    const t = toque.current
    if (!t) return
    t.pontos.delete(e.pointerId)
    if (t.pontos.size === 1) { const [p] = [...t.pontos.values()]; t.ultimo = { x: p.x, y: p.y, pos }; t.dist = null }
    if (t.pontos.size === 0) toque.current = null
  }
  function teclado(e) {
    const passo = e.shiftKey ? 20 : 6
    const mapa = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] }
    if (mapa[e.key]) { e.preventDefault(); setPos((p) => limitar({ x: p.x + mapa[e.key][0], y: p.y + mapa[e.key][1] })) }
    if (e.key === '+' || e.key === '=') mudarZoom(zoom + 0.1)
    if (e.key === '-') mudarZoom(zoom - 0.1)
  }

  async function confirmar() {
    const k = SAIDA / QUADRO
    const c = document.createElement('canvas')
    c.width = SAIDA; c.height = SAIDA
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    const x = (QUADRO - largura) / 2 + pos.x
    const y = (QUADRO - altura) / 2 + pos.y
    ctx.drawImage(img.el, x * k, y * k, largura * k, altura * k)
    try {
      const blob = await new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('vazio'))), 'image/webp', 0.9))
      aoConfirmar(blob)
    } catch {
      setErro('Não foi possível preparar a imagem. Tente outro arquivo.')
    }
  }

  return (
    <Modal titulo="Ajustar foto" aoFechar={aoCancelar} className="modal-recorte">
      <h2>Ajustar foto</h2>
      <p className="conv-sub">Arraste para posicionar e use o zoom para enquadrar.</p>
      {erro && <div className="erro">{erro}</div>}
      <div className={`recorte-quadro ${redondo ? 'redondo' : ''}`} style={{ width: QUADRO, height: QUADRO }}
        onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim}
        onWheel={(e) => mudarZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        tabIndex={0} onKeyDown={teclado} role="application" aria-label="Área de enquadramento: setas movem, + e - fazem zoom">
        {img && (
          <img src={img.el.src} alt="" draggable={false}
            style={{ width: largura, height: altura, transform: `translate(${(QUADRO - largura) / 2 + pos.x}px, ${(QUADRO - altura) / 2 + pos.y}px)` }} />
        )}
        <span className="recorte-grade" aria-hidden="true" />
      </div>
      <label className="recorte-zoom">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 10.5 14 14M5 7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <input type="range" min="1" max={ZOOM_MAX} step="0.01" value={zoom} onChange={(e) => mudarZoom(Number(e.target.value))} aria-label="Zoom" disabled={!img} />
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 10.5 14 14M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </label>
      <div className="recorte-botoes">
        <button className="btn-claro" onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }) }} disabled={!img}>Centralizar</button>
        <span style={{ flex: 1 }} />
        <button className="btn-claro" onClick={aoCancelar}>Cancelar</button>
        <button className="btn" onClick={confirmar} disabled={!img}>Salvar foto</button>
      </div>
    </Modal>
  )
}
