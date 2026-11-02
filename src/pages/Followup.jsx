import { useDados, consultasDaAba } from '../lib/consultas'
import { num, pct, razao } from '../lib/metricas'
import { Barra, Cabecalho, Card, Kpi, Esqueleto } from '../components/Ui'
import { usePeriodo, SeletorPeriodo } from '../components/Periodo'

const NOME = { 1: '1º follow-up (24h)', 2: '2º follow-up (48h)', 3: '3º follow-up (72h)' }
const CORES = ['#3b7bff', '#7ba3f5', '#b8cdfb']

export default function Followup({ cliente }) {
  const p = usePeriodo(30)
  const { dados: r, erro } = useDados(consultasDaAba('followup', cliente, p))
  const d = r?.[0] ?? null

  const tot = d ? d.estagios.reduce((a, s) => ({
    enviados: a.enviados + Number(s.enviados), respostas: a.respostas + Number(s.respostas), conversoes: a.conversoes + Number(s.conversoes),
  }), { enviados: 0, respostas: 0, conversoes: 0 }) : null
  const maxConv = d ? Math.max(...d.estagios.map((s) => razao(Number(s.conversoes), Number(s.enviados)) || 0), 0.0001) : 1
  const topoOnde = d?.onde_parou[0] ? Number(d.onde_parou[0].total) : 1

  return (
    <>
      <Cabecalho titulo="Follow-up" sub="Reativação de conversas em 24h, 48h e 72h.">
        <SeletorPeriodo p={p} />
      </Cabecalho>

      {!cliente.followup_ativo && (
        <section className="aviso">
          <div>
            <b>Follow-up desativado para {cliente.nome}</b>
            <span>Quando a reativação de conversas for ligada, os envios, respostas e agendamentos recuperados aparecem aqui.</span>
          </div>
        </section>
      )}

      {erro && <div className="erro">{erro}</div>}
      {!d && !erro && <Esqueleto />}

      {d && tot && (
        <>
          <section className="kpis" aria-label="Indicadores">
            <Kpi rotulo="Clientes reativadas" valor={num(d.pessoas)} nota="receberam pelo menos um follow-up" />
            <Kpi rotulo="Taxa de resposta" valor={pct(razao(tot.respostas, tot.enviados))} nota={`${num(tot.respostas)} respostas em ${num(tot.enviados)} envios`} />
            <Kpi rotulo="Conversão de follow-up" valor={pct(razao(tot.conversoes, tot.enviados))} nota={`${num(tot.conversoes)} confirmações em ${num(tot.enviados)} envios`} />
            <Kpi rotulo="Agendamentos recuperados" valor={num(tot.conversoes)} nota="dentro de 48h do último follow-up" />
          </section>

          {d.estagios.length === 0 ? (
            <div className="card vazio">Nenhum follow-up enviado no período.</div>
          ) : (
            <>
              <section className="linha">
                <Card className="f3" titulo="Resultado por estágio">
                  <div className="rolagem">
                    <table className="tabela">
                      <thead><tr><th>Estágio</th><th className="dir">Enviados</th><th className="dir">Respostas</th><th className="dir">Taxa de resposta</th><th className="dir">Conversões</th><th className="dir">Taxa de conversão</th></tr></thead>
                      <tbody>
                        {d.estagios.map((s) => (
                          <tr key={s.estagio}>
                            <td><b>{NOME[s.estagio] || `${s.estagio}º follow-up`}</b></td>
                            <td className="dir">{num(s.enviados)}</td>
                            <td className="dir">{num(s.respostas)}</td>
                            <td className="dir">{pct(razao(Number(s.respostas), Number(s.enviados)))}</td>
                            <td className="dir">{num(s.conversoes)}</td>
                            <td className="dir"><b>{pct(razao(Number(s.conversoes), Number(s.enviados)))}</b></td>
                          </tr>
                        ))}
                        <tr className="total">
                          <td><b>Total</b></td>
                          <td className="dir"><b>{num(tot.enviados)}</b></td>
                          <td className="dir"><b>{num(tot.respostas)}</b></td>
                          <td className="dir"><b>{pct(razao(tot.respostas, tot.enviados))}</b></td>
                          <td className="dir"><b>{num(tot.conversoes)}</b></td>
                          <td className="dir"><b>{pct(razao(tot.conversoes, tot.enviados))}</b></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="nota">Uma conversão conta para o follow-up quando acontece em até 48h depois do último follow-up enviado. Se houver outro follow-up no caminho, ela vai para o mais recente.</p>
                </Card>

                <Card className="f2" titulo="Conversão por estágio">
                  <div className="colunas" role="img"
                    aria-label={'Conversão: ' + d.estagios.map((s) => `${pct(razao(Number(s.conversoes), Number(s.enviados)))} no estágio ${s.estagio}`).join(', ')}>
                    {d.estagios.map((s, i) => {
                      const t = razao(Number(s.conversoes), Number(s.enviados)) || 0
                      return (
                        <div key={s.estagio}>
                          <span>{pct(t)}</span>
                          <i style={{ height: `${(t / maxConv) * 100}%`, background: CORES[i] || CORES[2] }} />
                          <em>{[24, 48, 72][s.estagio - 1] || ''}h</em>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </section>

              <Card titulo="Onde a cliente parou antes do follow-up">
                <div className="lista">
                  {d.onde_parou.map((x) => (
                    <Barra key={x.onde} rotulo={x.onde} valor={num(x.total)} largura={(Number(x.total) / topoOnde) * 100} />
                  ))}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </>
  )
}
