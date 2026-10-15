import AvatarTono from './AvatarTono'
import { useIdioma } from './IdiomaContext'

// La banda de debajo del perfil de otra persona: lo que tenéis en común de un vistazo
// (portadas de los juegos y fotos de los amigos), y pulsarla lleva a la pestaña "En común".
//  - comun: GET /users/:u/common ({ games: [...] | null, friends: [...] }) o null si aún no ha
//    llegado
//  - onVer(): salta a la pestaña
function BandaEnComun({ comun, onVer }) {
  const { t } = useIdioma()

  if (!comun) return null

  const juegos = comun.games ?? []
  const amigos = comun.friends
  const nada = juegos.length === 0 && amigos.length === 0

  return (
    <button type="button" className={nada ? "banda-comun banda-comun--vacia" : "banda-comun"} onClick={onVer}>
      <span className="estadisticas__subtitulo banda-comun__titulo">{t('comun.banda')}</span>

      {nada ? (
        <span className="banda-comun__nada">
          {comun.games === null ? t('comun.bandaNadaPrivado') : t('comun.bandaNada')}
        </span>
      ) : (
        <>
          {juegos.length > 0 && (
            <span className="banda-comun__bloque">
              <span className="portadas-apiladas" aria-hidden="true">
                {juegos.slice(0, 4).map((j) => (
                  <span key={j.igdb_id} className="portadas-apiladas__portada">
                    {j.cover_url && <img src={j.cover_url} alt="" loading="lazy" />}
                  </span>
                ))}
              </span>
              <span>
                <strong>{juegos.length}</strong>{' '}
                {juegos.length === 1 ? t('comun.juegoUno') : t('comun.juegos')}
              </span>
            </span>
          )}

          {amigos.length > 0 && (
            <span className="banda-comun__bloque">
              <span className="avatares-apilados" aria-hidden="true">
                {amigos.slice(0, 4).map((a) => <AvatarTono key={a.username} usuario={a} tamano="pequeno" />)}
              </span>
              <span>
                <strong>{amigos.length}</strong>{' '}
                {amigos.length === 1 ? t('comun.amigoUno') : t('comun.amigos')}
              </span>
            </span>
          )}
        </>
      )}

      <svg className="banda-comun__flecha" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  )
}

export default BandaEnComun
