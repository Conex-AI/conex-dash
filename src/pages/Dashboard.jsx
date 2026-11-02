import { useEffect, useMemo, useState } from 'react'
import { carregarMetricas, carregarDashboard } from '../api'
import {
  indicadores, deltaPct, deltaPts, deltaAbs, etapasFunil, serieDiaria, horariosPico, csvDiario, num, pct,
} from '../lib/metricas'
import { Cabecalho, Kpi } from '../components/Ui'
import { usePeriodo, SeletorPeriodo } from '../components/Periodo'
import { distribuicao, GraficoDiario, ComoTerminaram, Funil, Motivos, Pico, ProcedimentosPedidos, PixAtendimento } from '../components/Blocos'

export function baixarCsv(rows, nome) {
  const blob = new Blob([csvDiario(rows)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function Dashboard({ cliente, irPara }) {
  const p = usePeriodo()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    setDados(null); setErro('')
    Promise.all([
      carregarMetricas(cliente.id, p.de),
      carregarDashboard(cliente.id, p.de, p.ate),
      carregarDashboard(cliente.id, p.antDe, p.antAte),
    ])
      .then(([diario, atual, anterior]) => ativo && setDados({ diario: diario.filter((r) => r.dia <= p.ate), atual, anterior }))
      .catch((e) => ativo && setErro(e.message))
    return () => { ativo = false }
  }, [cliente.id, p.de, p.ate, p.antDe, p.antAte])

  const v = useMemo(() => {
    if (!dados) return null
    const k = indicadores(dados.atual)
    const a = indicadores(dados.anterior)
    return {
      k,
      chips: {
        conversas: deltaPct(k.conversas, a.conversas),
        sucesso: deltaPts(k.taxaSucesso, a.taxaSucesso),
        conversao: deltaPts(k.taxaConversao, a.taxaConversao),
        falhas: deltaAbs(k.falhas, a.falhas, true),
      },
      serie: serieDiaria(dados.diario, p.de, p.ate),
      etapas: etapasFunil(dados.atual.funil),
      pico: horariosPico(dados.atual.horas),
      dist: distribuicao(dados.atual.desfechos, k.conversas),
    }
  }, [dados, p.de, p.ate])

  const d = dados?.atual
  return (
    <>
      <Cabecalho titulo="Dashboard" sub={`${cliente.nome} · atendimento no WhatsApp`}>
        <SeletorPeriodo p={p} />
        <button className="btn-claro" onClick={() => baixarCsv(dados.diario, `conex-${cliente.slug}-${p.de}-a-${p.ate}.csv`)} disabled={!dados}>Exportar</button>
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
            <GraficoDiario serie={v.serie} />
            <ComoTerminaram dist={v.dist} />
          </section>

          <section className="linha">
            <Funil etapas={v.etapas} />
            <Motivos motivos={d.motivos} />
          </section>

          <section className="linha">
            <Pico pico={v.pico} />
            <ProcedimentosPedidos procedimentos={d.procedimentos} />
            <PixAtendimento d={d} />
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
