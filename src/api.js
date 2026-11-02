import { supabase, DEMO } from './supabase'
import {
  demoClientes, demoMetricas, demoConversas, demoDashboard, demoMensagens, demoEventos,
  demoMetricasTela, demoPix, demoFollowup, demoClientesResumo, demoAcessos,
} from './demo'

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
    .order('created_at', { ascending: false }).limit(2000)
  if (error) throw error
  // busca as mais recentes primeiro (para conversas longas não cortarem o final) e devolve em ordem
  return data.reverse()
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

async function rpc(nome, args) {
  const { data, error } = await supabase.rpc(nome, args)
  if (error) throw error
  return data
}

// Tela Métricas (função metricas_periodo)
export async function carregarMetricasTela(clienteId, de, ate) {
  if (DEMO) return demoMetricasTela(clienteId)
  return rpc('metricas_periodo', { p_cliente: clienteId, p_de: de, p_ate: ate })
}

// Tela Pix (função pix_periodo)
export async function carregarPix(clienteId, de, ate) {
  if (DEMO) return demoPix()
  return rpc('pix_periodo', { p_cliente: clienteId, p_de: de, p_ate: ate })
}

// Tela Follow-up (função followup_periodo)
export async function carregarFollowup(clienteId, de, ate) {
  if (DEMO) return demoFollowup(clienteId)
  return rpc('followup_periodo', { p_cliente: clienteId, p_de: de, p_ate: ate })
}

// Tela Clientes (só admin)
export async function carregarClientesResumo(de, ate) {
  if (DEMO) return demoClientesResumo()
  return rpc('clientes_resumo', { p_de: de, p_ate: ate })
}
export async function carregarAcessos(clienteId) {
  if (DEMO) return demoAcessos()
  return rpc('admin_acessos', { p_cliente: clienteId })
}
export async function vincularAcesso(email, clienteId, papel) {
  if (DEMO) return null
  return rpc('admin_vincular_acesso', { p_email: email, p_cliente: clienteId, p_papel: papel })
}
export async function criarCliente(nome, slug) {
  if (DEMO) return { id: 'demo-' + slug, nome, slug, followup_ativo: false, ativo: true }
  const { data, error } = await supabase.from('clientes').insert({ nome, slug }).select('id, slug, nome, followup_ativo, ativo').single()
  if (error) throw error
  return data
}
export async function redefinirSenha(email) {
  if (DEMO) return
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  if (error) throw error
}
