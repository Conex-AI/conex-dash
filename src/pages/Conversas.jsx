import { useEffect, useMemo, useRef, useState } from 'react'
import { useDados, q, queryClient } from '../lib/consultas'
import { TZ } from '../lib/datas'
import { Cabecalho, Chip } from '../components/Ui'

const DESFECHO = {
  conversao: ['Convertida', 'verde'],
  transferencia_esperada: ['Com a Juliana', 'azul'],
  comprovante_recebido: ['Pix pendente', 'laranja'],
  transferencia_falha: ['Repasse por falha', 'vermelho'],
  resolvida_sem_humano: ['Resolvida pela Jú', ''],
}
const EVENTO = {
  contato_novo: 'Contato novo',
  procedimento_definido: 'Procedimento definido',
  horario_definido: 'Horário definido',
  transferencia_esperada: 'Repasse esperado',
  comprovante_recebido: 'Comprovante recebido',
  conversao: 'Agendamento confirmado',
  transferencia_falha: 'Repasse por falha',
  resolvida_sem_humano: 'Resolvida pela Jú',
  followup_enviado: 'Follow-up enviado',
}
const QUEM = { cliente: 'Cliente', ia: 'Jú', humano: 'Juliana' }

const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const dia = (iso) => new Date(iso).toLocaleDateString('sv', { timeZone: TZ })

function quando(iso) {
  const hoje = new Date().toLocaleDateString('sv', { timeZone: TZ })
  if (dia(iso) === hoje) return hora(iso)
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' })
}
// 5561999990068 -> "55 61 9•••• ••68" (o número inteiro não precisa ficar à mostra na tela)
function mascara(tel = '') {
  const n = tel.replace(/\D/g, '')
  if (n.length < 12) return n.replace(/.(?=.{2})/g, '•')
  return `${n.slice(0, 2)} ${n.slice(2, 4)} ${n[4]}•••• ••${n.slice(-2)}`
}
const ICONE_MIDIA = {
  audio: 'M7 2.5a2 2 0 0 1 4 0v5a2 2 0 0 1-4 0zM4.5 7.5a4.5 4.5 0 0 0 9 0M9 12v3',
  imagem: 'M3 3.5h12v11H3zM3 12l3.5-3.5 3 3 2-2L15 13M11.5 7a1 1 0 1 0 0-.01',
}
function iniciaisNome(n = '') {
  const p = n.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'
}
function dataLonga(d) {
  const hoje = new Date().toLocaleDateString('sv', { timeZone: TZ })
  const ontem = new Date(Date.now() - 864e5).toLocaleDateString('sv', { timeZone: TZ })
  if (d === hoje) return 'Hoje'
  if (d === ontem) return 'Ontem'
  return new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
}
const rotuloMsg = (m) => m.conteudo || ({ audio: '[áudio]', imagem: '[imagem]', foto_enviada: '[foto enviada]', video_enviado: '[vídeo enviado]' }[m.tipo] || '[mídia]')

export default function Conversas({ cliente }) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [sel, setSel] = useState(null)
  const rolagem = useRef(null)
  const [noFim, setNoFim] = useState(true)

  const lista = useDados([q.conversas(cliente.id)])
  const linhas = lista.dados?.[0] ?? null
  const erro = lista.erro

  // trocou de cliente: volta para a primeira conversa
  useEffect(() => { setSel(null) }, [cliente.id])
  useEffect(() => {
    if (linhas && (!sel || !linhas.some((c) => c.telefone === sel))) setSel(linhas[0]?.telefone ?? null)
  }, [linhas, sel])

  const detalhe = useDados(sel ? [q.mensagens(cliente.id, sel), q.eventos(cliente.id, sel)] : [], Boolean(sel))
  const det = useMemo(() => detalhe.dados && ({ mensagens: detalhe.dados[0], eventos: detalhe.dados[1] }), [detalhe.dados])
  const erroDet = detalhe.erro

  // passar o mouse numa conversa já busca as mensagens dela
  function preCarregarConversa(tel) {
    queryClient.prefetchQuery(q.mensagens(cliente.id, tel))
    queryClient.prefetchQuery(q.eventos(cliente.id, tel))
  }

  const visiveis = useMemo(() => {
    if (!linhas) return []
    const q = busca.trim().toLowerCase()
    return linhas.filter((c) => {
      if (filtro !== 'todos' && (c.ultimo_desfecho || 'andamento') !== filtro) return false
      return !q || (c.nome_wpp || '').toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, '') || '§')
    })
  }, [linhas, busca, filtro])

  const atual = linhas?.find((c) => c.telefone === sel)
  const resumo = useMemo(() => {
    if (!det) return null
    const ev = (nome) => [...det.eventos].reverse().find((e) => e.evento === nome)
    const ultimo = det.eventos[det.eventos.length - 1]
    return {
      procedimento: ev('procedimento_definido')?.procedimento || '—',
      preferencia: ev('horario_definido')?.valor || '—',
      desfecho: ultimo ? (EVENTO[ultimo.evento] || ultimo.evento) : 'Em andamento',
    }
  }, [det])

  // separa o chat por dia e junta mensagens seguidas do mesmo remetente (até 5 min entre elas)
  const grupos = useMemo(() => {
    const dias = []
    let anterior = null
    for (const m of det?.mensagens || []) {
      const d = dia(m.created_at)
      if (!dias.length || dias[dias.length - 1].dia !== d) { dias.push({ dia: d, blocos: [] }); anterior = null }
      const blocos = dias[dias.length - 1].blocos
      const junto = anterior && anterior.origem === m.origem && new Date(m.created_at) - new Date(anterior.created_at) < 5 * 60e3
      if (!junto) blocos.push({ origem: m.origem, msgs: [] })
      blocos[blocos.length - 1].msgs.push(m)
      anterior = m
    }
    return dias
  }, [det])

  // abre a conversa já no fim (mensagem mais recente)
  const temDet = Boolean(det)
  useEffect(() => {
    const el = rolagem.current
    if (el && temDet) { el.scrollTop = el.scrollHeight; setNoFim(true) }
  }, [sel, temDet])
  function aoRolar(e) {
    const el = e.currentTarget
    setNoFim(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }
  function irProFim() {
    rolagem.current?.scrollTo({ top: rolagem.current.scrollHeight, behavior: 'smooth' })
  }
  const nomeContato = atual?.nome_wpp || 'Cliente'

  return (
    <>
      <Cabecalho titulo="Conversas" sub="Mensagens enviadas e recebidas, com o desfecho de cada atendimento.">
        <select className="input" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por desfecho">
          <option value="todos">Todos os desfechos</option>
          {Object.entries(DESFECHO).map(([k, [nome]]) => <option key={k} value={k}>{nome}</option>)}
          <option value="andamento">Em andamento</option>
        </select>
      </Cabecalho>

      {erro && <div className="erro">{erro}</div>}
      {!linhas && !erro && <div className="carregando">Carregando…</div>}

      {linhas && (
        <section className="conv">
          <div className="conv-lista">
            <label className="conv-busca">
              <span className="campo-rotulo">Buscar conversa</span>
              <input className="input" type="search" placeholder="Buscar por nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
            {visiveis.length === 0 && <div className="vazio">{linhas.length ? 'Nenhuma conversa nesse filtro.' : 'Nenhuma conversa ainda.'}</div>}
            {visiveis.map((c) => {
              const [rotulo, tom] = DESFECHO[c.ultimo_desfecho] || ['Em andamento', 'laranja']
              return (
                <button key={c.telefone} className={`conv-item ${c.telefone === sel ? 'ativa' : ''}`} onClick={() => setSel(c.telefone)} onMouseEnter={() => preCarregarConversa(c.telefone)} onFocus={() => preCarregarConversa(c.telefone)}>
                  <span className="conv-avatar" aria-hidden="true">{iniciaisNome(c.nome_wpp)}</span>
                  <span className="conv-item-corpo">
                    <span className="conv-linha"><b>{c.nome_wpp || mascara(c.telefone)}</b><em>{quando(c.ultima_msg_em)}</em></span>
                    <span className="conv-linha"><span className="conv-sub">{c.total_mensagens} mensagens</span><Chip tom={tom}>{rotulo}</Chip></span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="conv-chat">
            {!atual && <div className="vazio">Escolha uma conversa na lista.</div>}
            {atual && (
              <>
                <div className="conv-topo">
                  <span className="conv-avatar" aria-hidden="true">{iniciaisNome(atual.nome_wpp)}</span>
                  <div className="conv-quem">
                    <b>{atual.nome_wpp || 'Sem nome'}</b>
                    <span>{mascara(atual.telefone)} · {atual.total_mensagens} mensagens</span>
                  </div>
                  {resumo && <Chip tom="azul">{resumo.desfecho}</Chip>}
                </div>
                {erroDet && <div className="erro" style={{ margin: 16 }}>{erroDet}</div>}
                {!det && !erroDet && <div className="carregando" style={{ padding: 20 }}>Carregando…</div>}
                {det && (
                  <div className="conv-fundo">
                    <div className="conv-msgs" ref={rolagem} onScroll={aoRolar}>
                      {grupos.map((g) => (
                        <div key={g.dia} className="conv-dia">
                          <span className="conv-data">{dataLonga(g.dia)}</span>
                          {g.blocos.map((b, i) => (
                            <div key={i} className={`bloco ${b.origem}`}>
                              <span className="bloco-quem">{b.origem === 'cliente' ? nomeContato : (QUEM[b.origem] || b.origem)}</span>
                              {b.msgs.map((m) => (
                                <div key={m.id ?? m.created_at} className="bolha">
                                  {ICONE_MIDIA[m.tipo] && (
                                    <svg className="bolha-icone" width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                                      <path d={ICONE_MIDIA[m.tipo]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                  <span className="bolha-texto">{rotuloMsg(m)}</span>
                                  <time className="bolha-hora" dateTime={m.created_at}>{hora(m.created_at)}</time>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                      {det.mensagens.length === 0 && <div className="vazio">Sem mensagens guardadas nessa conversa.</div>}
                    </div>
                    {!noFim && (
                      <button className="conv-fim" onClick={irProFim} aria-label="Ir para a mensagem mais recente">
                        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4.5 7 L9 11.5 L13.5 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="conv-det">
            <span className="conv-det-titulo">Detalhes</span>
            {resumo && atual ? (
              <>
                <dl>
                  <div><dt>Procedimento</dt><dd>{resumo.procedimento}</dd></div>
                  <div><dt>Preferência</dt><dd>{resumo.preferencia}</dd></div>
                  <div><dt>Desfecho</dt><dd>{resumo.desfecho}</dd></div>
                  <div><dt>Mensagens</dt><dd>{atual.total_mensagens}</dd></div>
                </dl>
                <span className="conv-det-titulo">Linha do tempo</span>
                <div className="linha-tempo">
                  {det.eventos.length === 0 && <span className="conv-sub">Sem eventos ainda.</span>}
                  {det.eventos.map((e, i) => (
                    <div key={i}><i /><span>{hora(e.created_at)} · {EVENTO[e.evento] || e.evento}{e.motivo ? ` (${e.motivo})` : ''}</span></div>
                  ))}
                </div>
              </>
            ) : <span className="conv-sub">Escolha uma conversa.</span>}
          </aside>
        </section>
      )}
    </>
  )
}
