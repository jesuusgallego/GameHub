import { useState, useEffect, useCallback, useRef } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { apiFetch } from './api'
import Cargando from './Cargando'
import CabeceraPerfil from './CabeceraPerfil'
import PestanasPerfil from './PestanasPerfil'
import EstadisticasPerfil from './EstadisticasPerfil'
import EditarPerfil from './EditarPerfil'
import CuentaPerfil from './CuentaPerfil'
import CuentasVinculadas from './CuentasVinculadas'
import Mensaje from './Mensaje'
import { useCambioVista } from './useCambioVista'
import { useIdioma } from './IdiomaContext'
import { borrarToken, escribirToken } from './sesion'

const PESTANAS = ['resumen', 'editar', 'cuentas', 'seguridad']

// Página del perfil: un banner con los datos del usuario y, debajo, cuatro pestañas
// (estadísticas, editar perfil, cuentas vinculadas y seguridad).
//  - El perfil (nombre, foto...) llega de Layout, que lo comparte con la barra
//    para que el avatar se actualice a la vez en los dos sitios.
//  - Las estadísticas las pido aquí, cada vez que entro (y tras sincronizar Steam),
//    para que estén al día.
//  - La pestaña activa va en la URL (?tab=cuentas): sobrevive a recargar la página y
//    se puede enlazar directamente.
//  - Los cuatro paneles están siempre montados y solo se oculta el que no toca: así
//    lo que se estaba escribiendo en "Editar perfil" no se pierde al cambiar de pestaña.
function Perfil({ setToken }) {
  const { t } = useIdioma()
  const { perfil, setPerfil } = useOutletContext()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  // Sube cada vez que se sincroniza Steam: las estadísticas dependen de ella y
  // así se vuelven a pedir (importar juegos cambia los totales)
  const [version, setVersion] = useState(0)

  const [params, setParams] = useSearchParams()
  const pestanaInicial = PESTANAS.includes(params.get('tab')) ? params.get('tab') : 'resumen'
  // "seleccion" mueve el indicador de las pestañas al instante; "mostrada" es el
  // panel que se ve y cambia cuando acaba de desvanecerse el anterior. Cuando hay
  // un clic rápido encima de otro, la ref hace que gane siempre la última elección.
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

  // useCallback para que sea la misma función en cada render: CuentasVinculadas
  // la usa en un useEffect y, si cambiara, volvería a pedir sus datos cada vez
  const cerrarSesion = useCallback(() => {
    borrarToken()
    setToken("")
  }, [setToken])

  // Al cambiar la contraseña el servidor cierra todas las sesiones abiertas y manda un
  // token nuevo para esta: lo guardo y sigo dentro. apiFetch lee el token de
  // localStorage en cada petición, así que basta con cambiarlo ahí (y en el estado de App).
  const guardarToken = useCallback((token) => {
    escribirToken(token)
    setToken(token)
  }, [setToken])

  useEffect(() => {
    let cancelado = false

    apiFetch('/profile/stats')
      .then((data) => {
        if (!cancelado) setDatos(data)
      })
      .catch((err) => {
        if (cancelado) return

        if (err.status === 401) {
          borrarToken()
          setToken("")
          return
        }

        setError(err.message)
      })

    return () => { cancelado = true }
  }, [setToken, version])

  // Hasta que llegue el perfil no hay nada que enseñar
  if (!perfil) return <Cargando texto={t('perfil.cargando')} tamano="grande" centrado />

  const paneles = [
    {
      id: 'resumen',
      etiqueta: t('perfil.estadisticas'),
      ayuda: t('perfil.resumenAyuda'),
      contenido: (
        <>
          <Mensaje texto={error} />
          {!error && !datos && <Cargando texto={t('perfil.calculando')} centrado />}
          {datos && <EstadisticasPerfil stats={datos.stats} mejores={datos.mejores} />}
        </>
      ),
    },
    {
      id: 'editar',
      etiqueta: t('perfil.editar'),
      ayuda: t('perfil.editarAyuda'),
      contenido: <EditarPerfil perfil={perfil} onGuardado={setPerfil} cerrarSesion={cerrarSesion} />,
    },
    {
      id: 'cuentas',
      etiqueta: t('perfil.vinculadas'),
      ayuda: t('perfil.vinculadasAyuda'),
      contenido: <CuentasVinculadas cerrarSesion={cerrarSesion} onSincronizado={() => setVersion((v) => v + 1)} />,
    },
    {
      id: 'seguridad',
      etiqueta: t('perfil.seguridad'),
      ayuda: t('perfil.seguridadAyuda'),
      contenido: <CuentaPerfil perfil={perfil} onGuardado={setPerfil} cerrarSesion={cerrarSesion} guardarToken={guardarToken} />,
    },
  ]

  return (
    <div className="perfil">
      <CabeceraPerfil
        perfil={perfil}
        stats={datos?.stats ?? null}
        onEditar={() => irA('editar')}
      />

      <div className="perfil__cuerpo">
        <PestanasPerfil
          pestanas={paneles.map(({ id, etiqueta }) => ({ id, etiqueta }))}
          activa={seleccion}
          onCambiar={irA}
          etiqueta={t('perfil.secciones')}
        />

        <div className="perfil__paneles">
          {paneles.map(({ id, etiqueta, ayuda, contenido }) => {
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
                {contenido}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Perfil
