import { useState } from 'react'
import ImagenSuave from './ImagenSuave'
import { useIdioma } from './IdiomaContext'
import { tiempoRelativo } from './tiempo'
import { claveMotivo } from './logicaNoticias'
import { logoPortal } from './logosPortales'

// Los iconos de cada motivo de "Para ti"
const ICONOS_MOTIVO = {
  juego: <path d="M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-3.9 3.1l-1 4.6a3 3 0 0 0 5.2 2.6L8.8 13h6.4l1.8 2.3a3 3 0 0 0 5.2-2.6l-1-4.6A4 4 0 0 0 17.3 5Z" />,
  amigos: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0M16 4.6a3 3 0 0 1 0 5.8M18 14.2a5.5 5.5 0 0 1 3 4.8" /></>,
  similar: <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5Z" />,
  portal: <><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1.4" /></>,
  descubrir: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>,
  reciente: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
}

// Por qué sale una noticia en "Para ti": un icono pequeño y el texto ("Porque tienes Elden Ring"),
// en una línea discreta al pie
export function MotivoNoticia({ motivo }) {
  const { t } = useIdioma()
  if (!motivo) return null
  const juego = motivo.game?.name
  return (
    <span className={`noticia__motivo noticia__motivo--${motivo.kind}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONOS_MOTIVO[motivo.kind] ?? ICONOS_MOTIVO.reciente}
      </svg>
      <span>{t(claveMotivo(motivo), { juego })}</span>
    </span>
  )
}

// Una noticia: imagen (o, si el portal no la da, su logo o su nombre sobre un fondo de su color), el
// portal, cuánto hace, el titular y por qué te la recomendamos. El extracto solo sale en la destacada:
// en las demás, con el titular basta. Toda la tarjeta es un enlace al
// artículo en el portal (se abre en el navegador: GameHub no copia el artículo). "No me interesa"
// va aparte, fuera del enlace.
//  - noticia: la de la API ({ id, url, title, excerpt, image, published_at, source, reason? })
//  - destacada: la primera de la portada, en grande
//  - orden: para que entren una tras otra (--orden)
//  - refObservar: el `ref` que registra que ha estado a la vista (ver useEventosNoticias)
//  - onAbrir(): al pulsarla; onOcultar(): "No me interesa"
//  - saliendo: se está yendo (tras "No me interesa"); onSalida(): terminó su animación de salida
function TarjetaNoticia({ noticia, destacada = false, orden = 0, refObservar, onAbrir, onOcultar, saliendo = false, onSalida }) {
  const { t, locale } = useIdioma()
  const { source } = noticia
  // Si la imagen del portal no carga (borrada, bloqueada...), la portada con su color
  const [imagenRota, setImagenRota] = useState(false)
  const conImagen = Boolean(noticia.image) && !imagenRota
  // Sin imagen, el logo del portal (si lo tenemos); sin ninguno de los dos, su nombre
  const logo = conImagen ? null : logoPortal(source.slug)
  return (
    <article
      ref={refObservar}
      className={['noticia', destacada && 'noticia--destacada', !conImagen && !logo && 'noticia--sin-imagen', saliendo && 'noticia--saliendo'].filter(Boolean).join(' ')}
      style={{ '--tono': source.tono, '--orden': Math.min(orden, 12) }}
      // La salida termina con su animación, no con un temporizador (solo la suya, no la de dentro)
      onAnimationEnd={(e) => { if (saliendo && e.target === e.currentTarget) onSalida?.() }}
    >
      <a className="noticia__enlace" href={noticia.url} target="_blank" rel="noopener noreferrer" onClick={onAbrir}>
        <span className="noticia__imagen">
          {conImagen ? (
            // Sin "referrer": algunos portales no sirven sus imágenes a otras webs si saben de dónde viene la petición
            <ImagenSuave
              src={noticia.image}
              alt=""
              loading={destacada ? 'eager' : 'lazy'}
              referrerPolicy="no-referrer"
              onError={() => setImagenRota(true)}
            />
          ) : (
            <span className="noticia__sin-imagen" aria-hidden="true">
              {logo ? <img className="noticia__logo" src={logo} alt="" /> : <span>{source.name}</span>}
            </span>
          )}
        </span>
        <span className="noticia__cuerpo">
          <span className="noticia__meta">
            <span className="noticia__portal">{source.name}</span>
            <time dateTime={noticia.published_at} title={new Date(noticia.published_at).toLocaleString(locale)}>
              {tiempoRelativo(noticia.published_at, locale)}
            </time>
          </span>
          <span className="noticia__titulo">{noticia.title}</span>
          {destacada && noticia.excerpt && <span className="noticia__extracto">{noticia.excerpt}</span>}
          {noticia.reason && <MotivoNoticia motivo={noticia.reason} />}
        </span>
        <span className="sr-only">{t('noticias.abreEnPortal', { portal: source.name })}</span>
      </a>
      {onOcultar && (
        <button type="button" className="noticia__ocultar" aria-label={t('noticias.noMeInteresa')} title={t('noticias.noMeInteresa')} disabled={saliendo} onClick={onOcultar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </article>
  )
}

export default TarjetaNoticia
