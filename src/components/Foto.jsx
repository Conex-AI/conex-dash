// Foto do cliente (ou iniciais, se não tiver foto)
export function iniciais(nome = '') {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase()
}

export function Foto({ cliente, grande = false, className = '' }) {
  return (
    <span className={`foto ${grande ? 'g' : ''} ${className}`}>
      {cliente.foto_url ? <img src={cliente.foto_url} alt="" /> : iniciais(cliente.nome)}
    </span>
  )
}

