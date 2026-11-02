import { useState } from 'react'
import { supabase } from './supabase'
import { LogoCompleta } from './components/Marca'

// Tela aberta pelo link "Redefinir senha" enviado por e-mail.
export default function NovaSenha({ aoTerminar }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar(e) {
    e.preventDefault()
    if (senha.length < 8) { setErro('Use pelo menos 8 caracteres.'); return }
    setEnviando(true); setErro('')
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) setErro('Não foi possível trocar a senha. Peça um novo link.')
    else aoTerminar()
  }

  return (
    <div className="login-tela">
      <form className="login-card" onSubmit={salvar}>
        <span className="logo-login"><LogoCompleta largura={170} /></span>
        <h1>Criar nova senha</h1>
        <label htmlFor="nova">Nova senha</label>
        <input id="nova" className="input" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        {erro && <div className="erro" style={{ marginTop: 14 }}>{erro}</div>}
        <button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar senha'}</button>
      </form>
    </div>
  )
}
