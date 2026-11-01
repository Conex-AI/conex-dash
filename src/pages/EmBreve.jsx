export default function EmBreve({ titulo, texto }) {
  return (
    <>
      <div className="cabecalho"><div><h1>{titulo}</h1><p>{texto}</p></div></div>
      <div className="card vazio">Esta aba entra na próxima etapa.</div>
    </>
  )
}
