import { useState, useEffect, useCallback } from 'react'
import { useParams, useOutletContext, Link, Navigate } from 'react-router-dom'
import { apiFetch } from './api'
import CabeceraPerfil from './CabeceraPerfil'
import EstadisticasPerfil from './EstadisticasPerfil'
import AccionAmistad from './AccionAmistad'
import DialogoConfirmar from './DialogoConfirmar'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'

// El perfil de otra persona (/usuarios/:username): el mismo banner que el mío, sin editar,
// con los botones de la amistad y solo lo que esa persona deja ver. Lo que no se puede ver
// no llega del servidor (viene null): aquí solo se explica por qué no hay más.
function PerfilPublico({ setToken }) {
  const { t } = useIdioma()
  const { username } = useParams()
  const { refrescarSolicitudes } = useOutletContext()
  // undefined = cargando; null = no existe; objeto = el perfil
  const [usuario, setUsuario] = useState(undefined)
  const [error, setError] = useState("")
  const [bloqueando, setBloqueando] = useState(false)
  const [errorBloqueo, setErrorBloqueo] = useState("")

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setToken("")
  }, [setToken])

  useEffect(() => {
    let cancelado = false

    apiFetch(`/users/${encodeURIComponent(username)}`)
      .then((data) => { if (!cancelado) { setUsuario(data.user); setError("") } })
      .catch((err) => {
        if (cancelado) return
        if (err.status === 401) return cerrarSesion()
        if (err.status === 404) return setUsuario(null)
        setError(err.message)
      })

    return () => {
      cancelado = true
      setUsuario(undefined)
    }
  }, [username, cerrarSesion])

  // Mi propio nombre: me llevo a mi perfil de verdad, el editable
  if (usuario?.relation === 'self') return <Navigate to="/perfil" replace />

  if (usuario === null) {
    return (
      <div className="estado-vacio">
        <p>{t('publico.noEncontrado')}</p>
        <Link to="/amigos?tab=buscar" className="btn btn--primario">{t('publico.volver')}</Link>
      </div>
    )
  }

  if (error) return <Mensaje texto={error} />
  if (usuario === undefined) return <Cargando texto={t('publico.cargando')} tamano="grande" centrado />

  // La amistad cambió desde aquí (añadir, aceptar...): actualizo la relación del perfil y
  // aviso a la barra para que ponga al día la insignia
  function alCambiar(persona) {
    setUsuario((previo) => ({ ...previo, relation: persona.relation, friendship_id: persona.friendship_id }))
    refrescarSolicitudes()
  }

  async function bloquear() {
    setBloqueando(false)
    setErrorBloqueo("")
    try {
      await apiFetch('/friends/blocks', { method: 'POST', body: { username: usuario.username } })
      setUsuario({ username: usuario.username, has_avatar: usuario.has_avatar, relation: 'bloqueado', personal: null, library: null })
      refrescarSolicitudes()
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setErrorBloqueo(err.message)
    }
  }

  const esBloqueado = usuario.relation === 'bloqueado'
  const nombre = usuario.username

  // Por qué no se ve la biblioteca (el nivel lo eligió esa persona)
  const motivoBiblioteca = usuario.library_level === 'amigos'
    ? t('publico.bibliotecaAmigos', { usuario: nombre })
    : t('publico.bibliotecaNadie', { usuario: nombre })

  const acciones = (
    <>
      <AccionAmistad persona={usuario} onCambio={alCambiar} cerrarSesion={cerrarSesion} />
      {!esBloqueado && (
        <button type="button" className="btn btn--secundario" onClick={() => setBloqueando(true)}>
          {t('amistad.bloquear')}
        </button>
      )}
    </>
  )

  return (
    <div className="perfil">
      <CabeceraPerfil
        perfil={{ ...usuario, ...usuario.personal }}
        propio={false}
        stats={usuario.library?.stats}
        acciones={acciones}
      />

      <Mensaje texto={errorBloqueo} />

      <div className="panel-perfil panel-perfil--compacto vista">
        {esBloqueado && <p className="estado">{t('publico.bloqueado', { usuario: nombre })}</p>}

        {!esBloqueado && usuario.library && (
          <>
            <header className="panel-perfil__cabecera">
              <h2 className="titulo-seccion">{t('perfil.estadisticas')}</h2>
            </header>
            <EstadisticasPerfil stats={usuario.library.stats} mejores={usuario.library.mejores} soloLectura />
          </>
        )}

        {!esBloqueado && !usuario.library && <p className="estado">{motivoBiblioteca}</p>}
      </div>

      {bloqueando && (
        <DialogoConfirmar
          titulo={t('amistad.bloquearTitulo', { usuario: nombre })}
          mensaje={t('amistad.bloquearMensaje')}
          textoConfirmar={t('amistad.bloquear')}
          onConfirmar={bloquear}
          onCancelar={() => setBloqueando(false)}
        />
      )}
    </div>
  )
}

export default PerfilPublico
