import { useEffect, useState } from 'react'
import { carregarConversas } from '../api'
import { dataHora } from '../lib/datas'
import { Cabecalho, Card, Chip } from '../components/Ui'

const DESFECHO = {
  conversao: ['Convertida', 'verde'],
  transferencia_esperada: ['Com a Juliana', 'azul'],
  transferencia_falha: ['Repasse por falha', 'vermelho'],
  resolvida_sem_humano: ['Resolvida pela Jú', ''],
}

export default function Conversas({ cliente }) {
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    setLinhas(null); setErro('')
    carregarConversas(cliente.id)
      .then((d) => ativo && setLinhas(d))
      .catch((e) => ativo && setErro(e.message))
    return () => { ativo = false }
  }, [cliente.id])

  return (
    <>
      <Cabecalho titulo="Conversas" sub={`${cliente.nome} · mais recentes primeiro`} />
      {erro && <div className="erro">{erro}</div>}
      {!linhas && !erro && <div className="carregando">Carregando…</div>}
      {linhas && (
        <Card>
          {linhas.length === 0 ? <div className="vazio">Nenhuma conversa ainda.</div> : (
            <div className="rolagem">
              <table className="tabela">
                <thead><tr><th>Cliente</th><th>Telefone</th><th>Última mensagem</th><th className="dir">Msgs</th><th>Situação</th></tr></thead>
                <tbody>
                  {linhas.map((c) => {
                    const [rotulo, tom] = DESFECHO[c.ultimo_desfecho] || ['Em andamento', 'laranja']
                    return (
                      <tr key={c.telefone}>
                        <td><b>{c.nome_wpp || '—'}</b></td>
                        <td>{c.telefone}</td>
                        <td>{dataHora(c.ultima_msg_em)}</td>
                        <td className="dir">{c.total_mensagens}</td>
                        <td><Chip tom={tom}>{rotulo}</Chip></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  )
}
