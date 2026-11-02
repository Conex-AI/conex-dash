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
import { useRota, endereco, cliqueInterno } from './lib/rota'

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
  const [rota, ir] = useRota()
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
        const daUrl = lista.find((c) => c.slug === new URLSearchParams(window.location.search).get('cliente'))
        const inicial = p.papel === 'admin'
          ? (daUrl || lista.find((c) => c.id === salvo) || lista[0])
          : lista.find((c) => c.id === p.cliente_id) || lista[0]
        setClienteId(inicial?.id ?? null)
      } catch (e) {
        if (ativo) setErro(e.message || 'Não foi possível carregar seus dados.')
      }
    })()
    return () => { ativo = false }
  }, [sessao])

  // Voltar/avançar do navegador trocando de cliente (admin)
  useEffect(() => {
    if (!rota.cliente || !clientes.length) return
    const c = clientes.find((x) => x.slug === rota.cliente)
    if (c && c.id !== clienteId) setClienteId(c.id)
  }, [rota.cliente, clientes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deixa o endereço sempre completo (/aba?cliente=slug) e corrige aba proibida
  useEffect(() => {
    if (!perfil || !clienteId) return
    const c = clientes.find((x) => x.id === clienteId)
    const aba = rota.aba === 'clientes' && perfil.papel !== 'admin' ? 'dashboard' : rota.aba
    // se o endereço já aponta para um cliente válido, quem manda é o endereço (efeito acima)
    const daUrl = perfil.papel === 'admin' && clientes.some((x) => x.slug === rota.cliente)
    const slug = daUrl ? rota.cliente : c?.slug
    if (slug && (slug !== rota.cliente || aba !== rota.aba)) ir(aba, slug, true)
  }, [perfil, clienteId, clientes, rota.aba, rota.cliente]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!configurado && !DEMO) {
    return <div className="login-tela"><div className="erro">Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente. Depois de salvar, reinicie o app.</div></div>
  }
  if (sessao === undefined) return <div className="login-tela"><span className="carregando">Carregando…</span></div>
  if (!sessao) return <Login />
  if (recuperando) return <NovaSenha aoTerminar={() => setRecuperando(false)} />

  const admin = perfil?.papel === 'admin'
  const cliente = clientes.find((c) => c.id === clienteId)
  const abas = ABAS.filter((a) => !a.soAdmin || admin)
  const aba = rota.aba === 'clientes' && !admin ? 'dashboard' : rota.aba
  const irPara = (novaAba) => ir(novaAba, cliente?.slug)

  function escolherCliente(id, novaAba = aba) {
    const c = clientes.find((x) => x.id === id)
    setClienteId(id)
    gravarSalvo('conex.cliente', id)
    if (c) ir(novaAba, c.slug)
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
            <a key={a.id} href={endereco(a.id, cliente?.slug)} className={aba === a.id ? 'ativa' : ''} aria-current={aba === a.id ? 'page' : undefined}
              onClick={(e) => { if (cliqueInterno(e)) { e.preventDefault(); irPara(a.id) } }}>
              {ICONES[a.id]}{a.nome}
            </a>
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
            {aba === 'dashboard' && <Dashboard cliente={cliente} irPara={irPara} />}
            {aba === 'conversas' && <Conversas cliente={cliente} />}
            {aba === 'metricas' && <Metricas cliente={cliente} />}
            {aba === 'pix' && <Pix cliente={cliente} />}
            {aba === 'followup' && <Followup cliente={cliente} />}
            {aba === 'clientes' && admin && (
              <Clientes clientes={clientes} clienteAtual={cliente}
                onNovoCliente={(c) => setClientes((l) => [...l, c].sort((a, b) => a.nome.localeCompare(b.nome)))}
                abrir={(id) => escolherCliente(id, 'dashboard')} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
