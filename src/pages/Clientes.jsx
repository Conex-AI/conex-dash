import { useState } from 'react'
import { vincularAcesso, criarCliente, redefinirSenha } from '../api'
import { useDados, q, queryClient } from '../lib/consultas'
import { TZ } from '../lib/datas'
import { num, pct, razao } from '../lib/metricas'
import { Cabecalho, Card, Chip, Kpi } from '../components/Ui'
import { usePeriodo, SeletorPeriodo } from '../components/Periodo'
import { Foto } from '../components/Foto'

function iniciais(nome = '') {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase()
}
function quando(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function slugify(t) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
function erroAmigavel(e) {
  const m = e?.message || ''
  if (m.includes('não encontrado') || m.includes('Somente admin')) return m
  if (m.includes('duplicate')) return 'Já existe um cliente com esse identificador.'
  return 'Não foi possível concluir. Tente de novo.'
}

export default function Clientes({ clientes, clienteAtual, onNovoCliente, abrir }) {
  const p = usePeriodo(30)
  const [sel, setSel] = useState(clienteAtual?.id || clientes[0]?.id)
  const [aviso, setAviso] = useState('')
  const [novo, setNovo] = useState(null)        // { nome } quando o formulário está aberto
  const [acesso, setAcesso] = useState(null)    // { email, papel }

  const res = useDados([q.clientesResumo(p.de, p.ate)])
  const resumo = res.dados?.[0] ?? null
  const erro = res.erro
  const ac = useDados(sel ? [q.acessos(sel)] : [], Boolean(sel))
  const acessos = ac.dados?.[0] ?? null
  const recarregarAcessos = (id) => queryClient.invalidateQueries({ queryKey: ['acessos', id] })

  const porId = Object.fromEntries((resumo || []).map((r) => [r.cliente_id, r]))
  const soma = (c) => (resumo || []).reduce((a, r) => a + Number(r[c] || 0), 0)
  const ativos = clientes.filter((c) => c.ativo)
  const escolhido = clientes.find((c) => c.id === sel)

  async function salvarCliente(e) {
    e.preventDefault()
    try {
      const c = await criarCliente(novo.nome.trim(), slugify(novo.nome))
      setNovo(null); setAviso(`Cliente ${c.nome} cadastrado.`)
      onNovoCliente(c); setSel(c.id)
      queryClient.invalidateQueries({ queryKey: ['clientes-resumo'] })
    } catch (err) { setAviso(erroAmigavel(err)) }
  }
  async function salvarAcesso(e) {
    e.preventDefault()
    try {
      await vincularAcesso(acesso.email.trim(), sel, acesso.papel)
      setAcesso(null); setAviso('Acesso liberado.'); recarregarAcessos(sel)
    } catch (err) { setAviso(erroAmigavel(err)) }
  }
  async function enviarSenha(email) {
    try { await redefinirSenha(email); setAviso(`Enviamos um e-mail para ${email} com o link para criar uma nova senha.`) }
    catch (err) { setAviso(erroAmigavel(err)) }
  }

  return (
    <>
      <Cabecalho titulo="Clientes" sub="Visão de admin: todos os clientes e os acessos de cada um. Só você vê esta aba.">
        <SeletorPeriodo p={p} />
        <button className="btn" onClick={() => setNovo({ nome: '' })}>Novo cliente</button>
      </Cabecalho>

      {aviso && <div className="aviso-ok" role="status">{aviso}<button className="btn-claro" onClick={() => setAviso('')}>Ok</button></div>}
      {erro && <div className="erro">{erro}</div>}

      {novo && (
        <form className="card form-linha" onSubmit={salvarCliente}>
          <label>
            <span className="campo-rotulo">Nome do cliente</span>
            <input className="input" required autoFocus value={novo.nome} onChange={(e) => setNovo({ nome: e.target.value })} placeholder="Ex.: Studio Bela" />
          </label>
          <span className="conv-sub">Identificador: {slugify(novo.nome) || '—'}</span>
          <button className="btn" type="submit">Cadastrar</button>
          <button className="btn-claro" type="button" onClick={() => setNovo(null)}>Cancelar</button>
        </form>
      )}

      <section className="kpis" aria-label="Indicadores">
        <Kpi rotulo="Clientes ativos" valor={num(ativos.length)} nota={`${ativos.filter((c) => c.followup_ativo).length} com follow-up ligado`} />
        <Kpi rotulo="Conversas no período" valor={resumo ? num(soma('conversas')) : '…'} nota="somando todos os clientes" />
        <Kpi rotulo="Agendamentos confirmados" valor={resumo ? num(soma('conversoes')) : '…'} nota="somando todos os clientes" />
      </section>

      <Card titulo="Todos os clientes">
        <div className="rolagem">
          <table className="tabela tabela-clientes">
            <thead>
              <tr>
                <th className="esq">Cliente</th>
                <th>Conversas</th>
                <th>Taxa de sucesso</th>
                <th>Conversão</th>
                <th>Follow-up</th>
                <th>Painel</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const r = porId[c.id] || {}
                return (
                  <tr key={c.id} className={c.id === sel ? 'sel' : ''}>
                    <td className="esq">
                      <button className="cliente-linha" onClick={() => setSel(c.id)} title="Ver acessos">
                        <Foto cliente={c} className="cinza" />
                        <span><b>{c.nome}</b><em>{c.slug}</em></span>
                      </button>
                    </td>
                    <td><b>{resumo ? num(r.conversas) : '…'}</b></td>
                    <td>{resumo ? pct(razao(Number(r.sucessos || 0), Number(r.conversas || 0))) : '…'}</td>
                    <td>{resumo ? pct(razao(Number(r.conversoes || 0), Number(r.conversas || 0))) : '…'}</td>
                    <td>{c.followup_ativo ? <Chip tom="verde">Ativo</Chip> : <Chip>Desativado</Chip>}</td>
                    <td><button className="btn-claro" onClick={() => abrir(c.id)}>Abrir</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="nota">"Abrir" leva ao Dashboard do cliente escolhido. Clique no nome para ver os acessos. Números do período escolhido acima.</p>
      </Card>

      <section className="linha">
        <Card className="f2" titulo={`Acessos de ${escolhido?.nome || ''}`}
          direita={<button className="btn-claro" onClick={() => setAcesso({ email: '', papel: 'cliente' })}>Adicionar acesso</button>}>
          {acesso && (
            <form className="form-linha" onSubmit={salvarAcesso}>
              <label>
                <span className="campo-rotulo">E-mail do login</span>
                <input className="input" type="email" required autoFocus value={acesso.email} onChange={(e) => setAcesso({ ...acesso, email: e.target.value })} />
              </label>
              <label>
                <span className="campo-rotulo">Papel</span>
                <select className="input" value={acesso.papel} onChange={(e) => setAcesso({ ...acesso, papel: e.target.value })}>
                  <option value="cliente">Cliente</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button className="btn" type="submit">Liberar</button>
              <button className="btn-claro" type="button" onClick={() => setAcesso(null)}>Cancelar</button>
              <p className="nota" style={{ flexBasis: '100%' }}>O login precisa existir antes: crie em Supabase › Authentication › Users (Add user) e depois libere aqui.</p>
            </form>
          )}
          {ac.erro && <div className="erro">Não foi possível carregar os acessos.</div>}
          {!acessos && !ac.erro && <div className="carregando">Carregando…</div>}
          {acessos && acessos.length === 0 && <div className="vazio">Nenhum acesso para este cliente.</div>}
          {acessos && acessos.length > 0 && (
            <div className="acessos">
              {acessos.map((a) => (
                <div key={a.user_id}>
                  <span><b>{a.email}</b><em>último acesso {quando(a.ultimo_acesso)}</em></span>
                  <Chip tom={a.papel === 'admin' ? 'azul' : ''}>{a.papel === 'admin' ? 'Admin' : 'Cliente'}</Chip>
                  <button className="btn-claro" onClick={() => enviarSenha(a.email)}>Redefinir senha</button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="f1" titulo="Quem vê o quê">
          <div className="confere">
            <div><b>Cliente</b><span>vê só o próprio atendimento: Dashboard, Conversas, Métricas, Pix e Follow-up.</span></div>
            <div><b>Admin</b><span>vê todos os clientes, escolhe um por vez no menu e tem esta aba Clientes.</span></div>
          </div>
          <p className="nota">A separação é feita no banco de dados, não só na tela. Mesmo abrindo o endereço de outro cliente, os dados não aparecem.</p>
        </Card>
      </section>
    </>
  )
}
