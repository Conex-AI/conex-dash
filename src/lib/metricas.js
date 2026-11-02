import { listaDias, rotuloDia } from './datas'

export function razao(a, b) {
  return b > 0 ? a / b : null
}

export function num(v) {
  return Number(v || 0).toLocaleString('pt-BR')
}

export function pct(v, casas = 1) {
  if (v === null || v === undefined) return '—'
  return `${(v * 100).toFixed(casas).replace('.', ',')}%`
}

function sinal(n, texto) {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${texto}`
}

// Indicadores do período a partir do retorno de dashboard_periodo.
// Definições (iguais às do protótipo):
//  - taxa de sucesso = (repasses esperados + resolvidas pela IA) / conversas
//  - conversão       = agendamentos confirmados / conversas
export function indicadores(d) {
  const f = d.funil
  const x = d.desfechos
  const conversas = Number(f.conversas)
  const sucessos = Number(x.esperado) + Number(x.resolvida)
  return {
    conversas,
    sucessos,
    taxaSucesso: razao(sucessos, conversas),
    conversoes: Number(f.agendamento),
    taxaConversao: razao(Number(f.agendamento), conversas),
    falhas: Number(x.falha),
    taxaFalha: razao(Number(x.falha), conversas),
  }
}

// Comparação com o período anterior. `melhorQuandoMenor` vale para falhas.
export function deltaPct(atual, anterior) {
  if (!anterior) return null
  const v = ((atual - anterior) / anterior) * 100
  return { texto: sinal(v, `${Math.abs(v).toFixed(1).replace('.', ',')}%`), bom: v >= 0 }
}
export function deltaPts(atual, anterior) {
  if (atual === null || anterior === null) return null
  const v = (atual - anterior) * 100
  return { texto: sinal(v, `${Math.abs(v).toFixed(1).replace('.', ',')} pts`), bom: v >= 0 }
}
export function deltaAbs(atual, anterior, melhorQuandoMenor = false) {
  const v = atual - anterior
  return { texto: sinal(v, `${Math.abs(v)}`), bom: melhorQuandoMenor ? v <= 0 : v >= 0 }
}

export function etapasFunil(f) {
  const topo = Math.max(Number(f.conversas), 1)
  return [
    ['Contatos', f.conversas],
    ['Procedimento definido', f.procedimento],
    ['Horário definido', f.horario],
    ['Comprovante recebido', f.comprovante],
    ['Agendamento confirmado', f.agendamento],
  ].map(([nome, v]) => ({ nome, valor: Number(v), pct: pct(Number(v) / topo), largura: (Number(v) / topo) * 100 }))
}

export function serieDiaria(rows, de, ate) {
  const porDia = new Map(rows.map((r) => [r.dia, r]))
  return listaDias(de, ate).map((dia) => {
    const r = porDia.get(dia) || {}
    return {
      dia, rotulo: rotuloDia(dia),
      Conversas: Number(r.conversas_ativas || 0),
      Confirmadas: Number(r.conversoes || 0),
    }
  })
}

// Horas 8h–19h para o gráfico de horários de pico.
export function horariosPico(horas) {
  const porHora = new Map(horas.map((x) => [x.h, Number(x.n)]))
  const lista = Array.from({ length: 12 }, (_, i) => ({ h: i + 8, n: porHora.get(i + 8) || 0 }))
  const topo = Math.max(...lista.map((x) => x.n))
  const pico = topo > 0 ? lista.find((x) => x.n === topo) : null
  return { lista, topo, pico }
}

export function csvDiario(rows) {
  const cab = ['Data', 'Conversas', 'Mensagens da cliente', 'Mensagens da IA', 'Mensagens da Juliana',
    'Repasses esperados', 'Repasses por falha', 'Resolvidas sem humano', 'Comprovantes', 'Agendamentos confirmados']
  const linhas = rows.map((r) => [r.dia, r.conversas_ativas, r.msgs_cliente, r.msgs_ia, r.msgs_humano,
    r.repasses_esperados, r.repasses_falhos, r.resolvidas_sem_humano, r.comprovantes, r.conversoes])
  return '﻿' + [cab, ...linhas].map((l) => l.join(';')).join('\n')
}
