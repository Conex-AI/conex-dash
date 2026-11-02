import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { hojeSP, somaDias } from '../lib/datas'

// ---------------------------------------------------------------------------
// Período da pesquisa, compartilhado entre as abas (trocar de aba mantém o período).
// Pode ser "últimos N dias" ou um intervalo escolhido no calendário.
// ---------------------------------------------------------------------------
const OPCOES = [7, 30, 90]
const CHAVE = 'conex.periodo'
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

function lerSalvo() {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE))
    if (v && (OPCOES.includes(v.dias) || (v.de && v.ate))) return v
  } catch { /* sem armazenamento */ }
  return { dias: 30 }
}
let atual = lerSalvo()
const ouvintes = new Set()
function definir(v) {
  atual = v
  try { sessionStorage.setItem(CHAVE, JSON.stringify(v)) } catch { /* segue sem lembrar */ }
  ouvintes.forEach((f) => f())
}
const assinar = (f) => { ouvintes.add(f); return () => ouvintes.delete(f) }

export function diasEntre(de, ate) {
  return Math.round((new Date(ate + 'T12:00:00Z') - new Date(de + 'T12:00:00Z')) / 864e5) + 1
}

export function usePeriodo() {
  const sel = useSyncExternalStore(assinar, () => atual)
  return useMemo(() => {
    const hoje = hojeSP()
    const ate = sel.ate || hoje
    const de = sel.de || somaDias(ate, -(sel.dias - 1))
    const n = diasEntre(de, ate)
    const antAte = somaDias(de, -1)
    const antDe = somaDias(antAte, -(n - 1))
    return {
      dias: sel.de ? null : sel.dias,
      personalizado: Boolean(sel.de),
      n, de, ate, antDe, antAte,
      setDias: (d) => definir({ dias: d }),
      setIntervalo: (a, b) => definir({ de: a, ate: b }),
    }
  }, [sel])
}

// ---------------------------------------------------------------------------
// Exibição das datas: "4 out → 2 nov"; o ano só aparece se o intervalo cruzar anos.
// ---------------------------------------------------------------------------
function partes(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  return { a, m: m - 1, d }
}
export function textoIntervalo(de, ate) {
  const x = partes(de), y = partes(ate)
  const anos = x.a !== y.a
  const f = (p) => `${p.d} ${MESES[p.m]}${anos ? ` ${p.a}` : ''}`
  return de === ate ? f(x) : `${f(x)} – ${f(y)}`
}

function Data({ iso, ano }) {
  const p = partes(iso)
  return (
    <span className="pdata">
      <b>{p.d}</b>
      <span><em>{MESES[p.m]}</em>{ano && <i>{p.a}</i>}</span>
    </span>
  )
}

function IconeCalendario() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2.5" y="3.5" width="13" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 7.5h13M6 2v3M12 2v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Calendário de intervalo (dois meses lado a lado)
// ---------------------------------------------------------------------------
function iso(a, m, d) {
  return `${a}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function mesAnterior({ a, m }) { return m === 0 ? { a: a - 1, m: 11 } : { a, m: m - 1 } }
function mesSeguinte({ a, m }) { return m === 11 ? { a: a + 1, m: 0 } : { a, m: m + 1 } }

function Mes({ ref_, inicio, fim, passando, hoje, escolher, passar }) {
  const { a, m } = ref_
  const primeiro = (new Date(Date.UTC(a, m, 1)).getUTCDay() + 6) % 7 // segunda = 0
  const total = new Date(Date.UTC(a, m + 1, 0)).getUTCDate()
  const fimVisual = fim || passando
  const [x, y] = inicio && fimVisual ? (inicio <= fimVisual ? [inicio, fimVisual] : [fimVisual, inicio]) : [inicio, inicio]
  const celulas = []
  for (let i = 0; i < primeiro; i++) celulas.push(<span key={'v' + i} />)
  for (let d = 1; d <= total; d++) {
    const dia = iso(a, m, d)
    const futuro = dia > hoje
    const ponta = dia === x || dia === y
    const meio = x && y && dia > x && dia < y
    celulas.push(
      <button key={dia} type="button" disabled={futuro}
        className={`cal-dia${ponta ? ' ponta' : ''}${meio ? ' meio' : ''}${dia === x && y && y !== x ? ' ini' : ''}${dia === y && x !== y ? ' fim' : ''}${dia === hoje ? ' hoje' : ''}`}
        onClick={() => escolher(dia)} onMouseEnter={() => passar(dia)}
        aria-label={`${d} de ${MESES_LONGOS[m]} de ${a}`} aria-pressed={ponta}>
        {d}
      </button>,
    )
  }
  return (
    <div className="cal-mes">
      <span className="cal-titulo">{MESES_LONGOS[m]} {a}</span>
      <div className="cal-grade">
        {SEMANA.map((s, i) => <span key={i} className="cal-sem">{s}</span>)}
        {celulas}
      </div>
    </div>
  )
}

function Calendario({ p, fechar }) {
  const hoje = hojeSP()
  const [inicio, setInicio] = useState(p.de)
  const [fim, setFim] = useState(p.ate)
  const [passando, setPassando] = useState(null)
  const h = partes(p.ate)
  const [direita, setDireita] = useState({ a: h.a, m: h.m })
  const esquerda = mesAnterior(direita)
  const ultimoMes = partes(hoje)
  const podeAvancar = direita.a < ultimoMes.a || (direita.a === ultimoMes.a && direita.m < ultimoMes.m)

  function escolher(dia) {
    if (!inicio || fim) { setInicio(dia); setFim(null); return }
    if (dia < inicio) { setFim(inicio); setInicio(dia) } else setFim(dia)
  }
  function atalho(n) {
    setInicio(somaDias(hoje, -(n - 1))); setFim(hoje)
  }
  function aplicar() {
    p.setIntervalo(inicio, fim || inicio); fechar()
  }
  const de = inicio, ate = fim || inicio

  return (
    <div className="cal" role="dialog" aria-label="Escolher período">
      <div className="cal-atalhos">
        {[['Hoje', 1], ['Últimos 7 dias', 7], ['Últimos 15 dias', 15], ['Últimos 30 dias', 30], ['Últimos 60 dias', 60], ['Últimos 90 dias', 90], ['Últimos 6 meses', 182], ['Último ano', 365]]
          .map(([nome, n]) => <button key={n} type="button" onClick={() => atalho(n)}>{nome}</button>)}
      </div>
      <div className="cal-corpo">
        <div className="cal-nav">
          <button type="button" className="cal-seta" onClick={() => setDireita(esquerda)} aria-label="Mês anterior">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 L5.5 8 L10 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="cal-seta" onClick={() => setDireita(mesSeguinte(direita))} disabled={!podeAvancar} aria-label="Próximo mês">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 L10.5 8 L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <div className="cal-meses" onMouseLeave={() => setPassando(null)}>
          {[esquerda, direita].map((r) => (
            <Mes key={`${r.a}-${r.m}`} ref_={r} inicio={inicio} fim={fim} passando={!fim ? passando : null}
              hoje={hoje} escolher={escolher} passar={setPassando} />
          ))}
        </div>
        <div className="cal-rodape">
          <span>
            {de ? <><b>{textoIntervalo(de, ate)}</b> · {diasEntre(de, ate)} {diasEntre(de, ate) === 1 ? 'dia' : 'dias'}</> : 'Escolha a data inicial'}
            {de && !fim && <em> · agora escolha a data final</em>}
          </span>
          <span className="cal-botoes">
            <button type="button" className="btn-claro" onClick={fechar}>Cancelar</button>
            <button type="button" className="btn" onClick={aplicar} disabled={!de}>Aplicar</button>
          </span>
        </div>
      </div>
    </div>
  )
}

export function SeletorPeriodo({ p }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef(null)
  const anos = partes(p.de).a !== partes(p.ate).a

  useEffect(() => {
    if (!aberto) return
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false) }
    const esc = (e) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  return (
    <div className="seletor-periodo" ref={caixa}>
      <span className="pintervalo" aria-label={`Período: ${textoIntervalo(p.de, p.ate)}`}>
        <Data iso={p.de} ano={anos} />
        {p.de !== p.ate && (
          <>
            <svg className="pseta" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <Data iso={p.ate} ano={anos} />
          </>
        )}
        <span className="pdias">{p.n} {p.n === 1 ? 'dia' : 'dias'}</span>
      </span>
      <div className="periodo">
        {OPCOES.map((n) => (
          <button key={n} className={p.dias === n ? 'ativa' : ''} onClick={() => p.setDias(n)}>{n} dias</button>
        ))}
        <button className={`periodo-cal ${p.personalizado || aberto ? 'ativa' : ''}`} onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto} aria-haspopup="dialog" title="Escolher datas">
          <IconeCalendario />
        </button>
      </div>
      {aberto && <Calendario p={p} fechar={() => setAberto(false)} />}
    </div>
  )
}
