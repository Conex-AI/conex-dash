import { Component } from 'react'

// Erro ao baixar o arquivo de uma tela (o painel foi atualizado enquanto a aba estava aberta)
export const erroDeArquivo = (e) =>
  /dynamically imported module|importing a module script failed|failed to fetch|loading chunk|error loading/i.test(e?.message || '')

// Se uma tela quebrar, mostra um aviso só no lugar dela: o menu continua funcionando
// e trocar de aba (ou voltar no navegador) já abre a próxima tela normalmente.
export class ErroTela extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) { return { erro } }

  componentDidCatch(erro, info) { console.error('Erro na tela:', erro, info?.componentStack) }

  render() {
    const { erro } = this.state
    if (!erro) return this.props.children
    const arquivo = erroDeArquivo(erro)
    return (
      <div className="card erro-tela" role="alert">
        <b>{arquivo ? 'O painel foi atualizado.' : 'Não foi possível abrir esta tela.'}</b>
        <p>{arquivo
          ? 'Recarregue a página para usar a versão nova.'
          : 'Tente de novo. Se continuar, recarregue a página ou avise a Conex.'}</p>
        <div className="erro-tela-acoes">
          {!arquivo && <button className="btn-claro" onClick={() => this.setState({ erro: null })}>Tentar de novo</button>}
          <button className="btn" onClick={() => window.location.reload()}>Recarregar a página</button>
        </div>
      </div>
    )
  }
}

// lazy() que, se o arquivo da tela não existir mais (atualização do painel),
// recarrega a página uma vez sozinho em vez de quebrar.
export function telaComRecarga(importar) {
  return () => importar().catch((e) => {
    if (erroDeArquivo(e)) {
      let ultima = 0
      try { ultima = Number(sessionStorage.getItem('conex.recarga') || 0) } catch { /* sem armazenamento */ }
      if (Date.now() - ultima > 30000) {
        try { sessionStorage.setItem('conex.recarga', String(Date.now())) } catch { /* idem */ }
        window.location.reload()
        return new Promise(() => {}) // espera a página recarregar
      }
    }
    throw e
  })
}
