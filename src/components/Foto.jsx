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


// Nome de quem está logado: o nome salvo no perfil ou a parte do e-mail antes do @
export function nomeExibicao(perfil, email = '') {
  if (perfil?.nome) return perfil.nome
  const base = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim()
  return base ? base.replace(/\b\w/g, (l) => l.toUpperCase()) : 'Meu perfil'
}
