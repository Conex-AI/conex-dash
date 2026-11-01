import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { carregarMetricas, carregarFunil } from '../api'
import { hojeSP, somaDias } from '../lib/datas'
import { totais, funil, serieDiaria, pct, num } from '../lib/metricas'

const PERIODOS = [
  { id: 7, nome: '7 dias' },
  { id: 30, nome: '30 dias' },
  { id: 90, nome: '90 dias' },
]

function Kpi({ rotulo, valor, nota, cor }) {
  return (
    <div className="card">
      <div className="kpi-rotulo">{rotulo}</div>
      <div className={`kpi-valor ${cor || ''}`}>{valor}</div>
      <div className="kpi-nota">{nota}</div>
    </div>
  )
}

export default function Dashboard({ cliente }) {
  const [dias, setDias] = useState(30)
  const [linhas, setLinhas] = useState(null)
  const [fun, setFun] = useState(null)
  const [erro, setErro] = useState('')

  const ate = hojeSP()
  const de = somaDias(ate, -(dias - 1))

  useEffect(() => {
    let ativo = true
    setLinhas(null); setFun(null); setErro('')
    Promise.all([carregarMetricas(cliente.id, de), carregarFunil(cliente.id, de, ate)])
      .then(([d, f]) => { if (ativo) { setLinhas(d); setFun(f) } })
      .catch((e) => ativo && setErro(e.message))
    return () => { ativo = false }
  }, [cliente.id, de, ate])

  const t = useMemo(() => (linhas ? totais(linhas) : null), [linhas])
  const etapas = useMemo(() => (fun ? funil(fun) : []), [fun])
  const serie = useMemo(() => (linhas ? serieDiaria(linhas, de, ate) : []), [linhas, de, ate])

  return (
    <>
      <div className="cabecalho">
        <div><h1>Dashboard</h1><p>{cliente.nome} · últimos {dias} dias</p></div>
        <div className="spacer" />
        <div className="periodo">
          {PERIODOS.map((p) => (
            <button key={p.id} className={dias === p.id ? 'ativa' : ''} onClick={() => setDias(p.id)}>{p.nome}</button>
          ))}
        </div>
      </div>

      {erro && <div className="erro">{erro}</div>}
      {(!t || !fun) && !erro && <div className="carregando">Carregando…</div>}

      {t && fun && (
        <>
          <div className="grid-kpi">
            <Kpi rotulo="Conversas atendidas" valor={num(fun.conversas)} nota={`${num(t.msgs_cliente + t.msgs_ia + t.msgs_humano)} mensagens trocadas`} />
            <Kpi rotulo="Taxa de resolução" valor={pct(t.taxa_resolucao)} cor="azul"
              nota={`${num(t.sucessos)} resolvidas · ${num(t.repasses_falhos)} com falha`} />
            <Kpi rotulo="Repasses para a Juliana" valor={num(t.repasses_esperados)} nota="Repasse esperado conta como sucesso" />
            <Kpi rotulo="Agendamentos confirmados" valor={num(t.conversoes)} cor="verde"
              nota={`${pct(t.taxa_conversao)} dos repasses`} />
          </div>

          <div className="grid-2">
            <div className="card">
              <h2>Mensagens por dia</h2>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serie} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#2f343f" vertical={false} />
                    <XAxis dataKey="rotulo" stroke="#9aa2b1" tickLine={false} axisLine={false} fontSize={12}
                      interval={Math.max(0, Math.floor(serie.length / 8) - 1)} />
                    <YAxis stroke="#9aa2b1" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ background: '#262a33', border: '1px solid #2f343f', borderRadius: 10, color: '#f2f4f8' }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#9aa2b1' }} />
                    <Bar dataKey="Cliente" stackId="m" fill="#9aa2b1" />
                    <Bar dataKey="IA" stackId="m" fill="#0a57fc" />
                    <Bar dataKey="Humano" stackId="m" fill="#6b9bff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h2>Funil do atendimento</h2>
              <p className="dica">Cada pessoa conta uma vez no período, na etapa mais avançada que atingiu.</p>
              {etapas.map((e) => (
                <div className="funil-linha" key={e.nome}>
                  <div className="funil-topo"><span>{e.nome}</span><span>{num(e.valor)}</span></div>
                  <div className="funil-barra"><div style={{ width: `${e.largura}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
