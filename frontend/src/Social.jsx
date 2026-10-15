import { useState, useEffect, useCallback, useRef } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { apiFetch } from './api'
import PestanasPerfil from './PestanasPerfil'
import RejillaPersonas from './RejillaPersonas'
import Actividad from './Actividad'
import Descubrir from './Descubrir'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useCambioVista } from './useCambioVista'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'

const PESTANAS = ['actividad', 'amigos', 'solicitudes', 'descubrir', 'bloqueados']

// Página Social: lo que hacen tus amigos, tus amigos, las solicitudes, gente nueva y los
// bloqueados. Reutiliza la estructura del perfil (pestañas a la izquierda y paneles a la
// derecha, con el mismo cambio animado).
//  - Todo se pide junto al entrar y se vuelve a pedir tras cada acción (aceptar, eliminar...):
//    así lo que se ve es siempre lo que hay en el servidor.
//  - La pestaña activa va en la URL (?tab=solicitudes).
function Social({ setToken }) {
  const { t } = useIdioma()
  const { refrescarSolicitudes } = useOutletContext()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  // Sube tras cada acción: es lo que hace que el efecto vuelva a pedir las listas
  const [version, setVersion] = useState(0)
  const [filtro, setFiltro] = useState("")

  const [params, setParams] = useSearchParams()
  const pestanaInicial = PESTANAS.includes(params.get('tab')) ? params.get('tab') : 'actividad'
  // "seleccion" mueve el indicador al instante; "mostrada" es el panel visible y cambia
  // cuando el anterior acaba de desvanecerse (igual que en Perfil)
  const [seleccion, setSeleccion] = useState(pestanaInicial)
  const [mostrada, setMostrada] = useState(pestanaInicial)
  const seleccionRef = useRef(pestanaInicial)
  const { saliendo, cambiar } = useCambioVista()

  function irA(id) {
    if (id === seleccionRef.current) return
    seleccionRef.current = id
    setSeleccion(id)
    setParams({ tab: id }, { replace: true })
    cambiar(() => setMostrada(seleccionRef.current))
  }

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setToken("")
  }, [setToken])

  useEffect(() => {
    let cancelado = false

    Promise.all([
      apiFetch('/friends'),
      apiFetch('/friends/requests'),
      apiFetch('/friends/blocks'),
      apiFetch('/friends/activity'),
      apiFetch('/friends/suggestions'),
    ])
      .then(([amigos, solicitudes, bloqueos, actividad, sugerencias]) => {
        if (cancelado) return
        setError("")
        setDatos({
          amigos: amigos.friends,
          recibidas: solicitudes.received,
          enviadas: solicitudes.sent,
          bloqueados: bloqueos.blocks,
          actividad: actividad.activity,
          sugerencias: sugerencias.suggestions,
        })
      })
      .catch((err) => {
        if (cancelado) return
        if (err.status === 401) return cerrarSesion()
        setError(err.message)
      })

    return () => { cancelado = true }
  }, [version, cerrarSesion])

  // Una acción terminó: recargo todo y aviso a la barra para que ponga al día la insignia
  // con las solicitudes pendientes
  const alCambiar = useCallback(() => {
    setVersion((v) => v + 1)
    refrescarSolicitudes()
  }, [refrescarSolicitudes])

  // Las filas de cada lista traen la relación que les toca (la API no la manda: es la
  // de la propia lista). Las solicitudes traen su id como `id`; la acción lo espera como
  // friendship_id.
  const comoRelacion = (lista, relation) => lista.map((p) => ({
    ...p,
    relation,
    friendship_id: p.id ?? null,
    can_request: true,
  }))

  const cargando = !datos && !error
  const recibidas = datos?.recibidas.length ?? 0
  const jugandoAhora = datos ? datos.amigos.filter((a) => a.playing).length : 0

  // Los amigos filtrados por lo que se escribe en el filtro de la pestaña
  const filtrados = datos
    ? datos.amigos.filter((a) => a.username.includes(filtro.trim().toLowerCase()))
    : []

  const cifras = [
    { etiqueta: t('social.cifra.amigos'), valor: datos ? datos.amigos.length : "–" },
    { etiqueta: t('social.cifra.jugando'), valor: datos ? jugandoAhora : "–" },
    { etiqueta: t('social.cifra.solicitudes'), valor: datos ? recibidas : "–" },
  ]

  const contenido = {
    actividad: datos && (
      <Actividad amigos={datos.amigos} actividad={datos.actividad} onIrADescubrir={() => irA('descubrir')} />
    ),
    amigos: datos && (
      datos.amigos.length === 0 ? (
        <div className="estado-vacio">
          <p>{t('social.vacio')}</p>
          <button type="button" className="btn btn--primario" onClick={() => irA('descubrir')}>
            {t('social.irDescubrir')}
          </button>
        </div>
      ) : (
        <>
          <label className="campo campo-filtro">
            <span>{t('social.filtrarAmigos')}</span>
            <input
              type="search"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder={t('social.filtrarPlaceholder')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          {filtrados.length === 0 ? (
            <p className="estado">{t('social.filtroSinResultados', { q: filtro.trim() })}</p>
          ) : (
            <RejillaPersonas
              personas={comoRelacion(filtrados, 'amigos')}
              onCambio={alCambiar}
              cerrarSesion={cerrarSesion}
            />
          )}
        </>
      )
    ),
    solicitudes: datos && (
      <div className="solicitudes">
        <section>
          <h3 className="estadisticas__subtitulo">{t('social.recibidas')}</h3>
          {datos.recibidas.length === 0
            ? <p className="estado">{t('social.sinRecibidas')}</p>
            : <RejillaPersonas personas={comoRelacion(datos.recibidas, 'recibida')} onCambio={alCambiar} cerrarSesion={cerrarSesion} />}
        </section>
        <section>
          <h3 className="estadisticas__subtitulo">{t('social.enviadas')}</h3>
          {datos.enviadas.length === 0
            ? <p className="estado">{t('social.sinEnviadas')}</p>
            : <RejillaPersonas personas={comoRelacion(datos.enviadas, 'enviada')} onCambio={alCambiar} cerrarSesion={cerrarSesion} />}
        </section>
      </div>
    ),
    descubrir: datos && (
      <Descubrir sugerencias={datos.sugerencias} onCambio={alCambiar} cerrarSesion={cerrarSesion} />
    ),
    bloqueados: datos && (
      datos.bloqueados.length === 0
        ? <p className="estado">{t('social.sinBloqueados')}</p>
        : <RejillaPersonas personas={comoRelacion(datos.bloqueados, 'bloqueado')} onCambio={alCambiar} cerrarSesion={cerrarSesion} />
    ),
  }

  const paneles = PESTANAS.map((id) => ({
    id,
    etiqueta: id === 'solicitudes' && recibidas > 0
      ? `${t('social.tab.solicitudes')} (${recibidas})`
      : t(`social.tab.${id}`),
    ayuda: t(`social.ayuda.${id}`),
  }))

  return (
    <div className="perfil social">
      <header className="banner-perfil banner-social">
        <div className="banner-perfil__fondo" aria-hidden="true" />
        <div className="banner-perfil__contenido">
          <div className="banner-social__titulo">
            <h1 className="titulo-pagina">{t('social.titulo')}</h1>
            <p className="banner-perfil__meta">{t('social.subtitulo')}</p>
          </div>

          <dl className="banner-perfil__cifras">
            {cifras.map(({ etiqueta, valor }, i) => (
              <div key={etiqueta} className="cifra" style={{ '--orden': i }}>
                <dt className="cifra__etiqueta">{etiqueta}</dt>
                <dd className="cifra__valor">{valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="perfil__cuerpo">
        <PestanasPerfil
          pestanas={paneles.map(({ id, etiqueta }) => ({ id, etiqueta }))}
          activa={seleccion}
          onCambiar={irA}
          etiqueta={t('social.secciones')}
        />

        <div className="perfil__paneles">
          {paneles.map(({ id, etiqueta, ayuda }) => {
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
                  <h2 className="titulo-seccion">{etiqueta}</h2>
                  <p>{ayuda}</p>
                </header>
                <Mensaje texto={activo ? error : ""} />
                {cargando && <Cargando texto={t('social.cargando')} centrado />}
                {contenido[id]}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Social
