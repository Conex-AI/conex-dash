import { listaDias, rotuloDia } from './datas'

const CAMPOS = [
  'conversas_ativas', 'msgs_cliente', 'msgs_ia', 'msgs_humano', 'contatos_novos',
  'procedimento_definido', 'horario_definido', 'repasses_esperados', 'repasses_falhos',
  'resolvidas_sem_humano', 'comprovantes', 'conversoes',
]

export function razao(a, b) {
  return b > 0 ? a / b : null
}

export function pct(v) {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(v >= 0.995 || v === 0 ? 0 : 1).replace('.', ',')}%`
}

export function num(v) {
  return Number(v || 0).toLocaleString('pt-BR')
}

export function totais(rows) {
  const t = Object.fromEntries(CAMPOS.map((c) => [c, 0]))
  for (const r of rows) for (const c of CAMPOS) t[c] += Number(r[c] || 0)
  // Repasse esperado conta como sucesso, junto com resolvida sem humano.
  t.sucessos = t.repasses_esperados + t.resolvidas_sem_humano
  t.taxa_resolucao = razao(t.sucessos, t.sucessos + t.repasses_falhos)
  t.taxa_conversao = razao(t.conversoes, t.repasses_esperados)
  return t
}

// f vem da função funil_periodo: pessoas distintas que chegaram a cada etapa (ou além) no período.
export function funil(f) {
  const etapas = [
    ['Conversas', f.conversas],
    ['Procedimento definido', f.procedimento],
    ['Horário definido', f.horario],
    ['Repassado para a Juliana', f.repasse],
    ['Comprovante recebido', f.comprovante],
    ['Agendamento confirmado', f.agendamento],
  ].map(([nome, valor]) => [nome, Number(valor || 0)])
  const topo = Math.max(...etapas.map((e) => e[1]), 1)
  return etapas.map(([nome, valor]) => ({ nome, valor, largura: (valor / topo) * 100, pctTopo: razao(valor, topo) }))
}

export function serieDiaria(rows, de, ate) {
  const porDia = new Map(rows.map((r) => [r.dia, r]))
  return listaDias(de, ate).map((dia) => {
    const r = porDia.get(dia) || {}
    return {
      dia, rotulo: rotuloDia(dia),
      Cliente: Number(r.msgs_cliente || 0),
      IA: Number(r.msgs_ia || 0),
      Humano: Number(r.msgs_humano || 0),
      Conversões: Number(r.conversoes || 0),
    }
  })
}
