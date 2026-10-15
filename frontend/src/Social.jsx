import { useState, useEffect, useCallback, useRef } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { apiFetch } from './api'
import PestanasPerfil from './PestanasPerfil'
import RejillaPersonas from './RejillaPersonas'
import FilaPersona from './FilaPersona'
import AvatarTono from './AvatarTono'
import Actividad from './Actividad'
import LateralSala from './LateralSala'
import Invitaciones from './Invitaciones'
import Descubrir from './Descubrir'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useCambioVista } from './useCambioVista'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'

const PESTANAS = ['actividad', 'amigos', 'solicitudes', 'descubrir', 'bloqueados']

// Página Social: "tu sala". Arriba, quién está en tu grupo; debajo, cinco pestañas en una
// barra: lo que hacen tus amigos, tus amigos, las solicitudes, gente nueva y los bloqueados.
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
  const recibidas = datos?.recibidas ?? []
  const jugandoAhora = datos ? datos.amigos.filter((a) => a.playing).length : 0

  // Los amigos filtrados por lo que se escribe en el filtro de la pestaña
  const filtrados = datos
    ? datos.amigos.filter((a) => a.username.includes(filtro.trim().toLowerCase()))
    : []

  const contenido = {
    actividad: datos && (
      <div className={datos.amigos.length > 0 ? "sala-dos-columnas" : undefined}>
        <Actividad amigos={datos.amigos} actividad={datos.actividad} onIrADescubrir={() => irA('descubrir')} />
        {datos.amigos.length > 0 && (
          <LateralSala amigos={datos.amigos} recibidas={recibidas} sugerencias={datos.sugerencias} irA={irA} />
        )}
      </div>
    ),
    amigos: datos && (
      datos.amigos.length === 0 ? (
        <div className="sala-vacia">
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
            <p className="sala-vacio">{t('social.filtroSinResultados', { q: filtro.trim() })}</p>
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
      <Invitaciones
        recibidas={comoRelacion(datos.recibidas, 'recibida')}
        enviadas={comoRelacion(datos.enviadas, 'enviada')}
        onCambio={alCambiar}
        cerrarSesion={cerrarSesion}
      />
    ),
    descubrir: datos && (
      <Descubrir sugerencias={datos.sugerencias} onCambio={alCambiar} cerrarSesion={cerrarSesion} />
    ),
    bloqueados: datos && (
      datos.bloqueados.length === 0
        ? <p className="sala-vacio">{t('social.sinBloqueados')}</p>
        : (
          <ul className="filas">
            {comoRelacion(datos.bloqueados, 'bloqueado').map((p, i) => (
              <FilaPersona key={p.username} persona={p} orden={i} onCambio={alCambiar} cerrarSesion={cerrarSesion} />
            ))}
          </ul>
        )
    ),
  }

  const pestanas = PESTANAS.map((id) => ({
    id,
    etiqueta: t(`social.tab.${id}`),
    contador: id === 'solicitudes' ? recibidas.length : id === 'amigos' ? (datos?.amigos.length ?? 0) : 0,
  }))

  // El grupo de la cabecera: hasta 6 fotos, las de quienes juegan primero
  const grupo = datos
    ? [...datos.amigos].sort((a, b) => Number(Boolean(b.playing)) - Number(Boolean(a.playing))).slice(0, 6)
    : []

  return (
    <div className="sala">
      <header className="banner-perfil sala-cabecera">
        <div className="banner-perfil__fondo" aria-hidden="true" />
        <div className="sala-cabecera__contenido">
          <div className="sala-cabecera__texto">
            <span className="sala-cabecera__sobre">{t('social.sobretitulo')}</span>
            <h1 className="sala-cabecera__titulo">{t('social.titulo')}</h1>
            <p>{t('social.subtitulo')}</p>
          </div>

          <div className="sala-cabecera__grupo">
            {grupo.length > 0 && (
              <ul className="grupo-fotos" aria-hidden="true">
                {grupo.map((a) => (
                  <li key={a.username}><AvatarTono usuario={a} tamano="normal" vivo={Boolean(a.playing)} /></li>
                ))}
              </ul>
            )}
            <p className="sala-cabecera__resumen">
              {datos
                ? (
                  <>
                    <strong>{datos.amigos.length}</strong> {datos.amigos.length === 1 ? t('social.amigoUno') : t('social.amigos')}
                    {jugandoAhora > 0 && (
                      <span className="sala-cabecera__jugando">
                        <span className="sala-titulo__punto" aria-hidden="true" />
                        {t('social.jugandoN', { n: jugandoAhora })}
                      </span>
                    )}
                  </>
                )
                : "…"}
            </p>
          </div>
        </div>
      </header>

      <PestanasPerfil
        variante="barra"
        pestanas={pestanas}
        activa={seleccion}
        onCambiar={irA}
        etiqueta={t('social.secciones')}
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
              <Mensaje texto={activo ? error : ""} />
              {cargando && activo && <Cargando texto={t('social.cargando')} centrado />}
              {contenido[id]}
            </section>
          )
        })}
      </div>
    </div>
  )
}

export default Social
