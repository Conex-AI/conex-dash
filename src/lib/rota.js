import { useEffect, useState } from 'react'

// Navegação pelo endereço do navegador: /conversas?cliente=jubeauty
// Cada troca de aba (ou de cliente, no admin) vira uma entrada no histórico,
// então o botão voltar do navegador e os botões laterais do mouse funcionam.

export const ABAS_VALIDAS = ['dashboard', 'conversas', 'metricas', 'pix', 'followup', 'clientes', 'perfil']

function ler() {
  const aba = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0]
  const cliente = new URLSearchParams(window.location.search).get('cliente')
  return { aba: ABAS_VALIDAS.includes(aba) ? aba : 'dashboard', cliente }
}

export function endereco(aba, cliente) {
  return `/${aba}${cliente ? `?cliente=${encodeURIComponent(cliente)}` : ''}`
}

export function useRota() {
  const [rota, setRota] = useState(ler)

  useEffect(() => {
    const aoVoltar = () => setRota(ler())
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  // substituir = true troca a entrada atual sem criar histórico (ex.: ao corrigir o endereço)
  function ir(aba, cliente, substituir = false) {
    const url = endereco(aba, cliente)
    if (url !== window.location.pathname + window.location.search) {
      window.history[substituir ? 'replaceState' : 'pushState']({}, '', url)
    }
    setRota({ aba, cliente })
    if (!substituir) window.scrollTo(0, 0)
  }

  return [rota, ir]
}

// Clique comum navega dentro do app; Ctrl/Cmd/Shift/botão do meio deixam o navegador abrir nova aba.
export function cliqueInterno(e) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
