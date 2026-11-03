import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase, DEMO, configurado } from './supabase'
import { carregarPerfil, carregarClientes } from './api'
import { ICONES } from './components/Icones'
import Login from './Login'
import Dashboard from './pages/Dashboard'
import NovaSenha from './NovaSenha'
import { Foto, nomeExibicao } from './components/Foto'
import { Esqueleto } from './components/Ui'
import { Marca } from './components/Marca'
import { useTema } from './lib/tema'
import { useGaveta } from './lib/gaveta'
import { preCarregar, useCarregandoAlgo, queryClient } from './lib/consultas'
import { usePeriodo } from './components/Periodo'

// Cada aba vira um arquivo separado (o primeiro acesso fica mais leve).
// Logo depois de entrar, todos são baixados em segundo plano para a troca de aba ser instantânea.
const TELAS = {
  conversas: () => import('./pages/Conversas'),
  metricas: () => import('./pages/Metricas'),
  pix: () => import('./pages/Pix'),
  followup: () => import('./pages/Followup'),
  clientes: () => import('./pages/Clientes'),
  perfil: () => import('./pages/Perfil'),
}
const Conversas = lazy(TELAS.conversas)
const Metricas = lazy(TELAS.metricas)
const Pix = lazy(TELAS.pix)
const Followup = lazy(TELAS.followup)
const Clientes = lazy(TELAS.clientes)
const Perfil = lazy(TELAS.perfil)
const quandoOcioso = (f) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 300))
import { useRota, endereco, cliqueInterno } from './lib/rota'

const ABAS = [
  { id: 'dashboard', nome: 'Dashboard' },
  { id: 'conversas', nome: 'Conversas' },
  { id: 'metricas', nome: 'Métricas' },
  { id: 'pix', nome: 'Pix' },
  { id: 'followup', nome: 'Follow-up' },
  { id: 'clientes', nome: 'Clientes', soAdmin: true },
]

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
  const [tema, setTema] = useTema()
  const gaveta = useGaveta()
  const periodo = usePeriodo()
  const carregando = useCarregandoAlgo()
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

  // Pré-carrega as telas e os dados das outras abas em segundo plano
  const clienteAtual = clientes.find((c) => c.id === clienteId)
  const ehAdmin = perfil?.papel === 'admin'
  useEffect(() => {
    if (!clienteAtual) return
    quandoOcioso(() => {
      Object.values(TELAS).forEach((f) => f())
      ;['dashboard', 'conversas', 'metricas', 'pix', 'followup', 'clientes'].forEach((a) => preCarregar(a, clienteAtual, periodo, ehAdmin))
    })
  }, [clienteAtual?.id, periodo.de, periodo.ate, ehAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Saiu da conta: limpa o cache para o próximo login não ver dados do anterior
  useEffect(() => { if (sessao === null) queryClient.clear() }, [sessao])

  if (!configurado && !DEMO) {
    return <div className="login-tela"><div className="erro">Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente. Depois de salvar, reinicie o app.</div></div>
  }
  if (sessao === undefined) return <div className="login-tela"><span className="carregando">Carregando…</span></div>
  if (!sessao) return <Login />
  if (recuperando) return <NovaSenha aoTerminar={() => setRecuperando(false)} />

  const admin = perfil?.papel === 'admin'
  const cliente = clientes.find((c) => c.id === clienteId)
  const abas = ABAS.filter((a) => !a.soAdmin || admin)
  // Quem aparece no botão "Meu perfil": o próprio admin, ou o painel do cliente para quem é cliente
  const dono = admin ? { nome: nomeExibicao(perfil, sessao.user.email), foto_url: perfil?.foto_url } : cliente
  const aba = rota.aba === 'clientes' && !admin ? 'dashboard' : rota.aba
  const irPara = (novaAba) => { gaveta.fechar(); ir(novaAba, cliente?.slug) }

  function escolherCliente(id, novaAba = aba) {
    const c = clientes.find((x) => x.id === id)
    setClienteId(id)
    gravarSalvo('conex.cliente', id)
    if (c) ir(novaAba, c.slug)
    gaveta.fechar()
  }
  async function sair() {
    if (!DEMO) await supabase.auth.signOut()
  }

  return (
    <div className="app">
      <header className="topo-movel">
        <button className="topo-botao" onClick={() => gaveta.abrir('esq')} aria-label="Abrir menu" aria-expanded={gaveta.aberto} aria-controls="menu-principal">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M4 6.5h14M4 11h14M4 15.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <a className="topo-marca" href={endereco('dashboard', cliente?.slug)} aria-label="Conex Dash, ir para o Dashboard"
          onClick={(e) => { if (cliqueInterno(e)) { e.preventDefault(); irPara('dashboard') } }}>
          <Marca altura={26} />
        </a>
        {cliente ? (
          <a className="topo-botao" href={endereco('perfil', cliente.slug)} aria-label="Meu perfil"
            onClick={(e) => { if (cliqueInterno(e)) { e.preventDefault(); irPara('perfil') } }}>
            <Foto cliente={dono} />
          </a>
        ) : <span className="topo-botao" />}
      </header>

      <div className={`veu ${gaveta.movel && gaveta.aberto ? 'ativo' : ''}`} style={gaveta.estiloVeu} onClick={gaveta.fechar} aria-hidden="true" />

      <aside id="menu-principal" className={`side ${gaveta.lado} ${gaveta.aberto ? 'aberto' : ''}`} style={gaveta.estiloGaveta}
        aria-hidden={gaveta.movel && !gaveta.aberto && !gaveta.arrastando ? true : undefined}
        inert={gaveta.movel && !gaveta.aberto && !gaveta.arrastando ? '' : undefined}>
        <button className="side-fechar" onClick={gaveta.fechar} aria-label="Fechar menu">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <a className="marca" href={endereco('dashboard', cliente?.slug)} aria-label="Conex Dash, ir para o Dashboard"
          onClick={(e) => { if (cliqueInterno(e)) { e.preventDefault(); irPara('dashboard') } }}>
          <Marca altura={32} />
        </a>

        {cliente && (
          <div className="cliente-box">
            <a href={endereco('perfil', cliente.slug)} className={`perfil-btn ${aba === 'perfil' ? 'ativa' : ''}`}
              aria-current={aba === 'perfil' ? 'page' : undefined}
              onClick={(e) => { if (cliqueInterno(e)) { e.preventDefault(); irPara('perfil') } }}>
              <Foto cliente={dono} />
              <span className="nome"><b>{dono.nome}</b><em>{admin ? 'Meu perfil · Admin' : 'Meu perfil'}</em></span>
              <svg className="seta" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 L10.5 8 L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
            {admin && (
              <>
                <span className="campo-rotulo">Cliente em visualização</span>
                <div className="cliente-sel">
                  <Foto cliente={cliente} className="mini" ampliavel />
                  {clientes.length > 1 ? (
                    <select value={clienteId || ''} onChange={(e) => escolherCliente(e.target.value)} aria-label="Trocar de cliente">
                      {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  ) : <strong style={{ fontSize: 14 }}>{cliente.nome}</strong>}
                </div>
                <span className="campo-rotulo">{clientes.filter((c) => c.ativo).length} {clientes.filter((c) => c.ativo).length === 1 ? 'cliente ativo' : 'clientes ativos'}</span>
              </>
            )}
          </div>
        )}

        <nav className="nav" aria-label="Principal">
          {abas.map((a) => (
            <a key={a.id} href={endereco(a.id, cliente?.slug)} className={aba === a.id ? 'ativa' : ''} aria-current={aba === a.id ? 'page' : undefined}
              onMouseEnter={() => { TELAS[a.id]?.(); preCarregar(a.id, cliente, periodo, admin) }}
              onClick={(e) => { if (cliqueInterno(e)) { e.preventDefault(); irPara(a.id) } }}>
              {ICONES[a.id]}{a.nome}
            </a>
          ))}
        </nav>

        <div className="side-rodape">
          <button className="btn-claro" onClick={sair}>Sair</button>
        </div>
      </aside>

      {carregando && <div className="barra-progresso" role="progressbar" aria-label="Atualizando dados" />}
      <main className="main">
        {erro && <div className="erro">{erro}</div>}
        {!erro && !perfil && <Esqueleto />}
        {perfil && !cliente && <div className="vazio">Nenhum cliente vinculado ao seu usuário.</div>}
        {perfil && cliente && (
          <Suspense fallback={<Esqueleto />}>
            {aba === 'dashboard' && <Dashboard cliente={cliente} irPara={irPara} />}
            {aba === 'conversas' && <Conversas cliente={cliente} />}
            {aba === 'perfil' && (
              <Perfil cliente={cliente} perfil={perfil} email={sessao.user.email} admin={admin} tema={tema} setTema={setTema} sair={sair}
                onPerfil={(mudou) => setPerfil((p) => ({ ...p, ...mudou }))}
                onFoto={(url) => setClientes((l) => l.map((c) => (c.id === cliente.id ? { ...c, foto_url: url } : c)))} />
            )}
            {aba === 'metricas' && <Metricas cliente={cliente} irPara={irPara} />}
            {aba === 'pix' && <Pix cliente={cliente} />}
            {aba === 'followup' && <Followup cliente={cliente} />}
            {aba === 'clientes' && admin && (
              <Clientes clientes={clientes} clienteAtual={cliente}
                onNovoCliente={(c) => setClientes((l) => [...l, c].sort((a, b) => a.nome.localeCompare(b.nome)))}
                abrir={(id) => escolherCliente(id, 'dashboard')} />
            )}
          </Suspense>
        )}
      </main>
    </div>
  )
}
