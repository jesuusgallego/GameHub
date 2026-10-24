import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from './api'
import AvatarGrupo from './AvatarGrupo'
import AvatarTono from './AvatarTono'
import Cargando from './Cargando'
import DialogoConfirmar from './DialogoConfirmar'
import Mensaje from './Mensaje'
import SelectorAmigos from './SelectorAmigos'
import { estiloTono } from './tono'
import { useIdioma } from './IdiomaContext'
import { GRUPO_MAX_MIEMBROS, GRUPO_NOMBRE_MAX } from './validacion'

// El panel con la información de un grupo, que entra desde la derecha sobre la conversación:
// su nombre, quién está y lo que puedes hacer. Quien lo administra cambia el nombre, añade a
// amigos suyos y saca a quien quiera; cualquiera puede vaciar el chat (solo para sí) o salir.
//  - grupo: { name, members: [{ username, has_avatar, is_owner }], is_owner } del servidor
//  - ruta: /chat/g/<id>
//  - yo: mi nombre de usuario
//  - amigos: mis amigos (para "Añadir personas")
//  - saliendo: se está cerrando (animación de salida)
//  - onCambio(): algo cambió en el grupo; la conversación se pone al día (y salen los avisos)
//  - onVaciar() / onSalir(): piden la confirmación a la conversación
//  - onCerrar()
function InfoGrupo({ grupo, ruta, yo, amigos, saliendo, onCambio, onVaciar, onSalir, onCerrar, cerrarSesion }) {
  const { t } = useIdioma()
  const [vista, setVista] = useState('info') // 'info' | 'anadir'
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(grupo.name)
  const [elegidos, setElegidos] = useState([])
  const [porSacar, setPorSacar] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const panelRef = useRef(null)
  const campoRef = useRef(null)

  const admin = grupo.is_owner
  const caben = GRUPO_MAX_MIEMBROS - grupo.members.length
  const dentro = new Set(grupo.members.map((m) => m.username))
  const otros = grupo.members.filter((m) => m.username !== yo)

  // Al abrir, el foco entra en el panel: así Esc lo cierra y el teclado sigue por dentro
  useEffect(() => { panelRef.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => { if (editando) campoRef.current?.select() }, [editando])

  // Esc cierra solo este panel (no el chat entero); desde "Añadir", vuelve a la información
  function alTeclear(e) {
    if (e.key !== 'Escape' || porSacar) return
    e.stopPropagation()
    if (vista === 'anadir') setVista('info')
    else if (editando) setEditando(false)
    else onCerrar()
  }

  // Lanza un cambio en el servidor y, si sale bien, avisa a la conversación
  async function cambiar(peticion, despues) {
    setOcupado(true)
    setError('')
    try {
      await peticion()
      onCambio()
      despues?.()
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  function guardarNombre(e) {
    e.preventDefault()
    const limpio = nombre.replace(/\s+/g, ' ').trim()
    if (!limpio || limpio === grupo.name) {
      setNombre(grupo.name)
      setEditando(false)
      return
    }
    cambiar(() => apiFetch(ruta, { method: 'PATCH', body: { name: limpio } }), () => setEditando(false))
  }

  function anadir() {
    cambiar(
      () => apiFetch(`${ruta}/members`, { method: 'POST', body: { members: elegidos } }),
      () => { setElegidos([]); setVista('info') }
    )
  }

  function sacar(persona) {
    setPorSacar(null)
    cambiar(() => apiFetch(`${ruta}/members/${encodeURIComponent(persona)}`, { method: 'DELETE' }))
  }

  function alternar(usuario) {
    setElegidos((previos) => (previos.includes(usuario)
      ? previos.filter((u) => u !== usuario)
      : previos.length < caben ? [...previos, usuario] : previos))
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className={saliendo ? 'chat-info chat-info--saliendo' : 'chat-info'}
      role="dialog"
      aria-label={t('chat.grupo.info')}
      onKeyDown={alTeclear}
    >
      <header className="chat-info__barra">
        <button
          type="button"
          className="chat-info__cerrar"
          aria-label={vista === 'anadir' ? t('chat.grupo.volverInfo') : t('chat.grupo.cerrarInfo')}
          onClick={() => (vista === 'anadir' ? setVista('info') : onCerrar())}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {vista === 'anadir' ? <path d="m15 18-6-6 6-6" /> : <path d="M6 6l12 12M18 6 6 18" />}
          </svg>
        </button>
        <h2>{vista === 'anadir' ? t('chat.grupo.anadir') : t('chat.grupo.info')}</h2>
      </header>

      <Mensaje texto={error} />

      {vista === 'anadir' ? (
        <div className="chat-info__anadir">
          <p className="chat-nuevo__ayuda">{t('chat.grupo.caben', { n: caben })}</p>
          <div className="chat-info__selector">
            <SelectorAmigos
              amigos={amigos}
              seleccion={elegidos}
              excluir={dentro}
              lleno={elegidos.length >= caben}
              onAlternar={alternar}
              onIrDescubrir={onCerrar}
            />
          </div>
          <button type="button" className="btn btn--primario btn--block" disabled={elegidos.length === 0 || ocupado} onClick={anadir}>
            {ocupado ? <><Cargando tamano="pequeno" /> {t('chat.grupo.anadiendo')}</> : t('chat.grupo.anadirBoton', { n: elegidos.length })}
          </button>
        </div>
      ) : (
        <div className="chat-info__cuerpo">
          <div className="chat-info__portada" style={estiloTono(grupo.name)}>
            <AvatarGrupo nombre={grupo.name} miembros={otros} tamano="grande" />
            {editando ? (
              <form className="chat-info__renombrar" onSubmit={guardarNombre}>
                <input
                  ref={campoRef}
                  type="text"
                  value={nombre}
                  maxLength={GRUPO_NOMBRE_MAX}
                  aria-label={t('chat.grupo.nombre')}
                  onChange={(e) => setNombre(e.target.value)}
                />
                <button type="submit" className="btn btn--primario" disabled={ocupado || !nombre.trim()}>{t('comun.guardar')}</button>
                <button type="button" className="btn btn--secundario" onClick={() => { setNombre(grupo.name); setEditando(false) }}>{t('comun.cancelar')}</button>
              </form>
            ) : (
              <h3 className="chat-info__nombre">
                {grupo.name}
                {admin && (
                  <button type="button" className="chat-info__lapiz" aria-label={t('chat.grupo.renombrar')} title={t('chat.grupo.renombrar')} onClick={() => setEditando(true)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
                    </svg>
                  </button>
                )}
              </h3>
            )}
            <p className="chat-info__cuantos">{t('chat.grupo.personas', { n: grupo.members.length })}</p>
          </div>

          <div className="chat-info__seccion">
            <div className="chat-info__titulo">
              <h4>{t('chat.grupo.miembros')}</h4>
              {admin && caben > 0 && (
                <button type="button" className="chat-info__anadir-boton" onClick={() => setVista('anadir')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {t('chat.grupo.anadir')}
                </button>
              )}
            </div>
            <ul className="chat-info__lista">
              {grupo.members.map((m, i) => {
                const soyYo = m.username === yo
                return (
                  <li key={m.username} style={{ ...estiloTono(m.username), '--orden': Math.min(i, 10) }}>
                    {soyYo ? (
                      <span className="chat-info__persona">
                        <AvatarTono usuario={m} tamano="pequeno" />
                        <span>{m.username} <em>{t('chat.grupo.tuEtiqueta')}</em></span>
                      </span>
                    ) : (
                      <Link to={`/usuarios/${m.username}`} className="chat-info__persona">
                        <AvatarTono usuario={m} tamano="pequeno" />
                        <span>{m.username}</span>
                      </Link>
                    )}
                    {m.is_owner && <span className="chat-info__admin">{t('chat.grupo.admin')}</span>}
                    {admin && !soyYo && (
                      <button
                        type="button"
                        className="chat-info__sacar"
                        disabled={ocupado}
                        aria-label={t('chat.grupo.sacarA', { usuario: m.username })}
                        title={t('chat.grupo.sacarA', { usuario: m.username })}
                        onClick={() => setPorSacar(m.username)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M15 19a6 6 0 0 0-12 0M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 11h6" />
                        </svg>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="chat-info__acciones">
            <button type="button" className="chat-info__accion" onClick={onVaciar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
              </svg>
              {t('chat.vaciar')}
            </button>
            <button type="button" className="chat-info__accion chat-info__accion--peligro" onClick={onSalir}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
              </svg>
              {t('chat.grupo.salir')}
            </button>
          </div>
        </div>
      )}

      {porSacar && (
        <DialogoConfirmar
          titulo={t('chat.grupo.sacarTitulo', { usuario: porSacar })}
          mensaje={t('chat.grupo.sacarTexto')}
          textoConfirmar={t('chat.grupo.sacarBoton')}
          onConfirmar={() => sacar(porSacar)}
          onCancelar={() => setPorSacar(null)}
        />
      )}
    </div>
  )
}

export default InfoGrupo
