import { useState } from 'react'
import Modal from './Modal'

// Foto do cliente (ou iniciais, se não tiver foto)
export function iniciais(nome = '') {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase()
}

// ampliavel: clicar na foto abre ela em tamanho grande (usado na visão de admin)
export function Foto({ cliente, grande = false, className = '', ampliavel = false }) {
  const [aberta, setAberta] = useState(false)
  const conteudo = cliente.foto_url ? <img src={cliente.foto_url} alt="" /> : iniciais(cliente.nome)
  if (!ampliavel || !cliente.foto_url) {
    return <span className={`foto ${grande ? 'g' : ''} ${className}`}>{conteudo}</span>
  }
  return (
    <>
      <span role="button" tabIndex={0} className={`foto ampliavel ${grande ? 'g' : ''} ${className}`}
        aria-label={`Ampliar foto de ${cliente.nome}`} title="Ampliar foto"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberta(true) }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setAberta(true) } }}>
        {conteudo}
      </span>
      {aberta && (
        <Modal titulo={`Foto de ${cliente.nome}`} aoFechar={() => setAberta(false)} className="modal-foto">
          <img src={cliente.foto_url} alt={`Foto de ${cliente.nome}`} />
          <div className="modal-foto-rodape">
            <b>{cliente.nome}</b>
            <button className="btn-claro" onClick={() => setAberta(false)}>Fechar</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// Nome de quem está logado: o nome salvo no perfil ou a parte do e-mail antes do @
export function nomeExibicao(perfil, email = '') {
  if (perfil?.nome) return perfil.nome
  const base = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim()
  return base ? base.replace(/\b\w/g, (l) => l.toUpperCase()) : 'Meu perfil'
}
