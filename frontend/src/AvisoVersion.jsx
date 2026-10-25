import { useState, useEffect } from 'react'
import { usePresencia } from './usePresencia'
import { useIdioma } from './IdiomaContext'
import { scriptPrincipal, hayVersionNueva } from './pwa'

// Cada cuánto se mira, como mucho, si hay una versión nueva (al volver a la app)
const CADA_MS = 10 * 60 * 1000

// "Hay una versión nueva de GameHub · Actualizar". En el iPhone, la app instalada se queda abierta
// en segundo plano días enteros: al volver a ella seguiría con la versión de entonces. Cada vez que
// vuelves (y como mucho cada 10 minutos) se pide el index.html publicado y se compara su script
// principal con el de la página abierta (ver pwa.js); si cambió, sale este aviso. Solo en la web
// publicada: en desarrollo no hay huellas y el escritorio se actualiza por su cuenta.
function AvisoVersion() {
  const { t } = useIdioma()
  const [nueva, setNueva] = useState(false)
  const { montado, saliendo } = usePresencia(nueva, 250)

  useEffect(() => {
    if (!import.meta.env.PROD || import.meta.env.VITE_DESKTOP) return undefined
    const actual = document.querySelector('script[type="module"][src]')?.getAttribute('src')
    let ultima = Date.now()

    async function mirar() {
      if (document.visibilityState !== 'visible' || Date.now() - ultima < CADA_MS) return
      ultima = Date.now()
      try {
        const respuesta = await fetch(`${import.meta.env.BASE_URL}index.html`, { cache: 'no-store' })
        if (respuesta.ok && hayVersionNueva(actual, scriptPrincipal(await respuesta.text()))) setNueva(true)
      } catch {
        // Sin conexión: ya se mirará la próxima vez
      }
    }

    document.addEventListener('visibilitychange', mirar)
    return () => document.removeEventListener('visibilitychange', mirar)
  }, [])

  if (!montado) return null
  return (
    <div className={saliendo ? 'aviso-version aviso-version--saliendo' : 'aviso-version'} role="status">
      <span>{t('version.nueva')}</span>
      <button type="button" className="btn btn--primario" onClick={() => window.location.reload()}>{t('version.actualizar')}</button>
      <button type="button" className="aviso-version__cerrar" aria-label={t('version.luego')} onClick={() => setNueva(false)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  )
}

export default AvisoVersion
