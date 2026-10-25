import { useState, useEffect } from 'react'
import { usePresencia } from './usePresencia'
import { useIdioma } from './IdiomaContext'
import { puedeInstalarseEnIOS, instalarDescartado, descartarInstalar } from './pwa'

// El evento con el que el menú de Ajustes ("Instalar en el iPhone") vuelve a abrir la explicación
export const EVENTO_INSTALAR = 'gamehub:instalar'

// Explicación para instalar GameHub en el iPhone o el iPad. En iOS no hay un botón de "Instalar"
// que una web pueda pulsar por ti: se hace desde el botón Compartir de Safari, "Añadir a pantalla
// de inicio". Esta tarjeta lo cuenta en dos pasos, con el icono de Compartir dibujado igual que en
// Safari (en iOS 26, Compartir ya no está a la vista: está en el menú "⋯", y el paso 1 lo dice).
// Sale sola una vez, al poco de entrar, en iOS y si la app aún no está instalada; al cerrarla no
// vuelve, pero sigue en Ajustes. Entra subiendo desde abajo y sale igual.
function InstalarIOS() {
  const { t } = useIdioma()
  const [visible, setVisible] = useState(false)
  const { montado, saliendo } = usePresencia(visible, 300)

  useEffect(() => {
    if (!puedeInstalarseEnIOS()) return undefined
    // Al poco de entrar, no encima de la primera pantalla mientras carga
    const temporizador = instalarDescartado() ? null : setTimeout(() => setVisible(true), 2500)
    const abrir = () => setVisible(true)
    window.addEventListener(EVENTO_INSTALAR, abrir)
    return () => {
      clearTimeout(temporizador)
      window.removeEventListener(EVENTO_INSTALAR, abrir)
    }
  }, [])

  function cerrar() {
    descartarInstalar()
    setVisible(false)
  }

  if (!montado) return null
  return (
    <aside className={saliendo ? 'instalar instalar--saliendo' : 'instalar'} aria-labelledby="instalar-titulo">
      <img className="instalar__icono" src={`${import.meta.env.BASE_URL}iconos/apple-touch-icon.png`} alt="" />
      <div className="instalar__texto">
        <h2 id="instalar-titulo" className="instalar__titulo">{t('instalar.titulo')}</h2>
        <p className="instalar__frase">{t('instalar.frase')}</p>
        <ol className="instalar__pasos">
          <li>
            <span>{t('instalar.paso1')}</span>
            {/* El icono de Compartir de Safari: un cuadrado abierto con una flecha hacia arriba */}
            <svg className="instalar__compartir" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label={t('instalar.compartir')}>
              <path d="M12 3v12M8 7l4-4 4 4" />
              <path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" />
            </svg>
          </li>
          <li>
            <span>{t('instalar.paso2')}</span>
            {/* El icono de "Añadir a pantalla de inicio": un cuadrado con un + */}
            <svg className="instalar__compartir" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="3" />
              <path d="M12 8.5v7M8.5 12h7" />
            </svg>
          </li>
        </ol>
      </div>
      <button type="button" className="instalar__cerrar" aria-label={t('comun.cerrar')} onClick={cerrar}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </aside>
  )
}

export default InstalarIOS
