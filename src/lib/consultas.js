// Cache de dados do painel (TanStack Query).
//
// Como fica a navegação:
//  - Cada consulta tem uma chave (ex.: ['dash', cliente, de, ate]). Se a mesma chave já foi
//    buscada, a tela abre na hora com o que está no cache e atualiza em segundo plano.
//  - Dashboard e Métricas usam as mesmas consultas: o que uma busca, a outra já aproveita.
//  - Logo depois de entrar, o app pré-carrega as abas em segundo plano; passar o mouse
//    sobre um item do menu também pré-carrega aquela aba.
import { QueryClient, useQueries, useIsFetching } from '@tanstack/react-query'
import {
  carregarMetricas, carregarDashboard, carregarMetricasTela, carregarPix, carregarFollowup,
  carregarConversas, carregarMensagens, carregarEventos, carregarClientesResumo, carregarAcessos,
} from '../api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 1 min: dentro disso, trocar de aba não busca de novo
      gcTime: 30 * 60_000,        // guarda no cache por 30 min
      refetchOnWindowFocus: true, // voltou para a aba do navegador: atualiza em segundo plano
      retry: 1,
    },
  },
})

// ---- definição de cada consulta (chave + função) ----
export const q = {
  diario: (c, de) => ({ queryKey: ['diario', c, de], queryFn: () => carregarMetricas(c, de) }),
  dash: (c, de, ate) => ({ queryKey: ['dash', c, de, ate], queryFn: () => carregarDashboard(c, de, ate) }),
  metricas: (c, de, ate) => ({ queryKey: ['metricas', c, de, ate], queryFn: () => carregarMetricasTela(c, de, ate) }),
  pix: (c, de, ate) => ({ queryKey: ['pix', c, de, ate], queryFn: () => carregarPix(c, de, ate) }),
  followup: (c, de, ate) => ({ queryKey: ['followup', c, de, ate], queryFn: () => carregarFollowup(c, de, ate) }),
  conversas: (c) => ({ queryKey: ['conversas', c], queryFn: () => carregarConversas(c), staleTime: 20_000 }),
  mensagens: (c, tel) => ({ queryKey: ['mensagens', c, tel], queryFn: () => carregarMensagens(c, tel), staleTime: 20_000, semPlaceholder: true }),
  eventos: (c, tel) => ({ queryKey: ['eventos', c, tel], queryFn: () => carregarEventos(c, tel), staleTime: 20_000, semPlaceholder: true }),
  clientesResumo: (de, ate) => ({ queryKey: ['clientes-resumo', '*', de, ate], queryFn: () => carregarClientesResumo(de, ate) }),
  acessos: (c) => ({ queryKey: ['acessos', c], queryFn: () => carregarAcessos(c) }),
}

// ---- o que cada aba precisa ----
export function consultasDaAba(aba, cliente, p, admin) {
  const c = cliente.id
  switch (aba) {
    case 'dashboard':
      return [q.diario(c, p.de), q.dash(c, p.de, p.ate), q.dash(c, p.antDe, p.antAte)]
    case 'metricas':
      return [q.metricas(c, p.de, p.ate), q.dash(c, p.de, p.ate), q.dash(c, p.antDe, p.antAte), q.diario(c, p.de), q.pix(c, p.de, p.ate),
        ...(cliente.followup_ativo ? [q.followup(c, p.de, p.ate)] : [])]
    case 'pix': return [q.pix(c, p.de, p.ate)]
    case 'followup': return [q.followup(c, p.de, p.ate)]
    case 'conversas': return [q.conversas(c)]
    case 'clientes': return admin ? [q.clientesResumo(p.de, p.ate)] : []
    default: return []
  }
}

export function preCarregar(aba, cliente, p, admin) {
  for (const consulta of consultasDaAba(aba, cliente, p, admin)) queryClient.prefetchQuery(consulta)
}

// Enquanto o período ou a aba muda, mostra os dados anteriores do MESMO cliente
// (nunca os de outro cliente) até os novos chegarem.
function manterDoMesmoCliente(prev, prevQuery, chave) {
  return prevQuery && prevQuery.queryKey[0] === chave[0] && prevQuery.queryKey[1] === chave[1] ? prev : undefined
}

// Várias consultas de uma vez. `dados` só vem quando todas têm resposta.
export function useDados(lista, ativo = true) {
  return useQueries({
    queries: lista.map((x) => ({
      ...x,
      enabled: ativo,
      placeholderData: x.semPlaceholder ? undefined : (prev, prevQuery) => manterDoMesmoCliente(prev, prevQuery, x.queryKey),
    })),
    combine: (rs) => {
      const erro = rs.find((r) => r.error)?.error
      const pronto = rs.length > 0 && rs.every((r) => r.data !== undefined)
      return {
        dados: pronto ? rs.map((r) => r.data) : null,
        erro: erro ? (erro.message || 'Não foi possível carregar os dados.') : '',
        atualizando: rs.some((r) => r.isFetching),
        antigos: rs.some((r) => r.isPlaceholderData),
      }
    },
  })
}

export function useCarregandoAlgo() {
  return useIsFetching() > 0
}
