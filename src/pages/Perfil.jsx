import { useRef, useState } from 'react'
import { enviarFoto, removerFoto, trocarSenha } from '../api'
import { Cabecalho, Card } from '../components/Ui'

export function iniciais(nome = '') {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase()
}

export function Foto({ cliente, grande = false }) {
  return (
    <span className={`foto ${grande ? 'g' : ''}`}>
      {cliente.foto_url ? <img src={cliente.foto_url} alt="" /> : iniciais(cliente.nome)}
    </span>
  )
}

function Previa({ claro }) {
  const c = claro
    ? { bg: '#eef1f6', side: '#ffffff', card: '#ffffff', linha: '#e1e6ee' }
    : { bg: '#16181d', side: '#1e2128', card: '#1e2128', linha: '#2f343f' }
  return (
    <span className="previa" style={{ background: c.bg }} aria-hidden="true">
      <i style={{ background: c.side, border: `1px solid ${c.linha}` }} />
      <span style={{ display: 'grid', gap: 6, gridTemplateRows: '14px 1fr' }}>
        <b style={{ background: '#0a57fc', width: '55%' }} />
        <b style={{ background: c.card, border: `1px solid ${c.linha}` }} />
      </span>
    </span>
  )
}

export default function Perfil({ cliente, email, admin, tema, setTema, onFoto, sair }) {
  const arquivo = useRef(null)
  const [enviando, setEnviando] = useState(false)
  const [msgFoto, setMsgFoto] = useState('')
  const [senha, setSenha] = useState({ atual: '', nova: '', repetir: '' })
  const [msgSenha, setMsgSenha] = useState(null) // { ok, texto }
  const [salvando, setSalvando] = useState(false)

  async function escolherFoto(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setMsgFoto('Escolha um arquivo de imagem (PNG, JPG ou WEBP).'); return }
    if (f.size > 8 * 1024 * 1024) { setMsgFoto('A imagem é muito grande. Use uma de até 8 MB.'); return }
    setEnviando(true); setMsgFoto('')
    try {
      const url = await enviarFoto(cliente.id, f)
      onFoto(url); setMsgFoto('Foto atualizada.')
    } catch {
      setMsgFoto('Não foi possível enviar a foto. Tente de novo.')
    } finally { setEnviando(false) }
  }

  async function tirarFoto() {
    setEnviando(true); setMsgFoto('')
    try { await removerFoto(cliente.id); onFoto(null); setMsgFoto('Foto removida.') }
    catch { setMsgFoto('Não foi possível remover a foto.') }
    finally { setEnviando(false) }
  }

  async function salvarSenha(e) {
    e.preventDefault()
    if (senha.nova.length < 8) { setMsgSenha({ ok: false, texto: 'A nova senha precisa ter pelo menos 8 caracteres.' }); return }
    if (senha.nova !== senha.repetir) { setMsgSenha({ ok: false, texto: 'As duas senhas novas não são iguais.' }); return }
    setSalvando(true); setMsgSenha(null)
    try {
      await trocarSenha(email, senha.atual, senha.nova)
      setSenha({ atual: '', nova: '', repetir: '' })
      setMsgSenha({ ok: true, texto: 'Senha alterada. Use a nova senha no próximo acesso.' })
    } catch (err) {
      setMsgSenha({ ok: false, texto: err.message })
    } finally { setSalvando(false) }
  }

  return (
    <>
      <Cabecalho titulo="Meu perfil" sub={`${cliente.nome} · foto, aparência e senha do seu painel`} />

      <section className="linha">
        <Card className="f1" titulo="Foto do painel">
          <div className="foto-linha">
            <Foto cliente={cliente} grande />
            <div className="foto-acoes">
              <button className="btn" onClick={() => arquivo.current?.click()} disabled={enviando}>
                {enviando ? 'Enviando…' : cliente.foto_url ? 'Trocar foto' : 'Enviar foto'}
              </button>
              {cliente.foto_url && <button className="btn-claro" onClick={tirarFoto} disabled={enviando}>Remover</button>}
              <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={escolherFoto} />
            </div>
          </div>
          {msgFoto && <p className="nota" role="status">{msgFoto}</p>}
          <p className="nota">A foto aparece no menu do painel{admin ? ' deste cliente' : ''}. Use o logo ou uma foto quadrada; ela é recortada no centro.</p>
        </Card>

        <Card className="f1" titulo="Aparência">
          <div className="tema-opcoes" role="radiogroup" aria-label="Tema do painel">
            <button className={`tema-op ${tema === 'escuro' ? 'ativa' : ''}`} role="radio" aria-checked={tema === 'escuro'} onClick={() => setTema('escuro')}>
              <Previa />Escuro
            </button>
            <button className={`tema-op ${tema === 'claro' ? 'ativa' : ''}`} role="radio" aria-checked={tema === 'claro'} onClick={() => setTema('claro')}>
              <Previa claro />Claro
            </button>
          </div>
          <p className="nota">O tema fica salvo neste navegador.</p>
        </Card>
      </section>

      <section className="linha">
        <Card className="f2" titulo="Trocar senha">
          <form className="campos" onSubmit={salvarSenha}>
            <label>
              <span className="campo-rotulo">Senha atual</span>
              <input className="input" type="password" autoComplete="current-password" required value={senha.atual} onChange={(e) => setSenha({ ...senha, atual: e.target.value })} />
            </label>
            <label>
              <span className="campo-rotulo">Nova senha</span>
              <input className="input" type="password" autoComplete="new-password" required value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} />
            </label>
            <label>
              <span className="campo-rotulo">Repita a nova senha</span>
              <input className="input" type="password" autoComplete="new-password" required value={senha.repetir} onChange={(e) => setSenha({ ...senha, repetir: e.target.value })} />
            </label>
            {msgSenha && <div className={msgSenha.ok ? 'aviso-ok' : 'erro'} role="status">{msgSenha.texto}</div>}
            <div><button className="btn" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar nova senha'}</button></div>
          </form>
        </Card>

        <Card className="f1" titulo="Conta">
          <div className="stats">
            <div><span>E-mail de acesso</span><b style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>{email}</b></div>
            <div><span>Cliente</span><b>{cliente.nome}</b></div>
            <div><span>Tipo de acesso</span><b>{admin ? 'Admin' : 'Cliente'}</b></div>
          </div>
          <div><button className="btn-claro" onClick={sair}>Sair do painel</button></div>
        </Card>
      </section>
    </>
  )
}
