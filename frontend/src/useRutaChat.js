import { useLocation } from 'react-router-dom'
import { rutaChat } from './chat'

// Una función que da la dirección del chat para un usuario (o la lista, sin usuario) teniendo en
// cuenta dónde estás: en Social conserva la pestaña (ver rutaChat en chat.js).
//   const rutaChat = useRutaChat();  <Link to={rutaChat('ana')}>
export function useRutaChat() {
  const { pathname, search } = useLocation()
  return (usuario) => rutaChat(usuario, { pathname, search })
}
