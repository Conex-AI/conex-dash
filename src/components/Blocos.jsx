// Blocos de métricas usados no Dashboard e na tela Métricas (mesmo cálculo nos dois lugares).
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { num, pct, rotuloMotivo, capitaliza } from '../lib/metricas'
import { Barra, Card, Chip } from './Ui'

export const COR = { azul: '#3b7bff', verde: '#2fbf71', vermelho: '#ef5b5b', cinza: 'var(--neutral)' }
const TOOLTIP = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }

export function distribuicao(desfechos, conversas) {
  const total = Math.max(conversas, 1)
  return [
    ['Resolvidas sem humano', desfechos.resolvida, COR.verde],
    ['Repasse esperado', desfechos.esperado, COR.azul],
    ['Repasse por falha', desfechos.falha, COR.vermelho],
    ['Sem desfecho', desfechos.sem_desfecho, COR.cinza],
  ].map(([nome, n, cor]) => ({ nome, n: Number(n), cor, pct: Number(n) / total }))
}

export function GraficoDiario({ serie, className = 'f3' }) {
  return (
    <Card className={className} titulo="Conversas por dia" direita={
      <span className="legenda">
        <span><i style={{ background: COR.azul }} />Conversas</span>
        <span><i style={{ background: COR.verde }} />Confirmadas</span>
      </span>}>
      <div style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serie} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={12}
              interval={Math.max(0, Math.floor(serie.length / 8) - 1)} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP} />
            <Line type="monotone" dataKey="Conversas" stroke={COR.azul} strokeWidth={2.5} dot={false} animationDuration={350} />
            <Line type="monotone" dataKey="Confirmadas" stroke={COR.verde} strokeWidth={2.5} dot={false} animationDuration={350} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function ComoTerminaram({ dist, className = 'f2' }) {
  return (
    <Card className={className} titulo="Como as conversas terminaram">
      <div className="dist" role="img"
        aria-label={'Distribuição: ' + dist.map((x) => `${pct(x.pct)} ${x.nome.toLowerCase()}`).join(', ')}>
        {dist.filter((x) => x.n > 0).map((x) => <span key={x.nome} style={{ width: `${x.pct * 100}%`, background: x.cor }} />)}
      </div>
      <div className="lista" style={{ gap: 12 }}>
        {dist.map((x) => (
          <div className="dist-linha" key={x.nome}>
            <i style={{ background: x.cor }} /><span>{x.nome}</span><b>{num(x.n)}</b><em>{pct(x.pct)}</em>
          </div>
        ))}
      </div>
      <p className="nota">Repasse esperado (comprovante de Pix, escolha de horário, desconto) conta como sucesso, não como falha.</p>
    </Card>
  )
}

export function Funil({ etapas, className = 'f1' }) {
  return (
    <Card className={className} titulo="Funil de agendamento">
      <div className="lista">
        {etapas.map((e) => <Barra key={e.nome} rotulo={e.nome} valor={num(e.valor)} pct={e.pct} largura={e.largura} />)}
      </div>
    </Card>
  )
}

export function Motivos({ motivos, className = 'f1' }) {
  return (
    <Card className={className} titulo="Motivos de repasse">
      {motivos.length === 0 ? <div className="vazio">Nenhum repasse no período.</div> : (
        <div className="rolagem">
          <table className="tabela">
            <thead><tr><th>Motivo</th><th>Tipo</th><th className="dir">Total</th></tr></thead>
            <tbody>
              {motivos.map((m) => (
                <tr key={m.motivo + m.tipo}>
                  <td>{rotuloMotivo(m.motivo)}</td>
                  <td><Chip tom={m.tipo === 'falha' ? 'vermelho' : 'azul'}>{m.tipo === 'falha' ? 'Falha' : 'Esperado'}</Chip></td>
                  <td className="dir"><b>{num(m.total)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export function Pico({ pico, className = 'f1' }) {
  return (
    <Card className={className} titulo="Horários de pico">
      <div className="pico" role="img"
        aria-label={pico.pico ? `Mensagens recebidas por hora, com pico às ${pico.pico.h}h` : 'Sem mensagens recebidas no período'}>
        {pico.lista.map((x) => (
          <div key={x.h} className={pico.pico && x.h === pico.pico.h ? 'max' : ''}
            style={{ height: `${pico.topo ? (x.n / pico.topo) * 100 : 0}%` }} title={`${x.h}h: ${x.n}`} />
        ))}
      </div>
      <div className="pico-eixo"><span>8h</span><span>11h</span><span>14h</span><span>17h</span><span>19h</span></div>
      <span className="sub">
        {pico.pico ? `Pico às ${pico.pico.h}h, com ${num(pico.pico.n)} mensagens no período.` : 'Sem mensagens recebidas no período.'}
      </span>
    </Card>
  )
}

export function ProcedimentosPedidos({ procedimentos, className = 'f1' }) {
  return (
    <Card className={className} titulo="Procedimentos mais pedidos">
      {procedimentos.length === 0 ? <div className="vazio">Nenhum procedimento definido no período.</div> : (
        <div className="lista">
          {procedimentos.map((p) => (
            <Barra key={p.procedimento} rotulo={capitaliza(p.procedimento)} valor={num(p.total)}
              largura={(Number(p.total) / Number(procedimentos[0].total)) * 100} />
          ))}
        </div>
      )}
    </Card>
  )
}

export function PixAtendimento({ d, className = 'f1' }) {
  return (
    <Card className={className} titulo="Pix e atendimento">
      <div className="stats">
        <div><span>Comprovantes recebidos</span><b>{num(d.pix.comprovantes)}</b></div>
        <div><span>Pendentes agora</span><b>{num(d.pix.pendentes)}</b></div>
        <div><span>Tempo até confirmar</span><b>{d.pix.minutos_ate_confirmar == null ? '—' : `${Math.round(d.pix.minutos_ate_confirmar)} min`}</b></div>
        <hr />
        <div><span>Mensagens do período</span><b>{num(d.mensagens.total)}</b></div>
        <div><span>Recebidas</span><b>{num(d.mensagens.recebidas)}</b></div>
        <div><span>Enviadas pela Jú</span><b>{num(d.mensagens.ia)}</b></div>
        <div><span>Enviadas pela Juliana</span><b>{num(d.mensagens.humano)}</b></div>
        <div><span>Fotos e vídeos enviados</span><b>{num(d.mensagens.midia)}</b></div>
      </div>
    </Card>
  )
}
