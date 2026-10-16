import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useOutletContext, useSearchParams, Link, Navigate } from 'react-router-dom'
import { apiFetch } from './api'
import CabeceraPerfil from './CabeceraPerfil'
import PestanasPerfil from './PestanasPerfil'
import EstadisticasPerfil from './EstadisticasPerfil'
import BibliotecaAjena from './BibliotecaAjena'
import AmigosAjenos from './AmigosAjenos'
import AvisoPrivado from './AvisoPrivado'
import AccionAmistad from './AccionAmistad'
import BandaEnComun from './BandaEnComun'
import CaraACara from './CaraACara'
import EnComun from './EnComun'
import DetalleJuego from './DetalleJuego'
import DialogoConfirmar from './DialogoConfirmar'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useCambioVista } from './useCambioVista'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'

const PESTANAS = ['resumen', 'biblioteca', 'comun', 'amigos']

// El perfil de otra persona (/usuarios/:username): su banner (teñido con su color), los
// botones de la amistad, una banda con lo que tenéis en común y cuatro pestañas: resumen (con
// el "cara a cara" de las dos bibliotecas), biblioteca, en común y amigos. Pulsar un juego
// abre su ficha con la partida de esa persona. Lo que no se puede ver no llega del servidor:
// aquí solo se explica por qué no hay más.
function PerfilPublico({ setToken }) {
  const { t } = useIdioma()
  const { username } = useParams()
  const { perfil: yo, refrescarSolicitudes } = useOutletContext()
  // undefined = cargando; null = no existe; objeto = el perfil
  const [usuario, setUsuario] = useState(undefined)
  const [error, setError] = useState("")
  const [bloqueando, setBloqueando] = useState(false)
  const [errorBloqueo, setErrorBloqueo] = useState("")
  // Lo que tenemos en común (null mientras llega) y mis estadísticas, para el cara a cara
  const [comun, setComun] = useState(null)
  const [misStats, setMisStats] = useState(null)
  // La ficha abierta: { juego, logrosVisibles, resenasVisibles } o null
  const [ficha, setFicha] = useState(null)
  // Sube cuando añado un juego a mi biblioteca desde aquí: las listas se piden otra vez
  const [cambios, setCambios] = useState(0)

  const [params, setParams] = useSearchParams()
  const pestanaInicial = PESTANAS.includes(params.get('tab')) ? params.get('tab') : 'resumen'
  const juegoInicial = params.get('juego')
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
    // Al cambiar de pestaña el juego de la URL (si venía de la actividad) ya no pinta nada
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
      setComun(null)
      setMisStats(null)
    }
  }, [username, cerrarSesion])

  // Lo que tenemos en común y mis cifras (para el cara a cara). Solo con la persona ya
  // cargada, y no si soy yo ni si la he bloqueado
  const comparar = usuario && usuario.relation !== 'self' && usuario.relation !== 'bloqueado'
  const hayBiblioteca = Boolean(usuario?.library)

  useEffect(() => {
    if (!comparar) return
    let cancelado = false

    apiFetch(`/users/${encodeURIComponent(username)}/common`)
      .then((data) => { if (!cancelado) setComun(data) })
      .catch((err) => {
        if (cancelado) return
        if (err.status === 401) cerrarSesion()
        // Sin "en común" el perfil sigue valiendo: la banda no sale y la pestaña avisa
      })

    return () => { cancelado = true }
  }, [username, comparar, cambios, cerrarSesion])

  useEffect(() => {
    if (!comparar || !hayBiblioteca) return
    let cancelado = false

    apiFetch('/profile/stats')
      .then((data) => { if (!cancelado) setMisStats(data.stats) })
      .catch(() => {})

    return () => { cancelado = true }
  }, [comparar, hayBiblioteca, cambios])

  // Abre la ficha de un juego de esta persona. `datos` dice si deja ver sus logros y reseñas
  const abrirFicha = useCallback((juego, datos) => {
    setFicha({
      juego,
      logrosVisibles: Boolean(datos?.achievements_visible),
      resenasVisibles: Boolean(datos?.reviews_visible),
    })
  }, [])

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

  // Añadir a mi biblioteca el juego de la ficha. Relanza el error: BotonAnadir lo enseña.
  async function anadirJuego(juego) {
    try {
      await apiFetch('/games', {
        method: 'POST',
        body: { igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url },
      })
      setCambios((c) => c + 1)
    } catch (err) {
      if (err.status === 401) cerrarSesion()
      throw err
    }
  }

  const esBloqueado = usuario.relation === 'bloqueado'
  const nombre = usuario.username
  const acciones = (
    <>
      {usuario.relation === 'amigos' && (
        <Link to={`/chat/${nombre}`} className="btn btn--primario">{t('chat.enviarMensaje')}</Link>
      )}
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
  const motivoBiblioteca = motivo(usuario.library_level, 'publico.bibliotecaAmigos', 'publico.bibliotecaNadie')

  const pestanas = PESTANAS.map((id) => ({
    id,
    etiqueta: t(`publico.tab.${id}`),
    contador: id === 'biblioteca' ? (usuario.library?.stats.total ?? 0)
      : id === 'comun' ? (comun ? (comun.games?.length ?? 0) + comun.friends.length : 0)
        : id === 'amigos' ? (usuario.friends_count ?? 0)
          : 0,
  }))

  const paneles = {
    resumen: usuario.library ? (
      <>
        <CaraACara yo={yo ?? { username: '' }} otro={usuario} misStats={misStats} susStats={usuario.library.stats} />
        <EstadisticasPerfil stats={usuario.library.stats} mejores={usuario.library.mejores} soloLectura />
      </>
    ) : (
      <AvisoPrivado texto={motivoBiblioteca} />
    ),
    biblioteca: usuario.library
      ? abiertas.has('biblioteca') && (
        <BibliotecaAjena
          username={usuario.username}
          juegoInicial={juegoInicial}
          onAbrir={abrirFicha}
          cambios={cambios}
          cerrarSesion={cerrarSesion}
        />
      )
      : <AvisoPrivado texto={motivoBiblioteca} />,
    comun: (
      <EnComun
        nombre={nombre}
        comun={comun}
        motivoPrivado={motivoBiblioteca}
        onAbrirJuego={(fila) => abrirFicha(fila, comun)}
        onCambio={refrescarSolicitudes}
        cerrarSesion={cerrarSesion}
      />
    ),
    amigos: usuario.friends_count !== null && usuario.friends_count !== undefined
      ? abiertas.has('amigos') && <AmigosAjenos username={usuario.username} onCambio={refrescarSolicitudes} cerrarSesion={cerrarSesion} />
      : <AvisoPrivado texto={motivo(usuario.friends_level, 'publico.amigosAmigos', 'publico.amigosNadie')} />,
  }

  return (
    <div className="perfil perfil-amigo">
      <CabeceraPerfil
        perfil={{ ...usuario, ...usuario.personal }}
        propio={false}
        conTono
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
          <BandaEnComun comun={comun} onVer={() => irA('comun')} />

          <PestanasPerfil
            variante="barra"
            pestanas={pestanas}
            activa={seleccion}
            onCambiar={irA}
            etiqueta={t('publico.secciones')}
          />

          <div className="sala-paneles">
            {PESTANAS.map((id) => {
              const activo = mostrada === id
              return (
                <section
                  key={id}
                  id={`panel-${id}`}
                  role="tabpanel"
                  aria-labelledby={`pestana-${id}`}
                  hidden={!activo}
                  className={activo ? (saliendo ? "sala-panel vista vista--saliendo" : "sala-panel vista") : "sala-panel"}
                >
                  {paneles[id]}
                </section>
              )
            })}
          </div>
        </>
      )}

      {ficha && (
        <DetalleJuego
          juego={ficha.juego}
          ajeno={{
            usuario,
            juego: ficha.juego,
            logrosVisibles: ficha.logrosVisibles,
            resenasVisibles: ficha.resenasVisibles,
          }}
          onAnadir={() => anadirJuego(ficha.juego)}
          onCerrar={() => setFicha(null)}
        />
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
