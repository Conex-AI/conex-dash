import { useState } from 'react'
import { hojeSP, somaDias } from '../lib/datas'

const OPCOES = [7, 30, 90]

export function dataCurta(iso) {
  return new Date(iso + 'T12:00:00Z')
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .replace(/\./g, '')
}

// Período "últimos N dias" (fuso de Brasília) e o período anterior do mesmo tamanho.
export function usePeriodo(inicial = 30) {
  const [dias, setDias] = useState(inicial)
  const ate = hojeSP()
  const de = somaDias(ate, -(dias - 1))
  const antAte = somaDias(de, -1)
  const antDe = somaDias(antAte, -(dias - 1))
  return { dias, setDias, de, ate, antDe, antAte }
}

export function SeletorPeriodo({ p }) {
  return (
    <>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{dataCurta(p.de)} a {dataCurta(p.ate)}</span>
      <div className="periodo">
        {OPCOES.map((n) => (
          <button key={n} className={p.dias === n ? 'ativa' : ''} onClick={() => p.setDias(n)}>{n} dias</button>
        ))}
      </div>
    </>
  )
}
