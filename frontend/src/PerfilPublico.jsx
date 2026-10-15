import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useOutletContext, useSearchParams, Link, Navigate } from 'react-router-dom'
import { apiFetch } from './api'
import Avatar from './Avatar'
import CabeceraPerfil from './CabeceraPerfil'
import PestanasPerfil from './PestanasPerfil'
import EstadisticasPerfil from './EstadisticasPerfil'
import BibliotecaAjena from './BibliotecaAjena'
import AmigosAjenos from './AmigosAjenos'
import AvisoPrivado from './AvisoPrivado'
import AccionAmistad from './AccionAmistad'
import DialogoConfirmar from './DialogoConfirmar'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useCambioVista } from './useCambioVista'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'

const PESTANAS = ['resumen', 'biblioteca', 'amigos']

// El perfil de otra persona (/usuarios/:username): el mismo banner que el mío, sin editar,
// con los botones de la amistad y tres pestañas (resumen, biblioteca y amigos). Lo que no
// se puede ver no llega del servidor: aquí solo se explica por qué no hay más.
// Los datos de lo que tenemos en común (amigos y juegos) salen en unas etiquetas bajo el banner.
function PerfilPublico({ setToken }) {
  const { t } = useIdioma()
  const { username } = useParams()
  const { refrescarSolicitudes } = useOutletContext()
  // undefined = cargando; null = no existe; objeto = el perfil
  const [usuario, setUsuario] = useState(undefined)
  const [error, setError] = useState("")
  const [bloqueando, setBloqueando] = useState(false)
  const [errorBloqueo, setErrorBloqueo] = useState("")

  const [params, setParams] = useSearchParams()
  const pestanaInicial = PESTANAS.includes(params.get('tab')) ? params.get('tab') : 'resumen'
  const [seleccion, setSeleccion] = useState(pestanaInicial)
  const [mostrada, setMostrada] = useState(pestanaInicial)
  // Las pestañas que ya se han abierto alguna vez: la biblioteca y los amigos se piden al
  // abrirlas, no antes (cada una es una petición), y después se quedan montadas
  const [abiertas, setAbiertas] = useState(() => new Set([pestanaInicial]))
  const seleccionRef = useRef(pestanaInicial)
  const { saliendo, cambiar } = useCambioVista()

  function irA(id) {
    if (id === seleccionRef.current) return
    seleccionRef.current = id
    setSeleccion(id)
    setParams({ tab: id }, { replace: true })
    setAbiertas((previas) => new Set(previas).add(id))
    cambiar(() => setMostrada(seleccionRef.current))
  }

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
        <Link to="/social?tab=descubrir" className="btn btn--primario">{t('publico.volver')}</Link>
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
      setUsuario({ username: usuario.username, has_avatar: usuario.has_avatar, relation: 'bloqueado', personal: {}, library: null })
      refrescarSolicitudes()
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setErrorBloqueo(err.message)
    }
  }

  const esBloqueado = usuario.relation === 'bloqueado'
  const nombre = usuario.username
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

  // Por qué no se ve algo (el nivel lo eligió esa persona)
  const motivo = (nivel, claveAmigos, claveNadie) => (
    nivel === 'amigos' ? t(claveAmigos, { usuario: nombre }) : t(claveNadie, { usuario: nombre })
  )

  const enComun = usuario.mutual_friends
  const etiquetas = []
  if (enComun?.total > 0) {
    etiquetas.push(
      <li key="amigos" className="etiqueta-social">
        <span className="avatares-apilados">
          {enComun.people.slice(0, 4).map((p) => <Avatar key={p.username} usuario={p} tamano="pequeno" />)}
        </span>
        {enComun.total === 1 ? t('publico.amigosEnComunUno') : t('publico.amigosEnComun', { n: enComun.total })}
      </li>
    )
  }
  if (typeof usuario.games_in_common === 'number' && usuario.games_in_common > 0) {
    etiquetas.push(<li key="juegos" className="etiqueta-social">{usuario.games_in_common === 1 ? t('publico.juegosEnComunUno') : t('publico.juegosEnComun', { n: usuario.games_in_common })}</li>)
  }
  if (typeof usuario.friends_count === 'number') {
    etiquetas.push(<li key="n" className="etiqueta-social">{usuario.friends_count === 1 ? t('publico.nAmigosUno') : t('publico.nAmigos', { n: usuario.friends_count })}</li>)
  }

  const paneles = {
    resumen: usuario.library
      ? <EstadisticasPerfil stats={usuario.library.stats} mejores={usuario.library.mejores} soloLectura />
      : <AvisoPrivado texto={motivo(usuario.library_level, 'publico.bibliotecaAmigos', 'publico.bibliotecaNadie')} />,
    biblioteca: usuario.library
      ? abiertas.has('biblioteca') && <BibliotecaAjena username={usuario.username} cerrarSesion={cerrarSesion} />
      : <AvisoPrivado texto={motivo(usuario.library_level, 'publico.bibliotecaAmigos', 'publico.bibliotecaNadie')} />,
    amigos: usuario.friends_count !== null && usuario.friends_count !== undefined
      ? abiertas.has('amigos') && <AmigosAjenos username={usuario.username} onCambio={refrescarSolicitudes} cerrarSesion={cerrarSesion} />
      : <AvisoPrivado texto={motivo(usuario.friends_level, 'publico.amigosAmigos', 'publico.amigosNadie')} />,
  }

  return (
    <div className="perfil">
      <CabeceraPerfil
        perfil={{ ...usuario, ...usuario.personal }}
        propio={false}
        stats={usuario.library?.stats}
        acciones={acciones}
      />

      <Mensaje texto={errorBloqueo} />

      {esBloqueado ? (
        <div className="panel-perfil panel-perfil--compacto vista">
          <p className="estado">{t('publico.bloqueado', { usuario: nombre })}</p>
        </div>
      ) : (
        <>
          {etiquetas.length > 0 && <ul className="etiquetas-sociales">{etiquetas}</ul>}

          <div className="perfil__cuerpo">
            <PestanasPerfil
              pestanas={PESTANAS.map((id) => ({ id, etiqueta: t(`publico.tab.${id}`) }))}
              activa={seleccion}
              onCambiar={irA}
              etiqueta={t('publico.secciones')}
            />

            <div className="perfil__paneles">
              {PESTANAS.map((id) => {
                const activo = mostrada === id
                return (
                  <section
                    key={id}
                    id={`panel-${id}`}
                    role="tabpanel"
                    aria-labelledby={`pestana-${id}`}
                    hidden={!activo}
                    className={activo ? (saliendo ? "panel-perfil vista vista--saliendo" : "panel-perfil vista") : "panel-perfil"}
                  >
                    <header className="panel-perfil__cabecera">
                      <h2 className="titulo-seccion">{t(`publico.tab.${id}`)}</h2>
                    </header>
                    {paneles[id]}
                  </section>
                )
              })}
            </div>
          </div>
        </>
      )}

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
