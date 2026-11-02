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

export function demoDashboard(clienteId, de, ate) {
  const rows = demoMetricas(clienteId, de).filter((r) => r.dia <= ate)
  const soma = (c) => rows.reduce((a, r) => a + r[c], 0)
  const agendamento = soma('conversoes')
  const comprovante = Math.max(soma('comprovantes'), agendamento)
  const repasse = Math.max(soma('repasses_esperados'), comprovante)
  const horario = Math.max(soma('horario_definido'), repasse)
  const procedimento = Math.max(soma('procedimento_definido'), horario)
  const conversas = Math.max(Math.round(soma('contatos_novos') * 1.6), procedimento + 6)
  const falha = soma('repasses_falhos')
  const resolvida = Math.round((conversas - repasse - falha) * 0.8)
  const horas = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h, i) => ({ h, n: [12, 24, 31, 28, 20, 26, 41, 49, 38, 30, 17, 9][i] }))
  return {
    funil: { conversas, procedimento, horario, repasse, comprovante, agendamento, comprovantes_recebidos: comprovante },
    desfechos: { esperado: repasse, falha, resolvida, sem_desfecho: Math.max(0, conversas - repasse - falha - resolvida) },
    motivos: [
      { motivo: 'Comprovante de Pix', tipo: 'esperado', total: comprovante },
      { motivo: 'Escolha de horário', tipo: 'esperado', total: Math.max(0, repasse - comprovante) },
      { motivo: 'Pedido de desconto', tipo: 'esperado', total: 4 },
      { motivo: 'Áudio não compreendido', tipo: 'falha', total: falha },
    ],
    horas,
    procedimentos: [
      { procedimento: 'Volume Brasileiro', total: 84 }, { procedimento: 'Lash Lift', total: 61 },
      { procedimento: 'Design de sobrancelhas', total: 47 }, { procedimento: 'Fox Effect', total: 39 },
      { procedimento: 'Brow Lamination', total: 28 },
    ],
    pix: { comprovantes: comprovante, pendentes: 3, minutos_ate_confirmar: 38 },
    mensagens: { total: soma('msgs_cliente') + soma('msgs_ia') + soma('msgs_humano') + 214, recebidas: soma('msgs_cliente'), ia: soma('msgs_ia'), humano: soma('msgs_humano'), midia: 214 },
  }
}

function minutosAtras(m) { return new Date(Date.now() - m * 60e3).toISOString() }

export function demoMensagens(telefone) {
  if (telefone === '5561999990003') {
    return [
      { id: 1, origem: 'cliente', tipo: 'texto', conteudo: 'oi, quanto custa a limpeza de pele?', created_at: minutosAtras(1850) },
      { id: 2, origem: 'ia', tipo: 'texto', conteudo: 'Oii! Aqui é a Jú, da Ju Beauty. A limpeza de pele é R$ 150,00. Quer ver um horário?', created_at: minutosAtras(1849) },
    ]
  }
  return [
    { id: 1, origem: 'cliente', tipo: 'texto', conteudo: 'oi, queria saber do lash lift', created_at: minutosAtras(95) },
    { id: 2, origem: 'ia', tipo: 'texto', conteudo: 'Oii, tudo bem? Aqui é a Jú, do atendimento da Ju Beauty. O Lash Lift é R$ 120,00.', created_at: minutosAtras(94) },
    { id: 3, origem: 'ia', tipo: 'texto', conteudo: 'Qual dia e horário ficam melhores pra você?', created_at: minutosAtras(94) },
    { id: 4, origem: 'cliente', tipo: 'texto', conteudo: 'quinta à tarde', created_at: minutosAtras(86) },
    { id: 5, origem: 'ia', tipo: 'texto', conteudo: 'Anotei quinta à tarde. A Juliana confirma o horário. Pra reservar, o sinal é de R$ 30,00 no Pix.', created_at: minutosAtras(85) },
    { id: 6, origem: 'cliente', tipo: 'imagem', conteudo: 'Segue o comprovante', created_at: minutosAtras(74) },
    { id: 7, origem: 'humano', tipo: 'texto', conteudo: 'Oi Amanda, recebi! Agendamento confirmado!', created_at: minutosAtras(60) },
  ]
}

export function demoEventos(telefone) {
  if (telefone === '5561999990003') {
    return [
      { evento: 'contato_novo', created_at: minutosAtras(1850) },
      { evento: 'procedimento_definido', procedimento: 'Limpeza de pele', created_at: minutosAtras(1849) },
    ]
  }
  return [
    { evento: 'contato_novo', created_at: minutosAtras(95) },
    { evento: 'procedimento_definido', procedimento: 'Lash Lift', created_at: minutosAtras(94) },
    { evento: 'horario_definido', valor: 'Quinta à tarde', created_at: minutosAtras(86) },
    { evento: 'transferencia_esperada', motivo: 'Comprovante de Pix', created_at: minutosAtras(74) },
    { evento: 'comprovante_recebido', created_at: minutosAtras(74) },
    { evento: 'conversao', created_at: minutosAtras(60) },
  ]
}
