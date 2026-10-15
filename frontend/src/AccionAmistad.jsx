import { useState } from 'react'
import { apiFetch } from './api'
import DialogoConfirmar from './DialogoConfirmar'
import Mensaje from './Mensaje'
import { useIdioma } from './IdiomaContext'

// Los botones que corresponden a la relación con una persona: añadir, aceptar, cancelar,
// eliminar o desbloquear. Los usan el perfil de otra persona y todas las listas de Social.
//  - persona: { username, relation, friendship_id, can_request }; relation es 'ninguna',
//    'enviada', 'recibida', 'amigos' o 'bloqueado'
//  - onCambio(personaNueva): se llama al terminar con la relación ya actualizada
//  - cerrarSesion(): para un 401 (sesión caducada)
function AccionAmistad({ persona, onCambio, cerrarSesion }) {
  const { t } = useIdioma()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const [confirmando, setConfirmando] = useState(false)

  // Hace la petición y, si va bien, avisa del cambio. Mientras tanto desactiva los botones.
  async function ejecutar(peticion) {
    setOcupado(true)
    setError("")
    try {
      const data = await peticion()
      onCambio({ ...persona, relation: data.relation, friendship_id: data.friendship_id ?? null })
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const { username, friendship_id: id } = persona
  const anadir = () => ejecutar(() => apiFetch('/friends/requests', { method: 'POST', body: { username } }))
  const aceptar = () => ejecutar(() => apiFetch(`/friends/requests/${id}/accept`, { method: 'POST' }))
  const quitarSolicitud = () => ejecutar(() => apiFetch(`/friends/requests/${id}`, { method: 'DELETE' }))
  const eliminar = () => ejecutar(() => apiFetch(`/friends/${encodeURIComponent(username)}`, { method: 'DELETE' }))
  const desbloquear = () => ejecutar(() => apiFetch(`/friends/blocks/${encodeURIComponent(username)}`, { method: 'DELETE' }))

  let botones

  switch (persona.relation) {
    case 'ninguna':
      // `can_request` false: esa persona no acepta solicitudes de gente como yo (ver su
      // privacidad). El botón se queda desactivado y explicado, en lugar de dejar pulsar
      // para recibir un error.
      botones = persona.can_request === false ? (
        <button type="button" className="btn btn--secundario" disabled title={t('amistad.noAcepta.ayuda')}>
          {t('amistad.noAcepta')}
        </button>
      ) : (
        <button type="button" className="btn btn--primario" disabled={ocupado} onClick={anadir}>
          {t('amistad.anadir')}
        </button>
      )
      break
    case 'enviada':
      botones = (
        <button type="button" className="btn btn--secundario" disabled={ocupado} onClick={quitarSolicitud}>
          {t('amistad.cancelar')}
        </button>
      )
      break
    case 'recibida':
      botones = (
        <>
          <button type="button" className="btn btn--primario" disabled={ocupado} onClick={aceptar}>
            {t('amistad.aceptar')}
          </button>
          <button type="button" className="btn btn--secundario" disabled={ocupado} onClick={quitarSolicitud}>
            {t('amistad.rechazar')}
          </button>
        </>
      )
      break
    case 'amigos':
      botones = (
        <button type="button" className="btn btn--peligro" disabled={ocupado} onClick={() => setConfirmando(true)}>
          {t('amistad.eliminar')}
        </button>
      )
      break
    case 'bloqueado':
      botones = (
        <button type="button" className="btn btn--secundario" disabled={ocupado} onClick={desbloquear}>
          {t('amistad.desbloquear')}
        </button>
      )
      break
    default:
      return null
  }

  return (
    <div className="accion-amistad">
      <div className="accion-amistad__botones">{botones}</div>
      <Mensaje texto={error} />

      {confirmando && (
        <DialogoConfirmar
          titulo={t('amistad.eliminarTitulo', { usuario: username })}
          mensaje={t('amistad.eliminarMensaje')}
          textoConfirmar={t('amistad.eliminar')}
          onConfirmar={() => { setConfirmando(false); eliminar() }}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}

export default AccionAmistad
