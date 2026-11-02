export function Chip({ tom = '', children }) {
  return <span className={`chip ${tom}`}>{children}</span>
}

export function Kpi({ rotulo, valor, nota, chip }) {
  return (
    <div className="kpi">
      <span className="kpi-rotulo">{rotulo}</span>
      <span className="kpi-valor">{valor}</span>
      <span className="kpi-nota">
        {chip && <Chip tom={chip.bom ? 'verde' : 'vermelho'}>{chip.texto}</Chip>}
        {nota}
      </span>
    </div>
  )
}

export function Card({ titulo, direita, className = '', children }) {
  return (
    <div className={`card ${className}`}>
      {(titulo || direita) && (
        <div className="card-topo">
          {titulo && <h2>{titulo}</h2>}
          {direita}
        </div>
      )}
      {children}
    </div>
  )
}

export function Barra({ rotulo, valor, pct, largura, cor }) {
  return (
    <div className="barra-linha">
      <div className="barra-topo">
        <span>{rotulo}</span>
        <b>{valor}{pct != null && <> <em>· {pct}</em></>}</b>
      </div>
      <div className="barra-trilho"><div style={{ width: `${Math.max(0, Math.min(100, largura))}%`, background: cor }} /></div>
    </div>
  )
}

export function Cabecalho({ titulo, sub, children }) {
  return (
    <header className="cab">
      <div><h1>{titulo}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="cab-acoes">{children}</div>}
    </header>
  )
}
