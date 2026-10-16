import { useState, useEffect, useCallback, useRef } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { apiFetch } from './api'
import PestanasPerfil from './PestanasPerfil'
import RejillaPersonas from './RejillaPersonas'
import FilaPersona from './FilaPersona'
import SalaCabecera from './SalaCabecera'
import DetalleJuego from './DetalleJuego'
import Actividad from './Actividad'
import LateralSala from './LateralSala'
import Invitaciones from './Invitaciones'
import Descubrir from './Descubrir'
import ChatDock from './ChatDock'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useCambioVista } from './useCambioVista'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'
import { usernameRegex } from './validacion'

const PESTANAS = ['actividad', 'amigos', 'solicitudes', 'descubrir', 'bloqueados']

// Página Social: "tu sala". Arriba, la cabecera con tus amigos como huecos de un lobby; debajo,
// cinco pestañas en una barra: lo que hacen tus amigos, tus amigos, las solicitudes, gente
// nueva y los bloqueados. Y, abajo a la derecha, el chat: un botón discreto que despliega el
// panel hacia arriba (ChatDock), sin ser una pestaña más.
//  - Todo se pide junto al entrar y se vuelve a pedir tras cada acción (aceptar, eliminar...):
//    así lo que se ve es siempre lo que hay en el servidor.
//  - La pestaña activa va en la URL (?tab=solicitudes) y es la ÚNICA fuente de verdad: cualquier
//    enlace a otra pestaña funciona sin más.
//  - El chat también: ?chat=ana es el panel abierto en la conversación con ana, ?chat= (vacío) el
//    panel abierto en la lista, y sin el parámetro, cerrado. Es independiente de la pestaña: el
//    botón Mensaje de un carnet abre el chat sin sacarte de donde estás. El chat solo se monta
//    mientras está abierto (sondea el servidor cada pocos segundos).
function Social({ setToken }) {
  const { t } = useIdioma()
  const { refrescarSolicitudes, mensajes } = useOutletContext()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  // Sube tras cada acción: es lo que hace que el efecto vuelva a pedir las listas
  const [version, setVersion] = useState(0)
  const [filtro, setFiltro] = useState("")
  // El juego de "Para jugar juntos" cuya ficha está abierta (o null)
  const [ficha, setFicha] = useState(null)

  const [params, setParams] = useSearchParams()
  // La pestaña de la dirección: mueve el indicador al instante. "mostrada" es el panel visible y
  // la alcanza cuando el anterior acaba de desvanecerse (igual que en Perfil).
  const tab = PESTANAS.includes(params.get('tab')) ? params.get('tab') : 'actividad'
  const [mostrada, setMostrada] = useState(tab)
  const { saliendo, cambiar } = useCambioVista()

  useEffect(() => {
    if (tab !== mostrada) cambiar(() => setMostrada(tab))
  }, [tab, mostrada, cambiar])

  // El chat: ?chat=ana (conversación), ?chat= (lista) o ausente (cerrado)
  const chatParam = params.get('chat')
  const chatAbierto = chatParam !== null
  const con = chatParam && usernameRegex.test(chatParam) ? chatParam : null
  // La última conversación abierta: al cerrar el panel y volver a abrirlo sigue donde estaba, y
  // mientras el panel se pliega no salta a la lista
  const [conChat, setConChat] = useState(con)
  if (chatAbierto && con !== conChat) setConChat(con)
  // Lo que había escrito a medias en cada conversación; sobrevive a cerrar el panel
  const borradores = useRef(new Map())

  // Cambia un parámetro de la dirección sin tocar los demás (la pestaña y el chat son
  // independientes)
  function cambiarParam(clave, valor) {
    setParams((previos) => {
      const nuevos = new URLSearchParams(previos)
      if (valor === null) nuevos.delete(clave)
      else nuevos.set(clave, valor)
      return nuevos
    }, { replace: true })
  }

  function irA(id) {
    if (id !== tab) cambiarParam('tab', id)
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
      apiFetch('/friends/games'),
    ])
      .then(([amigos, solicitudes, bloqueos, actividad, sugerencias, juegos]) => {
        if (cancelado) return
        setError("")
        setDatos({
          amigos: amigos.friends,
          recibidas: solicitudes.received,
          enviadas: solicitudes.sent,
          bloqueados: bloqueos.blocks,
          actividad: actividad.activity,
          sugerencias: sugerencias.suggestions,
          juegos: juegos.games,
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

  // Añadir a mi biblioteca el juego de la ficha. Relanza el error: BotonAnadir lo enseña.
  async function anadirJuego(juego) {
    try {
      await apiFetch('/games', {
        method: 'POST',
        body: { igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url },
      })
      alCambiar()
    } catch (err) {
      if (err.status === 401) cerrarSesion()
      throw err
    }
  }

  const cargando = !datos && !error
  const recibidas = datos?.recibidas ?? []

  // Los amigos filtrados por lo que se escribe en el filtro de la pestaña
  const filtrados = datos
    ? datos.amigos.filter((a) => a.username.includes(filtro.trim().toLowerCase()))
    : []

  const contenido = {
    actividad: datos && (
      <div className={datos.amigos.length > 0 ? "sala-dos-columnas" : undefined}>
        <Actividad amigos={datos.amigos} actividad={datos.actividad} onIrADescubrir={() => irA('descubrir')} />
        {datos.amigos.length > 0 && (
          <LateralSala
            recibidas={comoRelacion(datos.recibidas, 'recibida')}
            sugerencias={comoRelacion(datos.sugerencias, 'ninguna')}
            juegos={datos.juegos}
            onAbrirJuego={setFicha}
            onCambio={alCambiar}
            cerrarSesion={cerrarSesion}
            irA={irA}
          />
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

  return (
    <div className="sala">
      <SalaCabecera
        amigos={datos?.amigos ?? null}
        actividad={datos?.actividad}
        onInvitar={() => irA('descubrir')}
        onVerAmigos={() => irA('amigos')}
      />

      <PestanasPerfil
        variante="barra"
        pestanas={pestanas}
        activa={tab}
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

      <ChatDock
        abierto={chatAbierto}
        sinLeer={mensajes}
        username={conChat}
        borradores={borradores}
        setToken={setToken}
        onAbrir={() => cambiarParam('chat', conChat ?? '')}
        onCerrar={() => cambiarParam('chat', null)}
      />

      {ficha && (
        <DetalleJuego
          juego={ficha}
          // Si ya lo tengo no hay nada que añadir: la ficha solo enseña el juego
          onAnadir={ficha.mine ? undefined : () => anadirJuego(ficha)}
          onCerrar={() => setFicha(null)}
        />
      )}
    </div>
  )
}

export default Social
