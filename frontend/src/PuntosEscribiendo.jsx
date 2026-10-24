// Los tres puntitos de "escribiendo...", que suben y bajan uno detrás de otro (chat.css). Los
// usan la lista de conversaciones, la cabecera de una conversación y su burbuja de "escribiendo".
function PuntosEscribiendo() {
  return (
    <span className="chat-puntos" aria-hidden="true">
      <span /><span /><span />
    </span>
  )
}

export default PuntosEscribiendo
