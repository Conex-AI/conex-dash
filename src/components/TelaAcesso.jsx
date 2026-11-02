// Moldura das telas de acesso (login, esqueci a senha, nova senha).
import { LogoCompleta, Simbolo } from './Marca'

const ITENS = [
  ['M3 4.5h12v8H8l-3 2.5v-2.5H3z', 'Conversas completas', 'Cada mensagem da cliente, da Jú e da equipe, com a linha do tempo.'],
  ['M3 15V9M7.5 15V4M12 15V7M16 15v-4', 'Métricas do atendimento', 'Taxa de sucesso, conversão, funil e horários de pico.'],
  ['M2.5 4h13v10h-13zM2.5 8h13', 'Pix acompanhado', 'Do envio da chave ao agendamento confirmado.'],
]

export default function TelaAcesso({ titulo, sub, children }) {
  return (
    <div className="acesso">
      <aside className="acesso-lado" aria-hidden="true">
        <span className="acesso-marca"><Simbolo altura={30} /></span>
        <div className="acesso-chamada">
          <h2>Seu atendimento no WhatsApp, em números.</h2>
          <ul>
            {ITENS.map(([d, t, s]) => (
              <li key={t}>
                <span className="acesso-ico">
                  <svg width="18" height="18" viewBox="0 0 18 18"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span><b>{t}</b><em>{s}</em></span>
              </li>
            ))}
          </ul>
        </div>
        <span className="acesso-rodape">Conex · automação de atendimento</span>
      </aside>

      <main className="acesso-form">
        <div className="acesso-caixa">
          <span className="acesso-logo"><LogoCompleta largura={150} /></span>
          <div className="acesso-titulo">
            <h1>{titulo}</h1>
            {sub && <p>{sub}</p>}
          </div>
          {children}
        </div>
        <span className="acesso-seguro">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2M3 7h10v7H3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
          Acesso protegido · cada cliente vê só os próprios dados
        </span>
      </main>
    </div>
  )
}

export function Campo({ id, rotulo, icone, children, direita }) {
  return (
    <div className="campo">
      <div className="campo-topo"><label htmlFor={id}>{rotulo}</label>{direita}</div>
      <div className="campo-caixa">
        <svg className="campo-ico" width="17" height="17" viewBox="0 0 18 18" aria-hidden="true"><path d={icone} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {children}
      </div>
    </div>
  )
}

export const ICONE_EMAIL = 'M2.5 4.5h13v9h-13zM2.5 5l6.5 5 6.5-5'
export const ICONE_SENHA = 'M5 8V6a4 4 0 0 1 8 0v2M3.5 8h11v7.5h-11zM9 11v2'
