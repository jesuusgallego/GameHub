import AvatarTono from './AvatarTono'
import { useIdioma } from './IdiomaContext'
import { estiloTono } from './tono'
import { compararBibliotecas } from './comparar'

// "Cara a cara": mi biblioteca frente a la de esa persona, en tres filas (juegos,
// completados y nota media) con dos barras que crecen desde el centro. Gana el lado mayor.
//  - yo: { username, avatar }; otro: { username, has_avatar }
//  - misStats / susStats: el `stats` de /profile/stats y de su perfil
function CaraACara({ yo, otro, misStats, susStats }) {
  const { t, locale } = useIdioma()
  const filas = compararBibliotecas(misStats, susStats)

  if (!filas || (misStats.total === 0 && susStats.total === 0)) return null

  const formato = (id, v) => (
    v == null ? "—" : id === 'nota' ? v.toLocaleString(locale, { minimumFractionDigits: 1 }) : String(v)
  )

  return (
    <section className="cara" style={estiloTono(otro.username)} aria-labelledby="cara-titulo">
      <h3 id="cara-titulo" className="sala-titulo">{t('cara.titulo')}</h3>

      <div className="cara__nombres">
        <span className="cara__jugador cara__jugador--yo">
          <AvatarTono usuario={yo} tamano="normal" />
          <strong>{t('cara.tu')}</strong>
        </span>
        <span className="cara__vs" aria-hidden="true">VS</span>
        <span className="cara__jugador cara__jugador--otro">
          <strong>{otro.username}</strong>
          <AvatarTono usuario={otro} tamano="normal" />
        </span>
      </div>

      <ul className="cara__filas">
        {filas.map((f, i) => (
          <li key={f.id} className="cara__fila" style={{ '--orden': i }}>
            <span className={f.gana === 'mio' ? "cara__valor cara__valor--gana" : "cara__valor"}>{formato(f.id, f.mio)}</span>
            <div className="cara__barras" role="img"
              aria-label={`${t(`cara.${f.id}`)}: ${formato(f.id, f.mio)} / ${formato(f.id, f.suyo)}`}>
              <span className="cara__barra cara__barra--yo">
                <span
                  className={f.gana === 'mio' ? "cara__relleno cara__relleno--gana" : "cara__relleno"}
                  style={{ '--p': (f.mio ?? 0) / f.maximo }}
                />
              </span>
              <span className="cara__etiqueta">{t(`cara.${f.id}`)}</span>
              <span className="cara__barra cara__barra--otro">
                <span
                  className={f.gana === 'suyo' ? "cara__relleno cara__relleno--gana" : "cara__relleno"}
                  style={{ '--p': (f.suyo ?? 0) / f.maximo }}
                />
              </span>
            </div>
            <span className={f.gana === 'suyo' ? "cara__valor cara__valor--gana" : "cara__valor"}>{formato(f.id, f.suyo)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default CaraACara
