import { Cabecalho } from '../components/Ui'

export default function EmBreve({ titulo, texto }) {
  return (
    <>
      <Cabecalho titulo={titulo} sub={texto} />
      <div className="card vazio">Esta tela entra na próxima etapa.</div>
    </>
  )
}
