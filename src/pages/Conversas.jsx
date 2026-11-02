import { useEffect, useMemo, useState } from 'react'
import { carregarConversas, carregarMensagens, carregarEventos } from '../api'
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
const rotuloMsg = (m) => m.conteudo || ({ audio: '[áudio]', imagem: '[imagem]', foto_enviada: '[foto enviada]', video_enviado: '[vídeo enviado]' }[m.tipo] || '[mídia]')

export default function Conversas({ cliente }) {
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [sel, setSel] = useState(null)
  const [det, setDet] = useState(null)
  const [erroDet, setErroDet] = useState('')

  useEffect(() => {
    let ativo = true
    setLinhas(null); setErro(''); setSel(null)
    carregarConversas(cliente.id)
      .then((d) => { if (!ativo) return; setLinhas(d); setSel(d[0]?.telefone ?? null) })
      .catch((e) => ativo && setErro(e.message))
    return () => { ativo = false }
  }, [cliente.id])

  useEffect(() => {
    if (!sel) { setDet(null); return }
    let ativo = true
    setDet(null); setErroDet('')
    Promise.all([carregarMensagens(cliente.id, sel), carregarEventos(cliente.id, sel)])
      .then(([mensagens, eventos]) => ativo && setDet({ mensagens, eventos }))
      .catch((e) => ativo && setErroDet(e.message))
    return () => { ativo = false }
  }, [cliente.id, sel])

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

  // separa o chat por dia
  const grupos = useMemo(() => {
    const g = []
    for (const m of det?.mensagens || []) {
      const d = dia(m.created_at)
      if (!g.length || g[g.length - 1].dia !== d) g.push({ dia: d, msgs: [] })
      g[g.length - 1].msgs.push(m)
    }
    return g
  }, [det])

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
                <button key={c.telefone} className={`conv-item ${c.telefone === sel ? 'ativa' : ''}`} onClick={() => setSel(c.telefone)}>
                  <span className="conv-linha"><b>{c.nome_wpp || mascara(c.telefone)}</b><em>{quando(c.ultima_msg_em)}</em></span>
                  <span className="conv-sub">{c.total_mensagens} mensagens</span>
                  <Chip tom={tom}>{rotulo}</Chip>
                </button>
              )
            })}
          </div>

          <div className="conv-chat">
            {!atual && <div className="vazio">Escolha uma conversa na lista.</div>}
            {atual && (
              <>
                <div className="conv-topo">
                  <div>
                    <b>{atual.nome_wpp || 'Sem nome'}</b>
                    <span>{mascara(atual.telefone)}</span>
                  </div>
                  {resumo && <Chip tom="azul">{resumo.desfecho}</Chip>}
                </div>
                {erroDet && <div className="erro">{erroDet}</div>}
                {!det && !erroDet && <div className="carregando">Carregando…</div>}
                {det && (
                  <div className="conv-msgs">
                    {grupos.map((g) => (
                      <div key={g.dia} className="conv-dia">
                        <span className="conv-data">{new Date(g.dia + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long' })}</span>
                        {g.msgs.map((m) => (
                          <div key={m.id ?? m.created_at} className={`bolha ${m.origem}`}>
                            <span className="bolha-quem">{QUEM[m.origem] || m.origem} · {hora(m.created_at)}</span>
                            <div>{rotuloMsg(m)}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                    {det.mensagens.length === 0 && <div className="vazio">Sem mensagens guardadas nessa conversa.</div>}
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
