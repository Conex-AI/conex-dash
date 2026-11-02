import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { carregarDashboard, carregarMetricas, carregarMetricasTela, carregarPix, carregarFollowup } from '../api'
import {
  indicadores, deltaPct, deltaPts, deltaAbs, etapasFunil, serieDiaria, horariosPico,
  duracao, decimal, num, pct, razao, reais, rotuloMotivo, capitaliza,
} from '../lib/metricas'
import { Barra, Cabecalho, Card, Kpi } from '../components/Ui'
import { usePeriodo, SeletorPeriodo } from '../components/Periodo'
import { distribuicao, GraficoDiario, ComoTerminaram, Funil, Motivos, Pico, PixAtendimento } from '../components/Blocos'
import { baixarCsv } from './Dashboard'

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const FAIXAS = ['0h–6h', '6h–12h', '12h–18h', '18h–24h']
const TOOLTIP = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }

function Secao({ titulo, sub }) {
  return (
    <div className="secao">
      <h2>{titulo}</h2>
      {sub && <span>{sub}</span>}
    </div>
  )
}

export default function Metricas({ cliente, irPara }) {
  const p = usePeriodo()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    setDados(null); setErro('')
    Promise.all([
      carregarMetricasTela(cliente.id, p.de, p.ate),
      carregarDashboard(cliente.id, p.de, p.ate),
      carregarDashboard(cliente.id, p.antDe, p.antAte),
      carregarMetricas(cliente.id, p.de),
      carregarPix(cliente.id, p.de, p.ate),
      cliente.followup_ativo ? carregarFollowup(cliente.id, p.de, p.ate) : Promise.resolve(null),
    ])
      .then(([m, atual, anterior, diario, pix, fup]) => ativo && setDados({ m, atual, anterior, diario: diario.filter((r) => r.dia <= p.ate), pix, fup }))
      .catch((e) => ativo && setErro(e.message))
    return () => { ativo = false }
  }, [cliente.id, cliente.followup_ativo, p.de, p.ate, p.antDe, p.antAte])

  const v = useMemo(() => {
    if (!dados) return null
    const { m, atual, anterior, fup } = dados
    const k = indicadores(atual)
    const a = indicadores(anterior)
    const esperados = atual.motivos.filter((x) => x.tipo === 'esperado').sort((x, y) => Number(y.total) - Number(x.total))
    const totalEsp = esperados.reduce((s, x) => s + Number(x.total), 0)
    const celula = {}
    let topo = 0
    for (const c of m.mapa) { celula[`${c.dia}-${c.faixa}`] = Number(c.n); topo = Math.max(topo, Number(c.n)) }
    const totFup = fup?.estagios.reduce((t, s) => ({
      enviados: t.enviados + Number(s.enviados), respostas: t.respostas + Number(s.respostas), conversoes: t.conversoes + Number(s.conversoes),
    }), { enviados: 0, respostas: 0, conversoes: 0 })
    return {
      m, k, totFup,
      chips: {
        conversas: deltaPct(k.conversas, a.conversas),
        sucesso: deltaPts(k.taxaSucesso, a.taxaSucesso),
        conversao: deltaPts(k.taxaConversao, a.taxaConversao),
        falhas: deltaAbs(k.falhas, a.falhas, true),
      },
      serie: serieDiaria(dados.diario, p.de, p.ate),
      etapas: etapasFunil(atual.funil),
      pico: horariosPico(atual.horas),
      dist: distribuicao(atual.desfechos, k.conversas),
      semanas: m.semanas.map((s) => ({
        rotulo: s.semana.slice(8, 10) + '/' + s.semana.slice(5, 7),
        taxa: Math.round((razao(Number(s.sucessos), Number(s.conversas)) || 0) * 1000) / 10,
      })),
      esperados, totalEsp, celula, topo,
    }
  }, [dados, p.de, p.ate])

  const d = dados?.atual
  const pix = dados?.pix
  const topoPix = pix ? Math.max(Number(pix.solicitados), Number(pix.comprovantes), 1) : 1

  return (
    <>
      <Cabecalho titulo="Métricas" sub="Todos os números do atendimento da Jú no período escolhido.">
        <SeletorPeriodo p={p} />
        <button className="btn-claro" onClick={() => baixarCsv(dados.diario, `conex-${cliente.slug}-metricas-${p.de}-a-${p.ate}.csv`)} disabled={!dados}>Exportar</button>
      </Cabecalho>
      {erro && <div className="erro">{erro}</div>}
      {!v && !erro && <div className="carregando">Carregando…</div>}

      {v && (
        <>
          <Secao titulo="Visão geral" sub="Comparado com o período anterior do mesmo tamanho" />
          <section className="kpis" aria-label="Visão geral">
            <Kpi rotulo="Conversas" valor={num(v.k.conversas)} chip={v.chips.conversas} nota="vs. período anterior" />
            <Kpi rotulo="Taxa de sucesso" valor={pct(v.k.taxaSucesso)} chip={v.chips.sucesso} nota={`${num(v.k.sucessos)} de ${num(v.k.conversas)} conversas`} />
            <Kpi rotulo="Conversão" valor={pct(v.k.taxaConversao)} chip={v.chips.conversao} nota={`${num(v.k.conversoes)} agendamentos confirmados`} />
            <Kpi rotulo="Repasses por falha" valor={num(v.k.falhas)} chip={v.chips.falhas} nota={`${pct(v.k.taxaFalha)} das conversas`} />
          </section>
          <section className="linha">
            <GraficoDiario serie={v.serie} />
            <ComoTerminaram dist={v.dist} />
          </section>

          <Secao titulo="Atendimento da Jú" sub="Velocidade e ritmo das conversas" />
          <section className="kpis" aria-label="Atendimento">
            <Kpi rotulo="Tempo da 1ª resposta" valor={duracao(v.m.primeira_resposta_seg)} nota="mediana, a Jú responde 24 horas" />
            <Kpi rotulo="Mensagens por conversa" valor={decimal(v.m.msgs_por_conversa)}
              nota={v.m.msgs_por_conversa_mediana == null ? 'média do período' : `média · mediana de ${decimal(v.m.msgs_por_conversa_mediana, 0)}`} />
            <Kpi rotulo="Tempo até o repasse" valor={v.m.minutos_ate_repasse == null ? '—' : duracao(v.m.minutos_ate_repasse * 60)} nota="do primeiro contato ao repasse" />
            <Kpi rotulo="Resolvidas sem humano" valor={num(v.dist[0].n)} nota={`${pct(v.dist[0].pct)} das conversas`} />
          </section>
          <section className="linha">
            <Card className="f3" titulo="Taxa de sucesso por semana">
              {v.semanas.length === 0 ? <div className="vazio">Sem conversas no período.</div> : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={v.semanas} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} domain={[0, 100]} unit="%" />
                      <Tooltip cursor={{ fill: 'var(--primary-soft)' }} formatter={(x) => [`${String(x).replace('.', ',')}%`, 'Sucesso']}
                        labelFormatter={(l) => `Semana de ${l}`} contentStyle={TOOLTIP} />
                      <Bar dataKey="taxa" fill="#3b7bff" radius={[6, 6, 0, 0]} maxBarSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
            <PixAtendimento d={d} className="f2" />
          </section>

          <Secao titulo="Repasses para a Juliana" sub="Repasse esperado é sucesso; repasse por falha é quando a Jú não soube seguir" />
          <section className="linha">
            <Card className="f1" titulo="Por que a Jú repassou">
              {v.esperados.length === 0 ? <div className="vazio">Nenhum repasse esperado no período.</div> : (
                <div className="lista">
                  {v.esperados.map((x) => (
                    <Barra key={x.motivo} rotulo={rotuloMotivo(x.motivo)} valor={num(x.total)} pct={pct(Number(x.total) / v.totalEsp)}
                      largura={(Number(x.total) / Number(v.esperados[0].total)) * 100} />
                  ))}
                </div>
              )}
              <p className="nota">São os {num(v.totalEsp)} repasses esperados do período. Todos contam como sucesso.</p>
            </Card>
            <Motivos motivos={d.motivos} />
          </section>

          <Secao titulo="Agendamento" sub="Cada pessoa conta uma vez, na etapa mais avançada" />
          <section className="linha">
            <Funil etapas={v.etapas} />
            <Card className="f1" titulo="Procedimentos mais procurados">
              {v.m.procedimentos.length === 0 ? <div className="vazio">Nenhum procedimento definido no período.</div> : (
                <div className="rolagem">
                  <table className="tabela">
                    <thead><tr><th>Procedimento</th><th className="dir">Conversas</th><th className="dir">Agendadas</th><th className="dir">Conversão</th></tr></thead>
                    <tbody>
                      {v.m.procedimentos.map((x) => (
                        <tr key={x.procedimento}>
                          <td><b>{capitaliza(x.procedimento)}</b></td>
                          <td className="dir">{num(x.conversas)}</td>
                          <td className="dir">{num(x.agendadas)}</td>
                          <td className="dir"><b>{pct(razao(Number(x.agendadas), Number(x.conversas)))}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="nota">Conversão = agendamentos confirmados sobre conversas do procedimento. {num(v.m.sem_procedimento)} {Number(v.m.sem_procedimento) === 1 ? 'conversa ficou' : 'conversas ficaram'} sem procedimento definido.</p>
            </Card>
          </section>

          <Secao titulo="Quando as clientes chamam" sub="Mensagens enviadas pelas clientes no período, no horário de Brasília" />
          <section className="linha">
            <Card className="f2" titulo="Dia da semana e horário">
              <div className="rolagem">
                <table className="mapa" aria-label="Mensagens das clientes por dia da semana e faixa de horário">
                  <thead><tr><th />{FAIXAS.map((f) => <th key={f}>{f}</th>)}</tr></thead>
                  <tbody>
                    {DIAS.map((dia, i) => (
                      <tr key={dia}>
                        <th>{dia}</th>
                        {FAIXAS.map((f, j) => {
                          const n = v.celula[`${i + 1}-${j}`] || 0
                          const forca = v.topo ? n / v.topo : 0
                          return (
                            <td key={f} style={{ background: `rgba(59, 123, 255, ${0.08 + forca * 0.8})`, color: forca > 0.5 ? '#fff' : 'var(--text-2)' }}>{n}</td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Pico pico={v.pico} />
          </section>

          <Secao titulo="Pix" sub="Do envio da chave ao agendamento confirmado" />
          <section className="kpis" aria-label="Pix">
            <Kpi rotulo="Sinais solicitados" valor={num(pix.solicitados)} nota="clientes que receberam a chave Pix" />
            <Kpi rotulo="Comprovantes recebidos" valor={num(pix.comprovantes)} nota={`${pct(razao(Number(pix.comprovantes), Number(pix.solicitados)))} dos pedidos`} />
            <Kpi rotulo="Confirmados pela Juliana" valor={num(pix.confirmados)} nota={pix.valor_confirmado ? `${reais(pix.valor_confirmado)} em sinais` : 'agendamento confirmado'} />
            <Kpi rotulo="Parados há mais de 2h" valor={num(pix.parados_2h)} nota="comprovante sem confirmação" />
          </section>
          <section className="linha">
            <Card className="f2" titulo="Do pedido ao agendamento">
              <div className="lista">
                <Barra rotulo="Chave Pix enviada" valor={num(pix.solicitados)} largura={(Number(pix.solicitados) / topoPix) * 100} />
                <Barra rotulo="Comprovante recebido" valor={num(pix.comprovantes)} pct={pct(razao(Number(pix.comprovantes), Number(pix.solicitados)))} largura={(Number(pix.comprovantes) / topoPix) * 100} />
                <Barra rotulo="Agendamento confirmado" valor={num(pix.confirmados)} pct={pct(razao(Number(pix.confirmados), Number(pix.solicitados)))} largura={(Number(pix.confirmados) / topoPix) * 100} />
              </div>
            </Card>
            <Card className="f1" titulo="Quanto demora">
              <div className="stats">
                <div><span>Até a cliente enviar o comprovante</span><b>{pix.minutos_ate_comprovante == null ? '—' : duracao(pix.minutos_ate_comprovante * 60)}</b></div>
                <div><span>Até a Juliana confirmar</span><b>{pix.minutos_ate_confirmar == null ? '—' : duracao(pix.minutos_ate_confirmar * 60)}</b></div>
                <div><span>Pendentes agora (últimos 7 dias)</span><b>{num(d.pix.pendentes)}</b></div>
              </div>
              <p className="nota">Valores são medianas do período.</p>
            </Card>
          </section>

          <Secao titulo="Follow-up" sub="Reativação de conversas em 24h, 48h e 72h" />
          {!cliente.followup_ativo || !v.totFup ? (
            <section className="aviso">
              <div>
                <b>Follow-up desativado para {cliente.nome}</b>
                <span>Quando a reativação de conversas for ligada, envios, respostas e agendamentos recuperados aparecem aqui.</span>
              </div>
              <button className="btn-claro" onClick={() => irPara('followup')}>Ver Follow-up</button>
            </section>
          ) : (
            <section className="kpis" aria-label="Follow-up">
              <Kpi rotulo="Clientes reativadas" valor={num(dados.fup.pessoas)} nota="receberam pelo menos um follow-up" />
              <Kpi rotulo="Taxa de resposta" valor={pct(razao(v.totFup.respostas, v.totFup.enviados))} nota={`${num(v.totFup.respostas)} respostas em ${num(v.totFup.enviados)} envios`} />
              <Kpi rotulo="Conversão de follow-up" valor={pct(razao(v.totFup.conversoes, v.totFup.enviados))} nota={`${num(v.totFup.conversoes)} confirmações`} />
              <Kpi rotulo="Agendamentos recuperados" valor={num(v.totFup.conversoes)} nota="dentro de 48h do último follow-up" />
            </section>
          )}
        </>
      )}
    </>
  )
}
