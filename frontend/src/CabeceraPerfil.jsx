import Avatar from './Avatar'
import { useIdioma } from './IdiomaContext'
import { nombrePais } from './paises'
import { estiloTono } from './tono'

// Banner del perfil: foto, nombre, bio y tres cifras de la biblioteca.
// El fondo es siempre el mismo (una aurora con los colores de la marca, solo CSS):
// no depende del usuario ni de sus juegos. Es decorativo.
//  - perfil: { username, avatar, bio, created_at, first_name, last_name, age, gender, location, country }
//  - stats: lo que calcula GET /profile/stats, o null mientras carga. `undefined` = no hay
//    cifras que enseñar (el perfil de otra persona que no comparte su biblioteca)
//  - onEditar(): salta a la pestaña de edición (solo en el mío)
//  - propio: false en el perfil de otra persona (no hay "Aún no has escrito nada sobre ti")
//  - acciones: botones de la amistad, en el sitio donde en el mío va "Editar perfil"
//  - conTono: el banner se tiñe con el color de esa persona (ver tono.js) en lugar del
//    de la marca; es lo que distingue el perfil de cada amigo
function CabeceraPerfil({ perfil, stats, onEditar, propio = true, acciones, conTono = false }) {
  const { t, locale, idioma } = useIdioma()

  // Un usuario bloqueado llega sin fecha de alta
  const miembroDesde = perfil.created_at
    ? new Date(perfil.created_at).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    : ""


  // Datos personales: solo los que haya, separados por puntos medios. Si no hay
  // ninguno no se pinta la línea.
  const datosPersonales = [
    [perfil.first_name, perfil.last_name].filter(Boolean).join(" "),
    perfil.age != null ? t('perfil.edad', { n: perfil.age }) : "",
    perfil.gender ? t(`sexo.${perfil.gender}`) : "",
    // "Sevilla, España": la localización y el país van juntos. El teléfono no se enseña
    // aquí a propósito: es un dato de contacto que no debe acabar a la vista de otros.
    [perfil.location, perfil.country ? nombrePais(perfil.country, idioma) : ""].filter(Boolean).join(", "),
  ].filter(Boolean)

  // Mientras no llegan las estadísticas enseño rayas, no ceros que luego cambian
  const cargando = stats === null
  const sinCifras = stats === undefined
  const porcentajeCompletado = stats && stats.total > 0 ? Math.round((stats.completado / stats.total) * 100) : 0

  const cifras = sinCifras ? [] : [
    { etiqueta: t('stats.juegos'), valor: cargando ? "–" : stats.total },
    { etiqueta: t('stats.notaMedia'), valor: cargando ? "–" : (stats.nota_media ?? "—") },
    { etiqueta: t('stats.completados'), valor: cargando ? "–" : `${porcentajeCompletado}%` },
  ]

  return (
    <header
      className={conTono ? "banner-perfil banner-perfil--tono" : "banner-perfil"}
      style={conTono ? estiloTono(perfil.username) : undefined}
    >
      <div className="banner-perfil__fondo" aria-hidden="true" />

      {onEditar && (
        <button type="button" className="banner-perfil__editar" onClick={onEditar}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          {t('perfil.editarBoton')}
        </button>
      )}
      {acciones && <div className="banner-perfil__acciones">{acciones}</div>}

      <div className="banner-perfil__contenido">
        <div className="banner-perfil__identidad">
          <Avatar usuario={perfil} tamano="enorme" />
          <div className="banner-perfil__datos">
            <h1 className="titulo-pagina">{perfil.username}</h1>
            {datosPersonales.length > 0 && (
              <p className="banner-perfil__meta">{datosPersonales.join(" · ")}</p>
            )}
            {perfil.created_at && (
              <p className="banner-perfil__meta">{t('perfil.miembroDesde', { fecha: miembroDesde })}</p>
            )}
            {perfil.bio
              ? <p className="banner-perfil__bio">{perfil.bio}</p>
              : propio && <p className="banner-perfil__bio banner-perfil__bio--vacia">{t('perfil.sinBio')}</p>}
          </div>
        </div>

        {/* En el HTML va primero la etiqueta (<dt>) y luego el valor (<dd>), que es lo
            correcto para un lector de pantalla; el CSS pinta el número encima. */}
        {cifras.length > 0 && (
          <dl className="banner-perfil__cifras">
            {cifras.map(({ etiqueta, valor }, i) => (
              <div key={etiqueta} className="cifra" style={{ '--orden': i }}>
                <dt className="cifra__etiqueta">{etiqueta}</dt>
                <dd className="cifra__valor">{valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  )
}

export default CabeceraPerfil
