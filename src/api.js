import { supabase, DEMO } from './supabase'
import { demoClientes, demoMetricas, demoConversas, demoDashboard, demoMensagens, demoEventos } from './demo'

// Todas as leituras passam pelo RLS do banco: o cliente só recebe as linhas dele.

export async function carregarPerfil(userId) {
  if (DEMO) return { user_id: userId, papel: 'admin', cliente_id: null }
  const { data, error } = await supabase
    .from('perfis').select('user_id, papel, cliente_id').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function carregarClientes() {
  if (DEMO) return demoClientes
  const { data, error } = await supabase
    .from('clientes').select('id, slug, nome, followup_ativo, ativo').order('nome')
  if (error) throw error
  return data
}

export async function carregarMetricas(clienteId, desde) {
  if (DEMO) return demoMetricas(clienteId, desde)
  const { data, error } = await supabase
    .from('v_metricas_diarias').select('*')
    .eq('cliente_id', clienteId).gte('dia', desde).order('dia')
  if (error) throw error
  return data
}

export async function carregarConversas(clienteId) {
  if (DEMO) return demoConversas
  const { data, error } = await supabase
    .from('v_conversas_resumo').select('*')
    .eq('cliente_id', clienteId).order('ultima_msg_em', { ascending: false }).limit(200)
  if (error) throw error
  return data
}

// Dashboard completo do período (função dashboard_periodo, respeita o RLS).
export async function carregarDashboard(clienteId, de, ate) {
  if (DEMO) return demoDashboard(clienteId, de, ate)
  const { data, error } = await supabase.rpc('dashboard_periodo', { p_cliente: clienteId, p_de: de, p_ate: ate })
  if (error) throw error
  return data
}

// Mensagens de uma conversa (uma pessoa), da mais antiga para a mais nova.
export async function carregarMensagens(clienteId, telefone) {
  if (DEMO) return demoMensagens(telefone)
  const { data, error } = await supabase
    .from('mensagens').select('id, direcao, origem, tipo, conteudo, created_at')
    .eq('cliente_id', clienteId).eq('telefone', telefone)
    .order('created_at', { ascending: true }).limit(500)
  if (error) throw error
  return data
}

// Eventos (linha do tempo) de uma conversa.
export async function carregarEventos(clienteId, telefone) {
  if (DEMO) return demoEventos(telefone)
  const { data, error } = await supabase
    .from('eventos_conversa').select('evento, motivo, procedimento, valor, estagio, created_at')
    .eq('cliente_id', clienteId).eq('telefone', telefone)
    .order('created_at', { ascending: true }).limit(200)
  if (error) throw error
  return data
}
