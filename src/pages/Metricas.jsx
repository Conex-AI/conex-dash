import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { carregarDashboard, carregarMetricasTela } from '../api'
import { indicadores, deltaPts, duracao, decimal, num, pct, razao } from '../lib/metricas'
import { Barra, Cabecalho, Card, Kpi } from '../components/Ui'
import { usePeriodo, SeletorPeriodo } from '../components/Periodo'

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const FAIXAS = ['0h–6h', '6h–12h', '12h–18h', '18h–24h']

export default function Metricas({ cliente }) {
  const p = usePeriodo(30)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    setDados(null); setErro('')
    Promise.all([
      carregarMetricasTela(cliente.id, p.de, p.ate),
      carregarDashboard(cliente.id, p.de, p.ate),
      carregarDashboard(cliente.id, p.antDe, p.antAte),
    ])
      .then(([m, atual, anterior]) => ativo && setDados({ m, atual, anterior }))
      .catch((e) => ativo && setErro(e.message))
    return () => { ativo = false }
  }, [cliente.id, p.de, p.ate, p.antDe, p.antAte])

  const v = useMemo(() => {
    if (!dados) return null
    const { m, atual, anterior } = dados
    const k = indicadores(atual)
    const a = indicadores(anterior)
    const esperados = atual.motivos.filter((x) => x.tipo === 'esperado').sort((a, b) => Number(b.total) - Number(a.total))
    const totalEsp = esperados.reduce((s, x) => s + Number(x.total), 0)
    const celula = {}
    let topo = 0
    for (const c of m.mapa) { celula[`${c.dia}-${c.faixa}`] = Number(c.n); topo = Math.max(topo, Number(c.n)) }
    return {
      m, k,
      chipSucesso: deltaPts(k.taxaSucesso, a.taxaSucesso),
      semanas: m.semanas.map((s) => ({
        rotulo: s.semana.slice(8, 10) + '/' + s.semana.slice(5, 7),
        taxa: Math.round((razao(Number(s.sucessos), Number(s.conversas)) || 0) * 1000) / 10,
      })),
      esperados, totalEsp, celula, topo,
    }
  }, [dados])

  return (
    <>
      <Cabecalho titulo="Métricas" sub="Como a Jú atende: resolução, repasses e quando as clientes chamam.">
        <SeletorPeriodo p={p} />
      </Cabecalho>
      {erro && <div className="erro">{erro}</div>}
      {!v && !erro && <div className="carregando">Carregando…</div>}

      {v && (
        <>
          <section className="kpis" aria-label="Indicadores">
            <Kpi rotulo="Tempo da 1ª resposta" valor={duracao(v.m.primeira_resposta_seg)} nota="mediana, a Jú responde 24 horas" />
            <Kpi rotulo="Mensagens por conversa" valor={decimal(v.m.msgs_por_conversa)}
              nota={v.m.msgs_por_conversa_mediana == null ? 'média do período' : `mediana de ${decimal(v.m.msgs_por_conversa_mediana, 0)}`} />
            <Kpi rotulo="Tempo até o repasse" valor={v.m.minutos_ate_repasse == null ? '—' : duracao(v.m.minutos_ate_repasse * 60)} nota="do primeiro contato ao repasse" />
            <Kpi rotulo="Taxa de sucesso" valor={pct(v.k.taxaSucesso)} chip={v.chipSucesso} nota={`${num(v.k.sucessos)} de ${num(v.k.conversas)} conversas`} />
          </section>

          <section className="linha">
            <Card className="f3" titulo="Taxa de sucesso por semana">
              {v.semanas.length === 0 ? <div className="vazio">Sem conversas no período.</div> : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={v.semanas} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="#2f343f" vertical={false} />
                      <XAxis dataKey="rotulo" stroke="#9aa2b1" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis stroke="#9aa2b1" tickLine={false} axisLine={false} fontSize={12} domain={[0, 100]} unit="%" />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(x) => [`${String(x).replace('.', ',')}%`, 'Sucesso']}
                        labelFormatter={(l) => `Semana de ${l}`}
                        contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }} />
                      <Bar dataKey="taxa" fill="#3b7bff" radius={[6, 6, 0, 0]} maxBarSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="f2" titulo="Por que a Jú repassou">
              {v.esperados.length === 0 ? <div className="vazio">Nenhum repasse no período.</div> : (
                <div className="lista">
                  {v.esperados.map((x) => (
                    <Barra key={x.motivo} rotulo={x.motivo} valor={num(x.total)} pct={pct(Number(x.total) / v.totalEsp)}
                      largura={(Number(x.total) / Number(v.esperados[0].total)) * 100} />
                  ))}
                </div>
              )}
              <p className="nota">São os {num(v.totalEsp)} repasses esperados do período. Todos contam como sucesso.</p>
            </Card>
          </section>

          <section className="linha">
            <Card className="f1" titulo="Procedimentos mais procurados">
              {v.m.procedimentos.length === 0 ? <div className="vazio">Nenhum procedimento definido no período.</div> : (
                <div className="rolagem">
                  <table className="tabela">
                    <thead><tr><th>Procedimento</th><th className="dir">Conversas</th><th className="dir">Agendadas</th><th className="dir">Conversão</th></tr></thead>
                    <tbody>
                      {v.m.procedimentos.map((x) => (
                        <tr key={x.procedimento}>
                          <td><b>{x.procedimento}</b></td>
                          <td className="dir">{num(x.conversas)}</td>
                          <td className="dir">{num(x.agendadas)}</td>
                          <td className="dir"><b>{pct(razao(Number(x.agendadas), Number(x.conversas)))}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="nota">Conversão = agendamentos confirmados sobre conversas do procedimento. {num(v.m.sem_procedimento)} conversas ficaram sem procedimento definido.</p>
            </Card>

            <Card className="f1" titulo="Quando as clientes chamam">
              <div className="rolagem">
                <table className="mapa" aria-label="Mensagens das clientes por dia da semana e faixa de horário">
                  <thead><tr><th />{FAIXAS.map((f) => <th key={f}>{f}</th>)}</tr></thead>
                  <tbody>
                    {DIAS.map((d, i) => (
                      <tr key={d}>
                        <th>{d}</th>
                        {FAIXAS.map((f, j) => {
                          const n = v.celula[`${i + 1}-${j}`] || 0
                          const forca = v.topo ? n / v.topo : 0
                          return (
                            <td key={f} style={{ background: `rgba(59, 123, 255, ${0.08 + forca * 0.8})`, color: forca > 0.5 ? '#fff' : 'var(--text-2)' }}>
                              {n}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="nota">Mensagens enviadas pelas clientes no período, no horário de Brasília.</p>
            </Card>
          </section>
        </>
      )}
    </>
  )
}
