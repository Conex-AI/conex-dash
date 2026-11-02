import { useEffect, useState } from 'react'
import { carregarPix } from '../api'
import { TZ } from '../lib/datas'
import { duracao, num, pct, razao, reais, capitaliza } from '../lib/metricas'
import { Barra, Cabecalho, Card, Chip, Kpi } from '../components/Ui'
import { usePeriodo, SeletorPeriodo } from '../components/Periodo'

function quando(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const hoje = new Date().toLocaleDateString('sv', { timeZone: TZ })
  const ontem = new Date(Date.now() - 864e5).toLocaleDateString('sv', { timeZone: TZ })
  const dia = d.toLocaleDateString('sv', { timeZone: TZ })
  const h = d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  if (dia === hoje) return `hoje ${h}`
  if (dia === ontem) return `ontem ${h}`
  return `${d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: 'short' }).replace('.', '')} ${h}`
}

function valorTexto(v) {
  if (v === null || v === undefined || v === '') return '—'
  const s = String(v)
  return /^\d+([.,]\d+)?$/.test(s) ? reais(Number(s.replace(',', '.'))) : s
}

export default function Pix({ cliente }) {
  const p = usePeriodo(30)
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    setD(null); setErro('')
    carregarPix(cliente.id, p.de, p.ate)
      .then((x) => ativo && setD(x))
      .catch((e) => ativo && setErro(e.message))
    return () => { ativo = false }
  }, [cliente.id, p.de, p.ate])

  const topo = d ? Math.max(Number(d.solicitados), Number(d.comprovantes), 1) : 1
  const semComprovante = d ? Math.max(0, Number(d.solicitados) - Number(d.comprovantes)) : 0

  return (
    <>
      <Cabecalho titulo="Pix" sub="Sinal de reserva: do pedido do Pix ao agendamento confirmado.">
        <SeletorPeriodo p={p} />
      </Cabecalho>
      {erro && <div className="erro">{erro}</div>}
      {!d && !erro && <div className="carregando">Carregando…</div>}

      {d && (
        <>
          <section className="kpis" aria-label="Indicadores">
            <Kpi rotulo="Sinais solicitados" valor={num(d.solicitados)} nota="clientes que receberam a chave Pix" />
            <Kpi rotulo="Comprovantes recebidos" valor={num(d.comprovantes)} nota={`${pct(razao(Number(d.comprovantes), Number(d.solicitados)))} dos pedidos`} />
            <Kpi rotulo="Confirmados pela Juliana" valor={num(d.confirmados)} nota={d.valor_confirmado ? `${reais(d.valor_confirmado)} em sinais` : 'agendamento confirmado'} />
            <Kpi rotulo="Parados há mais de 2h" valor={num(d.parados_2h)} nota="comprovante sem confirmação" />
          </section>

          <section className="linha">
            <Card className="f2" titulo="Do pedido ao agendamento">
              <div className="lista">
                <Barra rotulo="Chave Pix enviada" valor={num(d.solicitados)} largura={(Number(d.solicitados) / topo) * 100} />
                <Barra rotulo="Comprovante recebido" valor={num(d.comprovantes)} pct={pct(razao(Number(d.comprovantes), Number(d.solicitados)))} largura={(Number(d.comprovantes) / topo) * 100} />
                <Barra rotulo="Agendamento confirmado" valor={num(d.confirmados)} pct={pct(razao(Number(d.confirmados), Number(d.solicitados)))} largura={(Number(d.confirmados) / topo) * 100} />
              </div>
              {semComprovante > 0 && (
                <p className="nota">{num(semComprovante)} pessoas receberam a chave e não mandaram comprovante. São a oportunidade: o Follow-up pode retomar esses casos.</p>
              )}
            </Card>

            <Card className="f1" titulo="Quanto demora">
              <div className="stats">
                <div><span>Até a cliente enviar o comprovante</span><b>{d.minutos_ate_comprovante == null ? '—' : duracao(d.minutos_ate_comprovante * 60)}</b></div>
                <div><span>Até a Juliana confirmar o agendamento</span><b>{d.minutos_ate_confirmar == null ? '—' : duracao(d.minutos_ate_confirmar * 60)}</b></div>
                <div><span>Comprovantes parados há mais de 2h</span><b>{num(d.parados_2h)}</b></div>
              </div>
              <p className="nota">Valores são medianas do período.</p>
            </Card>
          </section>

          <Card titulo="Comprovantes recentes" direita={<span className="conv-sub">{Math.min(d.recentes.length, 20)} de {num(d.comprovantes)} no período</span>}>
            {d.recentes.length === 0 ? <div className="vazio">Nenhum comprovante no período.</div> : (
              <div className="rolagem">
                <table className="tabela">
                  <thead><tr><th>Cliente</th><th>Procedimento</th><th>Valor</th><th>Recebido</th><th>Situação</th><th>Confirmação</th></tr></thead>
                  <tbody>
                    {d.recentes.map((r) => (
                      <tr key={r.telefone + r.recebido_em}>
                        <td><b>{r.nome_wpp || '—'}</b></td>
                        <td>{capitaliza(r.procedimento) || '—'}</td>
                        <td>{valorTexto(r.valor)}</td>
                        <td>{quando(r.recebido_em)}</td>
                        <td>{r.confirmado_em ? <Chip tom="verde">Confirmado</Chip> : <Chip tom="laranja">Pendente de conferência</Chip>}</td>
                        <td>{r.confirmado_em ? quando(r.confirmado_em) : 'Aguardando Juliana'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card titulo="Como a Jú confere o comprovante">
            <div className="confere">
              <div><b>Valor</b><span>Precisa ser o do sinal. Valor diferente vai para a Juliana decidir.</span></div>
              <div><b>Data</b><span>Precisa ser de hoje. Comprovante antigo volta para a cliente refazer o Pix.</span></div>
              <div><b>Favorecido</b><span>Precisa ser a conta combinada. Quem confirma o pagamento é sempre a Juliana.</span></div>
            </div>
          </Card>
        </>
      )}
    </>
  )
}
