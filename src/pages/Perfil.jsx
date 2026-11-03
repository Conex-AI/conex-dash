import { useRef, useState } from 'react'
import { enviarFoto, removerFoto, trocarSenha, enviarMinhaFoto, removerMinhaFoto, salvarMeuNome } from '../api'
import { Cabecalho, Card } from '../components/Ui'

import { Foto, nomeExibicao } from '../components/Foto'

// Erro de "função não encontrada": o SQL correspondente ainda não foi rodado no Supabase
const faltaSql = (err) => /could not find the function|function .* does not exist|schema cache/i.test(err?.message || '')

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

export default function Perfil({ cliente, perfil, email, admin, tema, setTema, onFoto, onPerfil, sair }) {
  // Admin: perfil é dele mesmo (nome e foto pessoais). Cliente: perfil é o do painel do cliente.
  const meuNome = nomeExibicao(perfil, email)
  const dono = admin ? { nome: meuNome, foto_url: perfil?.foto_url } : cliente
  const [nome, setNome] = useState(meuNome)
  const [msgNome, setMsgNome] = useState('')
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
      if (admin) { const url = await enviarMinhaFoto(perfil.user_id, f); onPerfil({ foto_url: url }) }
      else { const url = await enviarFoto(cliente.id, f); onFoto(url) }
      setMsgFoto('Foto atualizada.')
    } catch (err) {
      console.error('Enviar foto:', err)
      const m = err?.message || ''
      setMsgFoto(/bucket not found/i.test(m) ? 'O espaço das fotos ainda não existe. Rode o sql/perfil.sql no Supabase e tente de novo.'
        : /row-level security|violates|unauthorized|403/i.test(m) ? 'Sem permissão para enviar a foto. Rode de novo o sql/perfil.sql no Supabase.'
        : /mime|type/i.test(m) ? 'Formato de imagem não aceito. Use PNG, JPG ou WEBP.'
        : faltaSql(err) ? 'O banco ainda não tem a função do perfil. Rode o sql/perfil_usuario.sql no Supabase.'
        : `Não foi possível enviar a foto (${m || 'erro desconhecido'}).`)
    } finally { setEnviando(false) }
  }

  async function tirarFoto() {
    setEnviando(true); setMsgFoto('')
    try {
      if (admin) { await removerMinhaFoto(); onPerfil({ foto_url: null }) }
      else { await removerFoto(cliente.id); onFoto(null) }
      setMsgFoto('Foto removida.')
    }
    catch { setMsgFoto('Não foi possível remover a foto.') }
    finally { setEnviando(false) }
  }

  async function salvarNome(e) {
    e.preventDefault()
    if (!nome.trim()) return
    try { await salvarMeuNome(nome.trim()); onPerfil({ nome: nome.trim() }); setMsgNome('Nome salvo.') }
    catch (err) {
      console.error('Salvar nome:', err)
      setMsgNome(faltaSql(err) ? 'O banco ainda não tem a função do perfil. Rode o sql/perfil_usuario.sql no Supabase e tente de novo.'
        : 'Não foi possível salvar o nome. Tente de novo.')
    }
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
      <Cabecalho titulo="Meu perfil" sub={admin ? `${meuNome} · administrador da Conex` : `${cliente.nome} · foto, aparência e senha do seu painel`} />

      <section className="linha">
        <Card className="f1" titulo={admin ? 'Sua foto e nome' : 'Foto do painel'}>
          <div className="foto-linha">
            <Foto cliente={dono} grande />
            <div className="foto-acoes">
              <button className="btn" onClick={() => arquivo.current?.click()} disabled={enviando}>
                {enviando ? 'Enviando…' : dono.foto_url ? 'Trocar foto' : 'Enviar foto'}
              </button>
              {dono.foto_url && <button className="btn-claro" onClick={tirarFoto} disabled={enviando}>Remover</button>}
              <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={escolherFoto} />
            </div>
          </div>
          {msgFoto && <p className="nota" role="status">{msgFoto}</p>}
          {admin && (
            <form className="form-linha" onSubmit={salvarNome}>
              <label>
                <span className="campo-rotulo">Nome de exibição</span>
                <input className="input" value={nome} onChange={(e) => { setNome(e.target.value); setMsgNome('') }} maxLength={60} />
              </label>
              <button className="btn" type="submit" disabled={!nome.trim() || nome.trim() === meuNome}>Salvar</button>
            </form>
          )}
          {msgNome && <p className="nota" role="status">{msgNome}</p>}
          <p className="nota">{admin
            ? 'Esse é o seu perfil de administrador. A foto do painel de cada cliente é alterada pelo próprio cliente, no perfil dele.'
            : 'A foto aparece no menu do painel. Use o logo ou uma foto quadrada; ela é recortada no centro.'}</p>
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
            {admin ? <div><span>Nome</span><b>{meuNome}</b></div> : <div><span>Cliente</span><b>{cliente.nome}</b></div>}
            <div><span>Tipo de acesso</span><b>{admin ? 'Admin' : 'Cliente'}</b></div>
          </div>
          <div><button className="btn-claro" onClick={sair}>Sair do painel</button></div>
        </Card>
      </section>
    </>
  )
}
