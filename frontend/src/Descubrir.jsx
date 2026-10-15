import { useState, useEffect } from 'react'
import { apiFetch } from './api'
import RejillaPersonas from './RejillaPersonas'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useIdioma } from './IdiomaContext'

const RETARDO_BUSQUEDA_MS = 350
const MINIMO = 2

// Encontrar gente nueva: un buscador por el principio del nombre de usuario y, mientras no
// se escribe nada, las personas que quizá conozcas (amigos de tus amigos).
// El buscador espera a que se deje de escribir (debounce) y cancela la petición anterior si
// llega otra (AbortController), para que una respuesta lenta no pise a una más reciente.
//  - sugerencias: lo que devuelve GET /friends/suggestions
//  - onCambio(): una acción terminó; el padre recarga sus listas
//  - cerrarSesion(): para un 401
function Descubrir({ sugerencias, onCambio, cerrarSesion }) {
  const { t } = useIdioma()
  const [texto, setTexto] = useState("")
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState("")
  // El último término cuya búsqueda terminó: mientras sea distinto del escrito, busco
  const [resuelto, setResuelto] = useState("")

  // El servidor usa minúsculas: busco igual aunque se escriba con mayúsculas
  const termino = texto.trim().toLowerCase()
  const valido = /^[a-z0-9_]{2,20}$/.test(termino)
  const buscando = valido && termino !== resuelto

  useEffect(() => {
    if (!valido) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(`/users/search?q=${encodeURIComponent(termino)}`, { signal: controller.signal })
        setResultados(data.results)
        setError("")
        setResuelto(termino)
      } catch (err) {
        if (err.name === 'AbortError') return
        if (err.status === 401) return cerrarSesion()
        setResultados([])
        setError(err.message)
        setResuelto(termino)
      }
    }, RETARDO_BUSQUEDA_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [termino, valido, cerrarSesion])

  // Una acción sobre un resultado: lo actualizo en su sitio (sigue en la rejilla, con su
  // botón nuevo) y aviso al padre para que recargue las listas y la insignia
  function alCambiar(persona) {
    setResultados((previos) => previos.map((p) => (p.username === persona.username ? persona : p)))
    onCambio()
  }

  const hayBusqueda = texto.trim() !== ""

  return (
    <div className="descubrir">
      <label className="campo campo-busqueda">
        <span>{t('social.buscarEtiqueta')}</span>
        <div className="campo-busqueda__caja">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={t('social.buscarPlaceholder')}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <small>{t('social.buscarAyuda', { min: MINIMO })}</small>
      </label>

      <Mensaje texto={error} />

      {hayBusqueda ? (
        <>
          {buscando && <Cargando texto={t('social.buscando')} />}

          {valido && !buscando && !error && resultados.length === 0 && termino === resuelto && (
            <p className="estado">{t('social.sinResultados', { q: termino })}</p>
          )}

          {valido && resultados.length > 0 && (
            <RejillaPersonas personas={resultados} onCambio={alCambiar} cerrarSesion={cerrarSesion} />
          )}
        </>
      ) : (
        <section>
          <h3 className="estadisticas__subtitulo">{t('social.sugerencias')}</h3>
          {sugerencias.length === 0 ? (
            <p className="estado">{t('social.sinSugerencias')}</p>
          ) : (
            <RejillaPersonas
              personas={sugerencias.map((s) => ({ ...s, relation: 'ninguna', friendship_id: null, can_request: true }))}
              onCambio={() => onCambio()}
              cerrarSesion={cerrarSesion}
            />
          )}
        </section>
      )}
    </div>
  )
}

export default Descubrir
