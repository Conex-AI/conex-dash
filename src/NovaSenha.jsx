import { useState } from 'react'
import { supabase } from './supabase'
import TelaAcesso, { Campo, ICONE_SENHA } from './components/TelaAcesso'

// Tela aberta pelo link "Redefinir senha" enviado por e-mail.
export default function NovaSenha({ aoTerminar }) {
  const [senha, setSenha] = useState('')
  const [repetir, setRepetir] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar(e) {
    e.preventDefault()
    if (senha.length < 8) { setErro('Use pelo menos 8 caracteres.'); return }
    if (senha !== repetir) { setErro('As duas senhas não são iguais.'); return }
    setEnviando(true); setErro('')
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) setErro('Não foi possível trocar a senha. Peça um novo link.')
    else aoTerminar()
  }

  return (
    <TelaAcesso titulo="Criar nova senha" sub="Escolha uma senha com pelo menos 8 caracteres.">
      <form className="acesso-campos" onSubmit={salvar}>
        <Campo id="nova" rotulo="Nova senha" icone={ICONE_SENHA}>
          <input id="nova" type="password" autoComplete="new-password" required autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Campo id="repetir" rotulo="Repita a nova senha" icone={ICONE_SENHA}>
          <input id="repetir" type="password" autoComplete="new-password" required value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        </Campo>
        {erro && <div className="erro" role="alert">{erro}</div>}
        <button className="btn acesso-btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar senha'}</button>
      </form>
    </TelaAcesso>
  )
}
