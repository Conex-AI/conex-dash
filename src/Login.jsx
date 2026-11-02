import { useState } from 'react'
import { supabase } from './supabase'
import TelaAcesso, { Campo, ICONE_EMAIL, ICONE_SENHA } from './components/TelaAcesso'

function mensagemDeErro(error) {
  const m = (error.message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('not confirmed')) return 'Seu e-mail ainda não foi confirmado. Fale com a Conex.'
  if (m.includes('rate') || m.includes('too many')) return 'Muitas tentativas. Aguarde um minuto e tente de novo.'
  if (m.includes('fetch') || m.includes('network') || error.status === 0) return 'Sem conexão com o servidor. Tente de novo em instantes.'
  return 'Não foi possível entrar. Tente de novo.'
}

function Olho({ aberto }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M1.5 9S4.2 3.8 9 3.8 16.5 9 16.5 9 13.8 14.2 9 14.2 1.5 9 1.5 9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {!aberto && <path d="M3 15 15 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  )
}

export default function Login() {
  const [modo, setModo] = useState('entrar') // entrar | recuperar | enviado
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error) setErro(mensagemDeErro(error))
  }

  async function recuperar(e) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    setEnviando(false)
    if (error) setErro(mensagemDeErro(error))
    else setModo('enviado')
  }

  if (modo === 'enviado') {
    return (
      <TelaAcesso titulo="Confira seu e-mail" sub={`Se ${email.trim()} tiver acesso ao painel, você vai receber um link para criar uma nova senha.`}>
        <button className="btn acesso-btn" onClick={() => { setModo('entrar'); setSenha('') }}>Voltar para o login</button>
      </TelaAcesso>
    )
  }

  if (modo === 'recuperar') {
    return (
      <TelaAcesso titulo="Esqueceu a senha?" sub="Informe seu e-mail de acesso. Enviaremos um link para você criar uma nova.">
        <form className="acesso-campos" onSubmit={recuperar}>
          <Campo id="email" rotulo="E-mail" icone={ICONE_EMAIL}>
            <input id="email" type="email" autoComplete="username" required autoFocus placeholder="voce@empresa.com.br"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          {erro && <div className="erro" role="alert">{erro}</div>}
          <button className="btn acesso-btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar link'}</button>
          <button type="button" className="acesso-link centro" onClick={() => { setModo('entrar'); setErro('') }}>Voltar para o login</button>
        </form>
      </TelaAcesso>
    )
  }

  return (
    <TelaAcesso titulo="Acesse seu painel" sub="Entre para acompanhar o atendimento do seu WhatsApp.">
      <form className="acesso-campos" onSubmit={entrar}>
        <Campo id="email" rotulo="E-mail" icone={ICONE_EMAIL}>
          <input id="email" type="email" autoComplete="username" required autoFocus placeholder="voce@empresa.com.br"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo id="senha" rotulo="Senha" icone={ICONE_SENHA}
          direita={<button type="button" className="acesso-link" onClick={() => { setModo('recuperar'); setErro('') }}>Esqueci minha senha</button>}>
          <input id="senha" type={ver ? 'text' : 'password'} autoComplete="current-password" required placeholder="Sua senha"
            value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button type="button" className="campo-olho" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}>
            <Olho aberto={ver} />
          </button>
        </Campo>
        {erro && <div className="erro" role="alert">{erro}</div>}
        <button className="btn acesso-btn" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </TelaAcesso>
  )
}
