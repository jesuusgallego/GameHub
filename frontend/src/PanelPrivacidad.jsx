import { useState } from 'react'
import { apiFetch } from './api'
import Desplegable from './Desplegable'
import Interruptor from './Interruptor'
import Mensaje from './Mensaje'
import { useIdioma } from './IdiomaContext'
import { VISIBILIDADES } from './validacion'
import {
  puedeVer, GRUPOS_PRIVACIDAD, PRIVACIDAD_POR_DEFECTO, POLITICAS_SOLICITUD,
} from './privacidad'

// Quién ve cada cosa de tu perfil y quién puede contactarte. Es una sección aparte del
// perfil (pestaña "Privacidad").
//  - Arriba, una tabla que enseña, con lo que tienes elegido AHORA, qué ve cada tipo de
//    persona (tú, tus amigos, cualquiera). Se actualiza al momento al cambiar un ajuste.
//  - Debajo, los ajustes en tarjetas. No hay botón Guardar: cada cambio se guarda solo
//    (son ajustes independientes y se ve en la tabla qué ha pasado). Si falla, vuelve al
//    valor anterior y avisa.
//  - perfil: los datos guardados ahora mismo
//  - onGuardado(usuario): el padre actualiza el perfil compartido
//  - cerrarSesion(): para cuando el backend dice 401
function PanelPrivacidad({ perfil, onGuardado, cerrarSesion }) {
  const { t } = useIdioma()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const [guardado, setGuardado] = useState(false)

  // El valor de cada ajuste sale del perfil. Un perfil antiguo (sin el dato) usa el valor
  // por defecto: es lo que el servidor aplica.
  const valor = (campo) => perfil[campo] ?? PRIVACIDAD_POR_DEFECTO[campo]
  const politica = perfil.request_policy ?? 'todos'
  const buscable = perfil.searchable ?? true
  const personalizar = perfil.news_personalization ?? true

  // Guarda un ajuste. `optimista`: el perfil se actualiza ya, antes de que el servidor
  // conteste, para que la tabla y el selector respondan sin esperar; si el servidor
  // rechaza el cambio, se vuelve al valor que había.
  async function cambiar(campo, nuevo) {
    const anterior = perfil
    setError("")
    setGuardado(false)
    setOcupado(true)
    onGuardado({ ...perfil, [campo]: nuevo })

    try {
      const data = await apiFetch('/profile', { method: 'PATCH', body: { [campo]: nuevo } })
      onGuardado(data.user)
      setGuardado(true)
    } catch (err) {
      onGuardado(anterior)
      if (err.status === 401) return cerrarSesion()
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const opcionesNivel = VISIBILIDADES.map((v) => ({ valor: v, etiqueta: t(`privacidad.${v}`) }))
  const opcionesPolitica = POLITICAS_SOLICITUD.map((v) => ({ valor: v, etiqueta: t(`privacidad.politica.${v}`) }))

  // Las tres columnas de la tabla: quién mira
  const miradas = [
    { id: 'self', etiqueta: t('privacidad.quien.self') },
    { id: 'amigos', etiqueta: t('privacidad.quien.amigos') },
    { id: 'otros', etiqueta: t('privacidad.quien.otros') },
  ]

  return (
    <div className="privacidad">
      <section className="privacidad__matriz" aria-labelledby="matriz-titulo">
        <h3 id="matriz-titulo" className="estadisticas__subtitulo">{t('privacidad.matriz.titulo')}</h3>
        <p className="privacidad__ayuda">{t('privacidad.matriz.ayuda')}</p>

        <div className="matriz-scroll">
          <table className="matriz">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">{t('privacidad.matriz.dato')}</span></th>
                {miradas.map((m) => <th key={m.id} scope="col">{m.etiqueta}</th>)}
              </tr>
            </thead>
            <tbody>
              <FilaMatriz etiqueta={t('privacidad.fijo.publico')} visible={{ self: true, amigos: true, otros: true }} t={t} />
              {GRUPOS_PRIVACIDAD.flatMap((g) => g.campos).map((campo) => (
                <FilaMatriz
                  key={campo}
                  etiqueta={t(`privacidad.campo.${campo}`)}
                  visible={{
                    self: true,
                    amigos: puedeVer(valor(campo), 'amigos'),
                    otros: puedeVer(valor(campo), 'otros'),
                  }}
                  t={t}
                />
              ))}
              <FilaMatriz etiqueta={t('privacidad.fijo.privado')} visible={{ self: true, amigos: false, otros: false }} t={t} />
            </tbody>
          </table>
        </div>
      </section>

      <Mensaje texto={error} />
      <Mensaje tipo="ok" texto={guardado && !error ? t('privacidad.guardado') : ""} />

      {GRUPOS_PRIVACIDAD.map((grupo) => (
        <section key={grupo.id} className="ajuste">
          <header className="ajuste__cabecera">
            <span className="ajuste__icono" aria-hidden="true">
              <IconoGrupo id={grupo.id} />
            </span>
            <div>
              <h3 className="ajuste__titulo">{t(`privacidad.grupo.${grupo.id}`)}</h3>
              <p className="ajuste__ayuda">{t(`privacidad.grupo.${grupo.id}.ayuda`)}</p>
            </div>
          </header>

          <div className="privacidad__filas">
            {grupo.campos.map((campo) => (
              <label key={campo} className="privacidad__fila">
                <span className="privacidad__texto">
                  <strong>{t(`privacidad.campo.${campo}`)}</strong>
                  <small>{t(`privacidad.campo.${campo}.ayuda`)}</small>
                </span>
                <Desplegable
                  opciones={opcionesNivel}
                  valor={valor(campo)}
                  onChange={(nuevo) => cambiar(campo, nuevo)}
                  disabled={ocupado}
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="ajuste">
        <header className="ajuste__cabecera">
          <span className="ajuste__icono" aria-hidden="true">
            <IconoGrupo id="contacto" />
          </span>
          <div>
            <h3 className="ajuste__titulo">{t('privacidad.grupo.contacto')}</h3>
            <p className="ajuste__ayuda">{t('privacidad.grupo.contacto.ayuda')}</p>
          </div>
        </header>

        <div className="privacidad__filas">
          <label className="privacidad__fila">
            <span className="privacidad__texto">
              <strong>{t('privacidad.politica.titulo')}</strong>
              <small>{t('privacidad.politica.ayuda')}</small>
            </span>
            <Desplegable
              opciones={opcionesPolitica}
              valor={politica}
              onChange={(nuevo) => cambiar('request_policy', nuevo)}
              disabled={ocupado}
            />
          </label>

          <div className="privacidad__fila">
            <span className="privacidad__texto">
              <strong id="etiqueta-buscable">{t('privacidad.buscable')}</strong>
              <small>{t('privacidad.buscable.ayuda')}</small>
            </span>
            <Interruptor
              activado={buscable}
              onChange={(nuevo) => cambiar('searchable', nuevo)}
              etiqueta={t('privacidad.buscable')}
              disabled={ocupado}
            />
          </div>
        </div>
      </section>

      <section className="ajuste">
        <header className="ajuste__cabecera">
          <span className="ajuste__icono" aria-hidden="true">
            <IconoGrupo id="noticias" />
          </span>
          <div>
            <h3 className="ajuste__titulo">{t('privacidad.grupo.noticias')}</h3>
            <p className="ajuste__ayuda">{t('privacidad.grupo.noticias.ayuda')}</p>
          </div>
        </header>

        <div className="privacidad__filas">
          <div className="privacidad__fila">
            <span className="privacidad__texto">
              <strong>{t('privacidad.personalizar')}</strong>
              <small>{t('privacidad.personalizar.ayuda')}</small>
            </span>
            <Interruptor
              activado={personalizar}
              onChange={(nuevo) => cambiar('news_personalization', nuevo)}
              etiqueta={t('privacidad.personalizar')}
              disabled={ocupado}
            />
          </div>
        </div>
      </section>

      <p className="privacidad__ayuda">{t('privacidad.autoguardado')}</p>
    </div>
  )
}

// Una fila de la tabla: un dato y, por cada tipo de persona, si lo ve o no
function FilaMatriz({ etiqueta, visible, t }) {
  return (
    <tr>
      <th scope="row">{etiqueta}</th>
      {['self', 'amigos', 'otros'].map((quien) => (
        <td key={quien} className={visible[quien] ? "matriz__si" : "matriz__no"}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {visible[quien] ? <path d="m5 12.5 4.5 4.5L19 7" /> : <path d="M6 12h12" />}
          </svg>
          <span className="sr-only">{visible[quien] ? t('privacidad.matriz.si') : t('privacidad.matriz.no')}</span>
        </td>
      ))}
    </tr>
  )
}

// Dibujos de las tarjetas (trazos en un viewBox de 24x24)
function IconoGrupo({ id }) {
  const dibujos = {
    personales: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1.5A5.5 5.5 0 0 1 9.5 14h5a5.5 5.5 0 0 1 5.5 5.5V21" /></>,
    biblioteca: <><path d="M4 5h4v14H4zM10 5h4v14h-4z" /><path d="m16 6 4 1-3 12-4-1" /></>,
    contacto: <><path d="M4 5h16v11H8l-4 4z" /></>,
    noticias: <><path d="M5 4h11v16H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Z" /><path d="M16 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-4 0M8 8h5M8 12h5M8 16h3" /></>,
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {dibujos[id]}
    </svg>
  )
}

export default PanelPrivacidad
