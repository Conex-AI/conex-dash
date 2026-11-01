// Todas as datas do painel são no fuso de Brasília, igual às views do banco.
const TZ = 'America/Sao_Paulo'

export function hojeSP() {
  return new Date().toLocaleDateString('sv', { timeZone: TZ }) // yyyy-mm-dd
}

export function somaDias(yyyyMmDd, n) {
  const d = new Date(yyyyMmDd + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function listaDias(de, ate) {
  const dias = []
  for (let d = de; d <= ate; d = somaDias(d, 1)) dias.push(d)
  return dias
}

export function rotuloDia(yyyyMmDd) {
  const [, m, d] = yyyyMmDd.split('-')
  return `${d}/${m}`
}

export function dataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
