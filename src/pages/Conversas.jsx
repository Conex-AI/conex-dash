import { useEffect, useState } from 'react'
import { carregarConversas } from '../api'
import { dataHora } from '../lib/datas'

const DESFECHO = {
  conversao: ['Agendamento confirmado', 'verde'],
  transferencia_esperada: ['Repassada para a Juliana', 'azul'],
  transferencia_falha: ['Repasse falhou', 'vermelho'],
  resolvida_sem_humano: ['Resolvida pela IA', 'verde'],
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
      <div className="cabecalho"><div><h1>Conversas</h1><p>{cliente.nome} · mais recentes primeiro</p></div></div>
      {erro && <div className="erro">{erro}</div>}
      {!linhas && !erro && <div className="carregando">Carregando…</div>}
      {linhas && (
        <div className="card">
          {linhas.length === 0 ? <div className="vazio">Nenhuma conversa ainda.</div> : (
            <table className="tabela">
              <thead><tr><th>Cliente</th><th>Telefone</th><th>Última mensagem</th><th>Msgs</th><th>Situação</th></tr></thead>
              <tbody>
                {linhas.map((c) => {
                  const [rotulo, cor] = DESFECHO[c.ultimo_desfecho] || ['Em andamento', '']
                  return (
                    <tr key={c.telefone}>
                      <td>{c.nome_wpp || '—'}</td>
                      <td>{c.telefone}</td>
                      <td>{dataHora(c.ultima_msg_em)}</td>
                      <td>{c.total_mensagens}</td>
                      <td><span className={`pill ${cor}`}>{rotulo}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}
