import { useState } from 'react'
import { supabase } from './supabase'

function mensagemDeErro(error) {
  const m = (error.message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('not confirmed')) return 'Seu e-mail ainda não foi confirmado. Fale com a Conex.'
  if (m.includes('fetch') || m.includes('network') || error.status === 0) return 'Sem conexão com o servidor. Tente de novo em instantes.'
  return 'Não foi possível entrar. Tente de novo.'
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)
    if (error) setErro(mensagemDeErro(error))
  }

  return (
    <div className="login-tela">
      <form className="login-card" onSubmit={entrar}>
        <img src="/logo-conex.png" alt="Conex" />
        <h1>Acompanhe seu atendimento</h1>
        <p className="sub">Entre com o e-mail e a senha que a Conex enviou.</p>
        <label htmlFor="email">E-mail</label>
        <input id="email" className="input" type="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="senha">Senha</label>
        <input id="senha" className="input" type="password" autoComplete="current-password" required
          value={senha} onChange={(e) => setSenha(e.target.value)} />
        {erro && <div className="erro" style={{ marginTop: 16, marginBottom: 0 }}>{erro}</div>}
        <button className="btn" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}
