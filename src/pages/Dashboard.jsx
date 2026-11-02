import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { carregarMetricas, carregarDashboard } from '../api'
import { hojeSP, somaDias } from '../lib/datas'
import {
  indicadores, deltaPct, deltaPts, deltaAbs, etapasFunil, serieDiaria, horariosPico, csvDiario, num, pct,
} from '../lib/metricas'
import { Barra, Cabecalho, Card, Chip, Kpi } from '../components/Ui'

const PERIODOS = [
  { id: 7, nome: '7 dias' },
  { id: 30, nome: '30 dias' },
  { id: 90, nome: '90 dias' },
]
const COR = { azul: '#3b7bff', verde: '#2fbf71', vermelho: '#ef5b5b', cinza: 'var(--neutral)' }

function dataCurta(iso) {
  return new Date(iso + 'T12:00:00Z')
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .replace(/\./g, '')
}

export default function Dashboard({ cliente, irPara }) {
  const [dias, setDias] = useState(30)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  const ate = hojeSP()
  const de = somaDias(ate, -(dias - 1))

  useEffect(() => {
    let ativo = true
    setDados(null); setErro('')
    const antAte = somaDias(de, -1)
    const antDe = somaDias(antAte, -(dias - 1))
    Promise.all([
      carregarMetricas(cliente.id, de),
      carregarDashboard(cliente.id, de, ate),
      carregarDashboard(cliente.id, antDe, antAte),
    ])
      .then(([diario, atual, anterior]) => ativo && setDados({ diario, atual, anterior }))
      .catch((e) => ativo && setErro(e.message))
    return () => { ativo = false }
  }, [cliente.id, de, ate, dias])

  const v = useMemo(() => {
    if (!dados) return null
    const k = indicadores(dados.atual)
    const a = indicadores(dados.anterior)
    const d = dados.atual.desfechos
    const total = Math.max(k.conversas, 1)
    return {
      k,
      chips: {
        conversas: deltaPct(k.conversas, a.conversas),
        sucesso: deltaPts(k.taxaSucesso, a.taxaSucesso),
        conversao: deltaPts(k.taxaConversao, a.taxaConversao),
        falhas: deltaAbs(k.falhas, a.falhas, true),
      },
      serie: serieDiaria(dados.diario, de, ate),
      etapas: etapasFunil(dados.atual.funil),
      pico: horariosPico(dados.atual.horas),
      dist: [
        ['Resolvidas sem humano', d.resolvida, COR.verde],
        ['Repasse esperado', d.esperado, COR.azul],
        ['Repasse por falha', d.falha, COR.vermelho],
        ['Sem desfecho', d.sem_desfecho, COR.cinza],
      ].map(([nome, n, cor]) => ({ nome, n: Number(n), cor, pct: Number(n) / total })),
    }
  }, [dados, de, ate])

  function exportar() {
    const blob = new Blob([csvDiario(dados.diario)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `conex-${cliente.slug}-${de}-a-${ate}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const d = dados?.atual
  return (
    <>
      <Cabecalho titulo="Dashboard" sub={`${cliente.nome} · atendimento no WhatsApp`}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{dataCurta(de)} a {dataCurta(ate)}</span>
        <div className="periodo">
          {PERIODOS.map((p) => (
            <button key={p.id} className={dias === p.id ? 'ativa' : ''} onClick={() => setDias(p.id)}>{p.nome}</button>
          ))}
        </div>
        <button className="btn-claro" onClick={exportar} disabled={!dados}>Exportar</button>
      </Cabecalho>

      {erro && <div className="erro">{erro}</div>}
      {!v && !erro && <div className="carregando">Carregando…</div>}

      {v && (
        <>
          <section className="kpis" aria-label="Indicadores">
            <Kpi rotulo="Conversas" valor={num(v.k.conversas)} chip={v.chips.conversas} nota="vs. período anterior" />
            <Kpi rotulo="Taxa de sucesso" valor={pct(v.k.taxaSucesso)} chip={v.chips.sucesso} nota={`${num(v.k.sucessos)} de ${num(v.k.conversas)} conversas`} />
            <Kpi rotulo="Conversão" valor={pct(v.k.taxaConversao)} chip={v.chips.conversao} nota={`${num(v.k.conversoes)} agendamentos confirmados`} />
            <Kpi rotulo="Repasses por falha" valor={num(v.k.falhas)} chip={v.chips.falhas} nota={`${pct(v.k.taxaFalha)} das conversas`} />
          </section>

          <section className="linha">
            <Card className="f3" titulo="Conversas por dia" direita={
              <span className="legenda">
                <span><i style={{ background: COR.azul }} />Conversas</span>
                <span><i style={{ background: COR.verde }} />Confirmadas</span>
              </span>}>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={v.serie} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#2f343f" vertical={false} />
                    <XAxis dataKey="rotulo" stroke="#9aa2b1" tickLine={false} axisLine={false} fontSize={12}
                      interval={Math.max(0, Math.floor(v.serie.length / 8) - 1)} />
                    <YAxis stroke="#9aa2b1" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }} />
                    <Line type="monotone" dataKey="Conversas" stroke={COR.azul} strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="Confirmadas" stroke={COR.verde} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="f2" titulo="Como as conversas terminaram">
              <div className="dist" role="img"
                aria-label={'Distribuição: ' + v.dist.map((x) => `${pct(x.pct)} ${x.nome.toLowerCase()}`).join(', ')}>
                {v.dist.filter((x) => x.n > 0).map((x) => <span key={x.nome} style={{ width: `${x.pct * 100}%`, background: x.cor }} />)}
              </div>
              <div className="lista" style={{ gap: 12 }}>
                {v.dist.map((x) => (
                  <div className="dist-linha" key={x.nome}>
                    <i style={{ background: x.cor }} /><span>{x.nome}</span><b>{num(x.n)}</b><em>{pct(x.pct)}</em>
                  </div>
                ))}
              </div>
              <p className="nota">Repasse esperado (comprovante de Pix, escolha de horário, desconto) conta como sucesso, não como falha.</p>
            </Card>
          </section>

          <section className="linha">
            <Card className="f1" titulo="Funil de agendamento">
              <div className="lista">
                {v.etapas.map((e) => <Barra key={e.nome} rotulo={e.nome} valor={num(e.valor)} pct={e.pct} largura={e.largura} />)}
              </div>
            </Card>

            <Card className="f1" titulo="Motivos de repasse">
              {d.motivos.length === 0 ? <div className="vazio">Nenhum repasse no período.</div> : (
                <div className="rolagem">
                  <table className="tabela">
                    <thead><tr><th>Motivo</th><th>Tipo</th><th className="dir">Total</th></tr></thead>
                    <tbody>
                      {d.motivos.map((m) => (
                        <tr key={m.motivo + m.tipo}>
                          <td>{m.motivo}</td>
                          <td><Chip tom={m.tipo === 'falha' ? 'vermelho' : 'azul'}>{m.tipo === 'falha' ? 'Falha' : 'Esperado'}</Chip></td>
                          <td className="dir"><b>{num(m.total)}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>

          <section className="linha">
            <Card className="f1" titulo="Horários de pico">
              <div className="pico" role="img"
                aria-label={v.pico.pico ? `Mensagens recebidas por hora, com pico às ${v.pico.pico.h}h` : 'Sem mensagens recebidas no período'}>
                {v.pico.lista.map((x) => (
                  <div key={x.h} className={v.pico.pico && x.h === v.pico.pico.h ? 'max' : ''}
                    style={{ height: `${v.pico.topo ? (x.n / v.pico.topo) * 100 : 0}%` }} title={`${x.h}h: ${x.n}`} />
                ))}
              </div>
              <div className="pico-eixo"><span>8h</span><span>11h</span><span>14h</span><span>17h</span><span>19h</span></div>
              <span className="sub">
                {v.pico.pico ? `Pico às ${v.pico.pico.h}h, com ${num(v.pico.pico.n)} mensagens no período.` : 'Sem mensagens recebidas no período.'}
              </span>
            </Card>

            <Card className="f1" titulo="Procedimentos mais pedidos">
              {d.procedimentos.length === 0 ? <div className="vazio">Nenhum procedimento definido no período.</div> : (
                <div className="lista">
                  {d.procedimentos.map((p) => (
                    <Barra key={p.procedimento} rotulo={p.procedimento} valor={num(p.total)}
                      largura={(Number(p.total) / Number(d.procedimentos[0].total)) * 100} />
                  ))}
                </div>
              )}
            </Card>

            <Card className="f1" titulo="Pix e atendimento">
              <div className="stats">
                <div><span>Comprovantes recebidos</span><b>{num(d.pix.comprovantes)}</b></div>
                <div><span>Pendentes agora</span><b>{num(d.pix.pendentes)}</b></div>
                <div><span>Tempo até confirmar</span><b>{d.pix.minutos_ate_confirmar == null ? '—' : `${Math.round(d.pix.minutos_ate_confirmar)} min`}</b></div>
                <hr />
                <div><span>Mensagens do período</span><b>{num(d.mensagens.total)}</b></div>
                <div><span>Recebidas</span><b>{num(d.mensagens.recebidas)}</b></div>
                <div><span>Enviadas pela Jú</span><b>{num(d.mensagens.ia)}</b></div>
                <div><span>Enviadas pela Juliana</span><b>{num(d.mensagens.humano)}</b></div>
                <div><span>Fotos e vídeos enviados</span><b>{num(d.mensagens.midia)}</b></div>
              </div>
            </Card>
          </section>

          {!cliente.followup_ativo && (
            <section className="aviso">
              <div>
                <b>Follow-up desativado para {cliente.nome}</b>
                <span>Os números de follow-up aparecem aqui quando a reativação de conversas (24h, 48h e 72h) for ligada.</span>
              </div>
              <button className="btn-claro" onClick={() => irPara('followup')}>Ver Follow-up</button>
            </section>
          )}
        </>
      )}
    </>
  )
}
