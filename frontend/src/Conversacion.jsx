import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from './api'
import AvatarTono from './AvatarTono'
import Burbuja from './Burbuja'
import Cargando from './Cargando'
import DialogoConfirmar from './DialogoConfirmar'
import Mensaje from './Mensaje'
import { estiloTono } from './tono'
import { iniciarSondeo } from './sondeo'
import { usePresencia } from './usePresencia'
import { useIdioma } from './IdiomaContext'
import { MENSAJE_MAX } from './validacion'
import {
  fusionar, marcarBorrados, ultimoId, hayPorLeer, mensajeVisto, agrupar, rotuloDia, sugerenciasInicio,
} from './logicaChat'

// Cada cuánto se pregunta por mensajes nuevos mientras la conversación está abierta. Es más
// seguido que el resto de la app porque aquí la gente espera una respuesta; el sondeo se
// pausa solo si la pestaña se oculta o pasan cinco minutos sin tocar nada (ver sondeo.js).
const CADA_MS = 4000
// A partir de cuántos caracteres se enseña el contador del mensaje
const AVISO_CONTADOR = Math.floor(MENSAJE_MAX * 0.8)
// Hasta dónde se estira el cuadro de texto (px) antes de pasar a tener su propia barra
const ALTO_MAX_CAJA = 160

// ¿Está el visor lo bastante abajo para considerar que estás leyendo lo último?
function estaAbajo(el) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

// Una conversación con una persona: su cabecera, los mensajes y el cuadro para escribir.
//  - username: con quién hablo
//  - amigo: lo que sé de esa persona por la lista de amigos ({ playing }), o undefined
//  - borradores: { current: Map } con lo que tenía a medio escribir en cada conversación
//  - onCambio(): avisa a la página de que hay algo nuevo (mensaje enviado, leído...) para que
//    ponga al día la lista de conversaciones
//  - cerrarSesion(): para un 401
//  - onVolver(): vuelve a la lista de conversaciones (en un panel estrecho; en uno ancho la lista
//    ya está al lado)
function Conversacion({ username, amigo, borradores, onCambio, onVolver, cerrarSesion }) {
  const { t, locale } = useIdioma()
  const ruta = `/chat/${encodeURIComponent(username)}`

  const [estado, setEstado] = useState('cargando') // 'cargando' | 'listo' | 'error'
  const [errorCarga, setErrorCarga] = useState('')
  const [usuario, setUsuario] = useState(null)
  const [esAmigo, setEsAmigo] = useState(true)
  const [mensajes, setMensajes] = useState([])
  const [hayMas, setHayMas] = useState(false)
  const [peerRead, setPeerRead] = useState(null)
  // Lo que acabo de escribir y aún no ha confirmado el servidor: [{ tmp, body, estado, created_at }]
  const [pendientes, setPendientes] = useState([])
  const [cargandoAntes, setCargandoAntes] = useState(false)
  const [aviso, setAviso] = useState('')
  const [texto, setTexto] = useState(() => borradores.current.get(username) ?? '')
  const [porEliminar, setPorEliminar] = useState(null)
  const [nuevosSinVer, setNuevosSinVer] = useState(0)
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')

  const visorRef = useRef(null)
  const cajaRef = useRef(null)
  // Para decidir si hay que bajar solo al llegar algo: ¿estaba leyendo lo último?
  const abajoRef = useRef(true)
  // El último mensaje que ya conté al decidir el scroll, y si es la primera vez
  const ultimoVistoRef = useRef(0)
  const primeraVezRef = useRef(true)
  // Posición del visor antes de cargar mensajes anteriores, para no saltar al añadirlos arriba
  const antesDeCargarRef = useRef(null)
  // Hasta qué mensaje de la otra persona ya avisé al servidor que lo vi
  const leidoHastaRef = useRef(0)
  // Cuántos envíos hay en vuelo; mientras, no meto mis mensajes que lleguen por el sondeo
  // (ya los traerá la respuesta del envío, y saldrían duplicados un momento)
  const enviandoRef = useRef(0)
  const mensajesRef = useRef(mensajes)
  const contadorTmpRef = useRef(0)

  useEffect(() => { mensajesRef.current = mensajes }, [mensajes])

  // ---- Carga inicial -----------------------------------------------------------------
  useEffect(() => {
    let cancelado = false

    apiFetch(ruta)
      .then((data) => {
        if (cancelado) return
        setUsuario(data.user)
        setEsAmigo(data.is_friend)
        setMensajes(data.messages)
        setHayMas(data.has_more)
        setPeerRead(data.peer_read)
        setEstado('listo')
      })
      .catch((err) => {
        if (cancelado) return
        if (err.status === 401) return cerrarSesion()
        setErrorCarga(err.message)
        setEstado('error')
      })

    return () => { cancelado = true }
  }, [ruta, cerrarSesion])

  // ---- Sondeo de lo nuevo ------------------------------------------------------------
  const traerNuevos = useCallback(() => {
    const despues = ultimoId(mensajesRef.current)
    return apiFetch(`${ruta}?after=${despues}`, { avisoLento: false })
      .then((data) => {
        // Mis propios mensajes los trae la respuesta del envío
        const nuevos = (enviandoRef.current > 0 ? data.messages.filter((m) => !m.mine) : data.messages)
          .map((m) => ({ ...m, nuevo: true }))
        setMensajes((prev) => marcarBorrados(fusionar(prev, nuevos), data.deleted))
        setPeerRead((prev) => (
          prev?.id === data.peer_read?.id && prev?.at === data.peer_read?.at ? prev : data.peer_read
        ))
        setEsAmigo(data.is_friend)
        if (nuevos.length > 0) onCambio()
      })
      .catch((err) => {
        if (err.status === 401) cerrarSesion()
        // Cualquier otro fallo: ya se reintenta en el siguiente turno
      })
  }, [ruta, onCambio, cerrarSesion])

  useEffect(() => {
    if (estado !== 'listo') return undefined
    return iniciarSondeo(traerNuevos, { cada: CADA_MS })
  }, [estado, traerNuevos])

  // ¿La pestaña se ve? Solo entonces cuenta como leído
  useEffect(() => {
    const alCambiar = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', alCambiar)
    return () => document.removeEventListener('visibilitychange', alCambiar)
  }, [])

  // ---- Marcar como leído -------------------------------------------------------------
  // "Visto" tiene que significar visto: solo cuando la conversación está abierta y la pestaña
  // se ve. Si falla se vuelve a intentar con el siguiente mensaje o al volver a la pestaña.
  useEffect(() => {
    if (estado !== 'listo' || !visible || !hayPorLeer(mensajes, leidoHastaRef.current)) return

    const anterior = leidoHastaRef.current
    leidoHastaRef.current = ultimoId(mensajes.filter((m) => !m.mine))
    apiFetch(`${ruta}/read`, { method: 'POST', avisoLento: false })
      .then(onCambio)
      .catch(() => { leidoHastaRef.current = anterior })
  }, [estado, visible, mensajes, ruta, onCambio])

  // ---- Desplazamiento ----------------------------------------------------------------
  function bajar(suave) {
    const visor = visorRef.current
    if (!visor) return
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    visor.scrollTo({ top: visor.scrollHeight, behavior: suave && !sinMovimiento ? 'smooth' : 'auto' })
    abajoRef.current = true
    setNuevosSinVer(0)
  }

  // Al cambiar los mensajes: al abrir, voy al final; si llega algo y estaba leyendo lo último
  // (o es mío), bajo; si estaba leyendo más arriba, no lo muevo y aviso de que hay nuevos. Si
  // acabo de cargar anteriores, recoloco para que lo que miraba no se mueva.
  useLayoutEffect(() => {
    const visor = visorRef.current
    if (!visor || estado !== 'listo') return

    if (antesDeCargarRef.current) {
      visor.scrollTop = visor.scrollHeight - antesDeCargarRef.current.alto + antesDeCargarRef.current.arriba
      antesDeCargarRef.current = null
      return
    }

    const ultimo = mensajes[mensajes.length - 1]
    const idUltimo = ultimo ? ultimo.id : 0
    const hayPendientes = pendientes.length > 0

    if (primeraVezRef.current) {
      primeraVezRef.current = false
      ultimoVistoRef.current = idUltimo
      visor.scrollTop = visor.scrollHeight
      return
    }

    if (idUltimo !== ultimoVistoRef.current) {
      const llegoDeLaOtra = ultimo && !ultimo.mine && idUltimo > ultimoVistoRef.current
      ultimoVistoRef.current = idUltimo
      if (abajoRef.current || !llegoDeLaOtra) bajar(true)
      else setNuevosSinVer((n) => n + 1)
    } else if (hayPendientes && abajoRef.current) {
      bajar(true)
    }
  }, [mensajes, pendientes.length, estado])

  function alDesplazar() {
    const abajo = estaAbajo(visorRef.current)
    abajoRef.current = abajo
    if (abajo && nuevosSinVer > 0) setNuevosSinVer(0)
  }

  // ---- Mensajes anteriores -----------------------------------------------------------
  async function cargarAnteriores() {
    const primero = mensajes[0]
    if (!primero || cargandoAntes) return
    setCargandoAntes(true)
    setAviso('')
    try {
      const data = await apiFetch(`${ruta}?before=${primero.id}`)
      const visor = visorRef.current
      antesDeCargarRef.current = { alto: visor.scrollHeight, arriba: visor.scrollTop }
      setMensajes((prev) => fusionar(prev, data.messages))
      setHayMas(data.has_more)
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setAviso(err.message)
    } finally {
      setCargandoAntes(false)
    }
  }

  // ---- Enviar ------------------------------------------------------------------------
  async function enviarTexto(cuerpo, tmp) {
    enviandoRef.current += 1
    try {
      const data = await apiFetch(ruta, { method: 'POST', body: { body: cuerpo } })
      setPendientes((prev) => prev.filter((p) => p.tmp !== tmp))
      setMensajes((prev) => fusionar(prev, [{ ...data.message, nuevo: true }]))
      onCambio()
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      if (err.status === 403) setEsAmigo(false)
      setPendientes((prev) => prev.map((p) => (p.tmp === tmp ? { ...p, estado: 'error' } : p)))
      setAviso(err.message)
    } finally {
      enviandoRef.current -= 1
    }
  }

  function enviar(cuerpoCrudo) {
    const cuerpo = cuerpoCrudo.trim()
    if (!cuerpo || cuerpo.length > MENSAJE_MAX || !esAmigo) return

    contadorTmpRef.current += 1
    const tmp = contadorTmpRef.current
    setAviso('')
    setPendientes((prev) => [...prev, { tmp, body: cuerpo, estado: 'enviando', created_at: new Date().toISOString() }])
    enviarTexto(cuerpo, tmp)
  }

  function alEnviar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    enviar(texto)
    cambiarTexto('')
    cajaRef.current?.focus()
  }

  function alTeclear(e) {
    // Intro envía; Mayús + Intro hace un salto de línea. Mientras un teclado de composición
    // (japonés, chino...) está eligiendo una palabra, Intro es suyo.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      alEnviar(e)
    }
  }

  function reintentar(pendiente) {
    setAviso('')
    setPendientes((prev) => prev.map((p) => (p.tmp === pendiente.tmp ? { ...p, estado: 'enviando' } : p)))
    enviarTexto(pendiente.body, pendiente.tmp)
  }

  function descartar(pendiente) {
    setPendientes((prev) => prev.filter((p) => p.tmp !== pendiente.tmp))
    setAviso('')
  }

  // El texto del cuadro y su borrador: lo que dejas a medias sigue ahí al volver
  function cambiarTexto(nuevo) {
    setTexto(nuevo)
    borradores.current.set(username, nuevo)
  }

  // El cuadro crece con lo que escribes, hasta un tope
  useLayoutEffect(() => {
    const caja = cajaRef.current
    if (!caja) return
    caja.style.height = 'auto'
    // Vacío, una sola línea: el placeholder no debe estirarlo
    if (texto) caja.style.height = `${Math.min(caja.scrollHeight, ALTO_MAX_CAJA)}px`
    // La barra de desplazamiento solo aparece al llegar al tope; antes, el redondeo de la
    // altura la dejaba asomar al escribir
    caja.style.overflowY = caja.scrollHeight > ALTO_MAX_CAJA ? 'auto' : 'hidden'
  }, [texto, estado, esAmigo])

  // Al abrir una conversación el cursor ya está en el cuadro, salvo en pantallas táctiles:
  // allí abriría el teclado y taparía los mensajes
  useEffect(() => {
    if (estado === 'listo' && window.matchMedia('(pointer: fine)').matches) cajaRef.current?.focus()
  }, [estado])

  // ---- Eliminar ----------------------------------------------------------------------
  async function eliminar(mensaje) {
    setPorEliminar(null)
    setAviso('')
    try {
      await apiFetch(`${ruta}/messages/${mensaje.id}`, { method: 'DELETE' })
      setMensajes((prev) => marcarBorrados(prev, [mensaje.id]))
      onCambio()
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setAviso(err.message)
    }
  }

  // ---- Pintar ------------------------------------------------------------------------
  const { montado: pastillaMontada, saliendo: pastillaSaliendo } = usePresencia(nuevosSinVer > 0)
  // Para que la pastilla diga algo mientras se desvanece
  const [ultimaCuenta, setUltimaCuenta] = useState(0)
  if (nuevosSinVer > 0 && nuevosSinVer !== ultimaCuenta) setUltimaCuenta(nuevosSinVer)

  const vistoId = mensajeVisto(mensajes, peerRead)
  const juego = amigo?.playing?.name ?? null
  const dias = agrupar(mensajes)
  const vacia = estado === 'listo' && mensajes.length === 0 && pendientes.length === 0
  const excede = texto.trim().length > MENSAJE_MAX

  const formatoDia = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const formatoDiaAnio = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const rotulo = (dia) => {
    const r = rotuloDia(dia.dia)
    if (r) return t(`chat.dia.${r}`)
    const fecha = new Date(dia.fecha)
    return (fecha.getFullYear() === new Date().getFullYear() ? formatoDia : formatoDiaAnio).format(fecha)
  }

  const persona = usuario ?? { username }

  return (
    <section className="chat-hilo" style={estiloTono(username)} aria-label={t('chat.panel', { usuario: username })}>
      {estado !== 'error' && <header className="chat-hilo__cabecera">
        <button type="button" className="chat-hilo__volver" aria-label={t('chat.volver')} onClick={onVolver}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <Link
          to={`/usuarios/${username}`}
          className="chat-hilo__persona"
          aria-label={t('chat.verPerfil', { usuario: username })}
        >
          <AvatarTono usuario={persona} tamano="normal" vivo={Boolean(juego)} />
          <span className="chat-hilo__texto">
            <strong>{username}</strong>
            {juego && (
              <small className="chat-hilo__jugando">
                <span className="chat-hilo__pulso" aria-hidden="true" />
                {t('chat.jugando', { juego })}
              </small>
            )}
          </span>
        </Link>
      </header>}

      {estado === 'cargando' && (
        <div className="chat-hilo__estado">
          <Cargando texto={t('chat.cargando')} tamano="grande" centrado />
        </div>
      )}

      {estado === 'error' && (
        <div className="chat-hilo__estado">
          <Mensaje texto={errorCarga} />
          <button type="button" className="btn btn--secundario" onClick={onVolver}>{t('chat.volver')}</button>
        </div>
      )}

      {estado === 'listo' && (
        <>
          <div className="chat-hilo__marco">
            <div
              ref={visorRef}
              className="chat-hilo__visor"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              tabIndex={0}
              onScroll={alDesplazar}
            >
              {hayMas && (
                <button type="button" className="chat-hilo__anteriores" disabled={cargandoAntes} onClick={cargarAnteriores}>
                  {cargandoAntes ? t('chat.cargandoAnteriores') : t('chat.cargarAnteriores')}
                </button>
              )}

              {vacia && (
                <div className="chat-hilo__inicio">
                  <AvatarTono usuario={persona} tamano="grande" />
                  <h2>{t('chat.inicio.titulo', { usuario: username })}</h2>
                  {esAmigo && (
                    <>
                      <p>{t('chat.inicio.texto')}</p>
                      <ul className="chat-hilo__sugerencias" aria-label={t('chat.sugerencias')}>
                        {sugerenciasInicio(juego).map((clave, i) => (
                          <li key={clave} style={{ '--orden': i }}>
                            <button type="button" onClick={() => enviar(t(`chat.sug.${clave}`, { juego }))}>
                              {t(`chat.sug.${clave}`, { juego })}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {dias.map((dia) => (
                <div key={dia.dia} className="chat-dia">
                  <h3 className="chat-dia__rotulo"><span>{rotulo(dia)}</span></h3>
                  {dia.bloques.map((bloque) => (
                    <div
                      key={bloque.mensajes[0].id}
                      className={`chat-bloque ${bloque.mine ? 'chat-bloque--mio' : 'chat-bloque--suyo'}`}
                      role="group"
                      aria-label={bloque.mine ? t('chat.miMensaje') : t('chat.mensajeDe', { usuario: username })}
                    >
                      {bloque.mensajes.map((m, i) => (
                        <Burbuja
                          key={m.id}
                          mensaje={m}
                          ultimo={i === bloque.mensajes.length - 1}
                          visto={m.id === vistoId ? { a: peerRead.at } : null}
                          onEliminar={setPorEliminar}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              {pendientes.length > 0 && (
                <div className="chat-bloque chat-bloque--mio">
                  {pendientes.map((p) => (
                    <Burbuja
                      key={`p${p.tmp}`}
                      mensaje={{ id: `p${p.tmp}`, mine: true, deleted: false, ...p, nuevo: true }}
                      ultimo
                      onReintentar={() => reintentar(p)}
                      onDescartar={() => descartar(p)}
                    />
                  ))}
                </div>
              )}
            </div>

            {pastillaMontada && (
              <button
                type="button"
                className={pastillaSaliendo ? 'chat-hilo__nuevos chat-hilo__nuevos--saliendo' : 'chat-hilo__nuevos'}
                onClick={() => bajar(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                {t('chat.nuevosMensajes')}
                <span className="chat-hilo__cuenta">{nuevosSinVer || ultimaCuenta}</span>
              </button>
            )}
          </div>

          <Mensaje texto={aviso} className="chat-hilo__aviso" />

          {esAmigo ? (
            <form className="chat-escribir" onSubmit={alEnviar}>
              <div className="chat-escribir__caja">
                <textarea
                  ref={cajaRef}
                  rows={1}
                  value={texto}
                  maxLength={MENSAJE_MAX}
                  placeholder={t('chat.escribir')}
                  aria-label={t('chat.escribir')}
                  onChange={(e) => cambiarTexto(e.target.value)}
                  onKeyDown={alTeclear}
                />
                <button
                  type="submit"
                  className="chat-escribir__enviar"
                  disabled={!texto.trim() || excede}
                  aria-label={t('chat.enviar')}
                  title={t('chat.enviar')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
              {texto.length >= AVISO_CONTADOR && (
                <p className={texto.length >= MENSAJE_MAX ? 'chat-escribir__contador chat-escribir__contador--tope' : 'chat-escribir__contador'}>
                  {t('chat.contador', { n: texto.length, max: MENSAJE_MAX })}
                </p>
              )}
            </form>
          ) : (
            <p className="chat-hilo__ya-no-amigos">{t('chat.noAmigos')}</p>
          )}
        </>
      )}

      {porEliminar && (
        <DialogoConfirmar
          titulo={t('chat.eliminarTitulo')}
          mensaje={t('chat.eliminarTexto')}
          textoConfirmar={t('chat.eliminar')}
          onConfirmar={() => eliminar(porEliminar)}
          onCancelar={() => setPorEliminar(null)}
        />
      )}
    </section>
  )
}

export default Conversacion
