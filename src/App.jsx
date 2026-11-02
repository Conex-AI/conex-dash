import { useEffect, useState } from 'react'
import { supabase, DEMO, configurado } from './supabase'
import { carregarPerfil, carregarClientes } from './api'
import { ICONES } from './components/Icones'
import Login from './Login'
import Dashboard from './pages/Dashboard'
import Conversas from './pages/Conversas'
import Metricas from './pages/Metricas'
import Pix from './pages/Pix'
import Followup from './pages/Followup'
import Clientes from './pages/Clientes'
import NovaSenha from './NovaSenha'

const ABAS = [
  { id: 'dashboard', nome: 'Dashboard' },
  { id: 'conversas', nome: 'Conversas' },
  { id: 'metricas', nome: 'Métricas' },
  { id: 'pix', nome: 'Pix' },
  { id: 'followup', nome: 'Follow-up' },
  { id: 'clientes', nome: 'Clientes', soAdmin: true },
]

function iniciais(nome = '') {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase()
}
function lerSalvo(chave) {
  try { return localStorage.getItem(chave) } catch { return null }
}
function gravarSalvo(chave, valor) {
  try { localStorage.setItem(chave, valor) } catch { /* sem armazenamento: segue sem lembrar */ }
}

export default function App() {
  const [sessao, setSessao] = useState(DEMO ? { user: { id: 'demo', email: 'voce@conex.com' } } : undefined)
  const [perfil, setPerfil] = useState(null)
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState(null)
  const [aba, setAba] = useState('dashboard')
  const [erro, setErro] = useState('')
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    if (DEMO) return
    if (!configurado) { setSessao(null); return }
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((ev, s) => {
      setSessao(s)
      if (ev === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessao) { setPerfil(null); setClientes([]); setClienteId(null); return }
    let ativo = true
    ;(async () => {
      try {
        const p = await carregarPerfil(sessao.user.id)
        if (!p) throw new Error('Seu usuário ainda não foi liberado. Fale com a Conex.')
        const lista = await carregarClientes()
        if (!ativo) return
        setPerfil(p)
        setClientes(lista)
        const salvo = lerSalvo('conex.cliente')
        const inicial = p.papel === 'admin'
          ? (lista.find((c) => c.id === salvo) || lista[0])
          : lista.find((c) => c.id === p.cliente_id) || lista[0]
        setClienteId(inicial?.id ?? null)
      } catch (e) {
        if (ativo) setErro(e.message || 'Não foi possível carregar seus dados.')
      }
    })()
    return () => { ativo = false }
  }, [sessao])

  if (!configurado && !DEMO) {
    return <div className="login-tela"><div className="erro">Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</div></div>
  }
  if (sessao === undefined) return <div className="login-tela"><span className="carregando">Carregando…</span></div>
  if (!sessao) return <Login />
  if (recuperando) return <NovaSenha aoTerminar={() => setRecuperando(false)} />

  const admin = perfil?.papel === 'admin'
  const cliente = clientes.find((c) => c.id === clienteId)
  const abas = ABAS.filter((a) => !a.soAdmin || admin)

  function escolherCliente(id) {
    setClienteId(id)
    gravarSalvo('conex.cliente', id)
  }
  async function sair() {
    if (!DEMO) await supabase.auth.signOut()
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="marca">
          <img src="/logo-simbolo.png" alt="" />
          <span>Conex Dash</span>
        </div>

        {cliente && (
          <div className="cliente-box">
            <span className="campo-rotulo">Cliente</span>
            <div className="cliente-sel">
              <span className="avatar">{iniciais(cliente.nome)}</span>
              {admin && clientes.length > 1 ? (
                <select value={clienteId || ''} onChange={(e) => escolherCliente(e.target.value)} aria-label="Cliente">
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              ) : (
                <strong style={{ fontSize: 14 }}>{cliente.nome}</strong>
              )}
            </div>
            {admin && <span className="campo-rotulo">Visão admin: {clientes.filter((c) => c.ativo).length} clientes ativos</span>}
          </div>
        )}

        <nav className="nav" aria-label="Principal">
          {abas.map((a) => (
            <button key={a.id} className={aba === a.id ? 'ativa' : ''} aria-current={aba === a.id ? 'page' : undefined} onClick={() => setAba(a.id)}>
              {ICONES[a.id]}{a.nome}
            </button>
          ))}
        </nav>

        <div className="side-rodape">
          <span className="usuario">{sessao.user.email}</span>
          <button className="btn-claro" onClick={sair}>Sair</button>
        </div>
      </aside>

      <main className="main">
        {erro && <div className="erro">{erro}</div>}
        {!erro && !perfil && <div className="carregando">Carregando…</div>}
        {perfil && !cliente && <div className="vazio">Nenhum cliente vinculado ao seu usuário.</div>}
        {perfil && cliente && (
          <>
            {aba === 'dashboard' && <Dashboard cliente={cliente} irPara={setAba} />}
            {aba === 'conversas' && <Conversas cliente={cliente} />}
            {aba === 'metricas' && <Metricas cliente={cliente} />}
            {aba === 'pix' && <Pix cliente={cliente} />}
            {aba === 'followup' && <Followup cliente={cliente} />}
            {aba === 'clientes' && admin && (
              <Clientes clientes={clientes} clienteAtual={cliente}
                onNovoCliente={(c) => setClientes((l) => [...l, c].sort((a, b) => a.nome.localeCompare(b.nome)))}
                abrir={(id) => { escolherCliente(id); setAba('dashboard') }} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
