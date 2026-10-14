import { useState, useEffect, useCallback, useRef } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { apiFetch } from './api'
import PestanasPerfil from './PestanasPerfil'
import ListaPersonas from './ListaPersonas'
import BuscarPersonas from './BuscarPersonas'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useCambioVista } from './useCambioVista'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'

const PESTANAS = ['amigos', 'solicitudes', 'buscar', 'bloqueados']

// Página de Amigos: mis amigos, las solicitudes (recibidas y enviadas), buscar gente y
// a quién he bloqueado. Reutiliza la estructura del perfil (pestañas a la izquierda y
// paneles a la derecha, con el mismo cambio animado).
//  - Las tres listas se piden juntas al entrar y se vuelven a pedir tras cada acción
//    (aceptar, eliminar...): así lo que se ve es siempre lo que hay en el servidor.
//  - La pestaña activa va en la URL (?tab=solicitudes).
function Amigos({ setToken }) {
  const { t } = useIdioma()
  const { refrescarSolicitudes } = useOutletContext()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  // Sube tras cada acción: es lo que hace que el efecto vuelva a pedir las listas
  const [version, setVersion] = useState(0)

  const [params, setParams] = useSearchParams()
  const pestanaInicial = PESTANAS.includes(params.get('tab')) ? params.get('tab') : 'amigos'
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

    Promise.all([apiFetch('/friends'), apiFetch('/friends/requests'), apiFetch('/friends/blocks')])
      .then(([amigos, solicitudes, bloqueos]) => {
        if (cancelado) return
        setError("")
        setDatos({
          amigos: amigos.friends,
          recibidas: solicitudes.received,
          enviadas: solicitudes.sent,
          bloqueados: bloqueos.blocks,
        })
      })
      .catch((err) => {
        if (cancelado) return
        if (err.status === 401) return cerrarSesion()
        setError(err.message)
      })

    return () => { cancelado = true }
  }, [version, cerrarSesion])

  // Una acción terminó: recargo las listas y aviso a la barra para que ponga al día la
  // insignia con las solicitudes pendientes
  const alCambiar = useCallback(() => {
    setVersion((v) => v + 1)
    refrescarSolicitudes()
  }, [refrescarSolicitudes])

  // Las filas de cada lista traen la relación que les toca (la API no la manda: es la
  // de la propia lista)
  const comoRelacion = (lista, relation) => lista.map((p) => ({
    ...p,
    relation,
    // Las solicitudes traen su id como `id`; la acción lo espera como friendship_id
    friendship_id: p.id ?? null,
  }))

  const cargando = !datos && !error
  const contenido = {
    amigos: datos && (
      datos.amigos.length === 0 ? (
        <div className="estado-vacio">
          <p>{t('amigos.vacio')}</p>
          <button type="button" className="btn btn--primario" onClick={() => irA('buscar')}>
            {t('amigos.irBuscar')}
          </button>
        </div>
      ) : (
        <ListaPersonas
          personas={comoRelacion(datos.amigos, 'amigos')}
          onCambio={alCambiar}
          cerrarSesion={cerrarSesion}
        />
      )
    ),
    solicitudes: datos && (
      <div className="solicitudes">
        <section>
          <h3 className="estadisticas__subtitulo">{t('amigos.recibidas')}</h3>
          {datos.recibidas.length === 0
            ? <p className="estado">{t('amigos.sinRecibidas')}</p>
            : <ListaPersonas personas={comoRelacion(datos.recibidas, 'recibida')} onCambio={alCambiar} cerrarSesion={cerrarSesion} />}
        </section>
        <section>
          <h3 className="estadisticas__subtitulo">{t('amigos.enviadas')}</h3>
          {datos.enviadas.length === 0
            ? <p className="estado">{t('amigos.sinEnviadas')}</p>
            : <ListaPersonas personas={comoRelacion(datos.enviadas, 'enviada')} onCambio={alCambiar} cerrarSesion={cerrarSesion} />}
        </section>
      </div>
    ),
    buscar: <BuscarPersonas onCambio={alCambiar} cerrarSesion={cerrarSesion} />,
    bloqueados: datos && (
      datos.bloqueados.length === 0
        ? <p className="estado">{t('amigos.sinBloqueados')}</p>
        : <ListaPersonas personas={comoRelacion(datos.bloqueados, 'bloqueado')} onCambio={alCambiar} cerrarSesion={cerrarSesion} />
    ),
  }

  const recibidas = datos?.recibidas.length ?? 0
  const paneles = PESTANAS.map((id) => ({
    id,
    etiqueta: id === 'solicitudes' && recibidas > 0
      ? `${t('amigos.tab.solicitudes')} (${recibidas})`
      : t(`amigos.tab.${id}`),
    ayuda: t(`amigos.ayuda.${id}`),
  }))

  return (
    <div className="perfil">
      <h1 className="titulo-pagina">{t('amigos.titulo')}</h1>

      <div className="perfil__cuerpo">
        <PestanasPerfil
          pestanas={paneles.map(({ id, etiqueta }) => ({ id, etiqueta }))}
          activa={seleccion}
          onCambiar={irA}
          etiqueta={t('amigos.secciones')}
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
                {id !== 'buscar' && cargando && <Cargando texto={t('amigos.cargando')} centrado />}
                {contenido[id]}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Amigos
