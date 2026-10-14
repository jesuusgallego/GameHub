import { useState, useEffect } from 'react'
import { apiFetch } from './api'
import ListaPersonas from './ListaPersonas'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useIdioma } from './IdiomaContext'

const RETARDO_BUSQUEDA_MS = 350
const MINIMO = 2

// Buscar personas por el principio de su nombre de usuario. Misma idea que la búsqueda de
// juegos: espero a que se deje de escribir (debounce) y cancelo la petición anterior si
// llega otra (AbortController), para que una respuesta lenta no pise a una más reciente.
//  - onCambio(): una acción terminó (el padre recarga sus listas)
//  - cerrarSesion(): para un 401
function BuscarPersonas({ onCambio, cerrarSesion }) {
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

  // Una acción sobre un resultado: lo actualizo en su sitio (sigue en la lista, con su
  // botón nuevo) y aviso al padre para que recargue las listas y la insignia
  function alCambiar(persona) {
    setResultados((previos) => previos.map((p) => (p.username === persona.username ? persona : p)))
    onCambio()
  }

  return (
    <div className="buscar-personas">
      <label className="campo">
        <span>{t('amigos.buscarEtiqueta')}</span>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={t('amigos.buscarPlaceholder')}
          maxLength={20}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <small>{t('amigos.buscarAyuda', { min: MINIMO })}</small>
      </label>

      <Mensaje texto={error} />
      {buscando && <Cargando texto={t('amigos.buscando')} />}

      {valido && !buscando && !error && resultados.length === 0 && termino === resuelto && (
        <p className="estado">{t('amigos.sinResultados', { q: termino })}</p>
      )}

      {valido && resultados.length > 0 && (
        <ListaPersonas personas={resultados} onCambio={alCambiar} cerrarSesion={cerrarSesion} />
      )}
    </div>
  )
}

export default BuscarPersonas
