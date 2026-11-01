// Dados fictícios só para ver o visual (VITE_DEMO=1). Nunca vai para produção com dados reais.
import { hojeSP, somaDias } from './lib/datas'

export const demoClientes = [
  { id: 'demo-1', slug: 'jubeauty', nome: 'Ju Beauty', followup_ativo: false, ativo: true },
  { id: 'demo-2', slug: 'clinica-exemplo', nome: 'Clínica Exemplo', followup_ativo: true, ativo: true },
]

function rnd(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function demoMetricas(clienteId, desde) {
  const r = rnd(clienteId === 'demo-1' ? 7 : 19)
  const hoje = hojeSP()
  const rows = []
  for (let i = 90; i >= 0; i--) {
    const dia = somaDias(hoje, -i)
    if (dia < desde) continue
    const novos = Math.floor(r() * 5)
    const proc = Math.min(novos + Math.floor(r() * 2), novos + 1)
    const hor = Math.floor(proc * (0.5 + r() * 0.4))
    const rep = hor
    const comp = Math.floor(rep * (0.4 + r() * 0.4))
    const conv = Math.floor(comp * (0.6 + r() * 0.4))
    rows.push({
      cliente_id: clienteId, dia,
      conversas_ativas: novos + Math.floor(r() * 4),
      msgs_cliente: 8 + Math.floor(r() * 40),
      msgs_ia: 14 + Math.floor(r() * 70),
      msgs_humano: Math.floor(r() * 6),
      contatos_novos: novos, procedimento_definido: proc, horario_definido: hor,
      repasses_esperados: rep, repasses_falhos: r() > 0.93 ? 1 : 0,
      resolvidas_sem_humano: Math.floor(r() * 2),
      comprovantes: comp, conversoes: conv,
    })
  }
  return rows
}

export const demoConversas = [
  { telefone: '5561999990001', nome_wpp: 'Amanda', ultima_msg_em: new Date().toISOString(), total_mensagens: 42, ultima_origem: 'ia', ultimo_desfecho: 'conversao' },
  { telefone: '5561999990002', nome_wpp: 'Carla', ultima_msg_em: new Date(Date.now() - 3600e3 * 5).toISOString(), total_mensagens: 18, ultima_origem: 'cliente', ultimo_desfecho: 'transferencia_esperada' },
  { telefone: '5561999990003', nome_wpp: 'Bia', ultima_msg_em: new Date(Date.now() - 3600e3 * 30).toISOString(), total_mensagens: 9, ultima_origem: 'ia', ultimo_desfecho: null },
]

export function demoFunil(clienteId, de, ate) {
  const rows = demoMetricas(clienteId, de).filter((r) => r.dia <= ate)
  const soma = (c) => rows.reduce((a, r) => a + r[c], 0)
  const agendamento = soma('conversoes')
  const comprovante = Math.max(soma('comprovantes'), agendamento)
  const repasse = Math.max(soma('repasses_esperados'), comprovante)
  const horario = Math.max(soma('horario_definido'), repasse)
  const procedimento = Math.max(soma('procedimento_definido'), horario)
  const conversas = Math.max(Math.round(soma('contatos_novos') * 1.6), procedimento)
  return { conversas, procedimento, horario, repasse, comprovante, agendamento }
}
