import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from './api'
import ListaChats from './ListaChats'
import Conversacion from './Conversacion'
import { iniciarSondeo } from './sondeo'
import { totalSinLeer } from './chat'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'

// Cada cuánto se pone al día la lista de conversaciones. La conversación abierta se sondea
// aparte y más seguido (ver Conversacion.jsx).
const LISTA_CADA_MS = 12_000
// Los amigos (para saber quién está jugando) se piden cada tantas vueltas de la lista
const AMIGOS_CADA = 5

// El contenido del chat, dentro del panel flotante (ChatDock): la lista de conversaciones y la que
// tengas abierta. En un panel ancho se ven las dos a la vez, una al lado de la otra; en uno estrecho
// (el móvil) se ve una u otra, con una flecha para volver a la lista (lo decide el CSS).
//  - Solo se puede hablar con amigos; la lista incluye también a quien lo fue, para poder
//    seguir leyendo lo que os dijisteis.
//  - setToken: para cerrar sesión si caduca
//  - username: con quién se habla, o null si no hay ninguna conversación abierta
//  - borradores: { current: Map } con lo que había a medio escribir en cada conversación; lo
//    guarda Layout para que sobreviva a cerrar el panel
//  - ponerMensajes(n): fija el total de mensajes sin leer (la lista ya lo trae, sin otra petición)
//  - onElegir(usuario): abre esa conversación (con null, vuelve a la lista)
function Chat({ setToken, username, borradores, ponerMensajes, onElegir }) {
  const { t } = useIdioma()

  const [conversaciones, setConversaciones] = useState(null)
  const [amigos, setAmigos] = useState(null)
  const [error, setError] = useState('')
  const vueltasRef = useRef(0)

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setToken('')
  }, [setToken])

  // Las dos devuelven la promesa para que el sondeo sepa cuándo ha terminado
  const cargarLista = useCallback(() => {
    return apiFetch('/chat', { avisoLento: false })
      .then((data) => {
        setConversaciones(data.conversations)
        // La insignia de la barra sale de aquí, sin una petición más
        ponerMensajes(totalSinLeer(data.conversations))
        setError('')
      })
      .catch((err) => {
        if (err.status === 401) return cerrarSesion()
        setError(err.message)
      })
  }, [cerrarSesion, ponerMensajes])

  const cargarAmigos = useCallback(() => {
    return apiFetch('/friends', { avisoLento: false })
      .then((data) => setAmigos(data.friends))
      .catch((err) => {
        if (err.status === 401) cerrarSesion()
        // Sin la lista de amigos el chat sigue funcionando: solo falta quién está jugando
      })
  }, [cerrarSesion])

  // Al entrar, las dos listas; después, la de conversaciones cada pocos segundos mientras uso
  // la app (ver sondeo.js) y la de amigos de vez en cuando
  useEffect(() => {
    cargarLista()
    cargarAmigos()
    return iniciarSondeo(() => {
      vueltasRef.current += 1
      return Promise.all([
        cargarLista(),
        vueltasRef.current % AMIGOS_CADA === 0 ? cargarAmigos() : null,
      ])
    }, { cada: LISTA_CADA_MS })
  }, [cargarLista, cargarAmigos])

  // Algo cambió en la conversación abierta (enviado, recibido, leído, borrado): pongo al día
  // la lista sin esperar a su turno
  const alCambiar = useCallback(() => { cargarLista() }, [cargarLista])

  const amigo = amigos?.find((a) => a.username === username)

  return (
    <div className={username ? 'chat chat--abierto' : 'chat'}>
      <aside className="chat__lista">
        <ListaChats conversaciones={conversaciones} amigos={amigos} error={error} activo={username} onElegir={onElegir} />
      </aside>

      <div className="chat__panel">
        {username ? (
          <Conversacion
            key={username}
            username={username}
            amigo={amigo}
            borradores={borradores}
            onCambio={alCambiar}
            onVolver={() => onElegir(null)}
            cerrarSesion={cerrarSesion}
          />
        ) : (
          <div className="chat__elegir">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a8 8 0 0 1-11.8 7L3 20.5l1.6-5.2A8 8 0 1 1 21 12Z" />
              <path d="M8.5 11h7M8.5 14h4" />
            </svg>
            <h2>{t('chat.elegir.titulo')}</h2>
            <p>{t('chat.elegir.texto')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Chat
