import { useState, useEffect } from 'react'
import { apiFetch } from './api'
import RejillaPersonas from './RejillaPersonas'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useIdioma } from './IdiomaContext'

// Los amigos de otra persona (solo los ve quien ella deja). Cada uno trae mi relación con
// él, así que desde aquí se le puede añadir directamente.
//  - username: de quién son
//  - onCambio(): una acción terminó
//  - cerrarSesion(): para un 401
function AmigosAjenos({ username, onCambio, cerrarSesion }) {
  const { t } = useIdioma()
  const [lista, setLista] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelado = false

    apiFetch(`/users/${encodeURIComponent(username)}/friends`)
      .then((data) => { if (!cancelado) setLista(data.friends) })
      .catch((err) => {
        if (cancelado) return
        if (err.status === 401) return cerrarSesion()
        setError(err.message)
      })

    return () => { cancelado = true }
  }, [username, cerrarSesion])

  if (error) return <Mensaje texto={error} />
  if (!lista) return <Cargando texto={t('social.cargando')} centrado />
  if (lista.length === 0) return <p className="estado">{t('publico.sinAmigos', { usuario: username })}</p>

  // Una acción sobre alguien de la lista: actualizo su tarjeta y aviso al padre
  function alCambiar(persona) {
    setLista((previa) => previa.map((p) => (p.username === persona.username ? persona : p)))
    onCambio()
  }

  return <RejillaPersonas personas={lista} onCambio={alCambiar} cerrarSesion={cerrarSesion} />
}

export default AmigosAjenos
