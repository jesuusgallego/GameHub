import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from './api'
import AvatarTono from './AvatarTono'
import AvatarGrupo from './AvatarGrupo'
import Burbuja from './Burbuja'
import Cargando from './Cargando'
import DialogoConfirmar from './DialogoConfirmar'
import InfoGrupo from './InfoGrupo'
import Mensaje from './Mensaje'
import MenuContextual from './MenuContextual'
import PuntosEscribiendo from './PuntosEscribiendo'
import { estiloTono } from './tono'
import { iniciarSondeo } from './sondeo'
import { usePresencia } from './usePresencia'
import { useIdioma } from './IdiomaContext'
import { MENSAJE_MAX } from './validacion'
import {
  fusionar, marcarBorrados, ultimoId, hayPorLeer, mensajeVisto, vistoPor, agrupar, rotuloDia,
  sugerenciasInicio, esGrupo, rutaConversacion, textoEvento, textoEscribiendo,
} from './logicaChat'

// Cada cuánto se pregunta por mensajes nuevos mientras la conversación está abierta. Es más
// seguido que el resto de la app porque aquí la gente espera una respuesta; el sondeo se
// pausa solo si la pestaña se oculta o pasan cinco minutos sin tocar nada (ver sondeo.js).
const CADA_MS = 4000
// Mientras escribes, se avisa de que estás escribiendo como mucho cada tanto (el servidor da el
// aviso por caducado a los 5 s: ver backend/src/services/escribiendo.js)
const AVISO_ESCRIBIENDO_MS = 2500
// A partir de cuántos caracteres se enseña el contador del mensaje
const AVISO_CONTADOR = Math.floor(MENSAJE_MAX * 0.8)
// Hasta dónde se estira el cuadro de texto (px) antes de pasar a tener su propia barra
const ALTO_MAX_CAJA = 160

// ¿Está el visor lo bastante abajo para considerar que estás leyendo lo último?
function estaAbajo(el) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

// El icono de cada aviso del grupo
function IconoEvento({ evento }) {
  const trazos = {
    created: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
    added: 'M15 19a6 6 0 0 0-12 0M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 8v6M16 11h6',
    removed: 'M15 19a6 6 0 0 0-12 0M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 11h6',
    left: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11',
    renamed: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
    owner: 'M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8Z',
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={trazos[evento] ?? trazos.created} />
    </svg>
  )
}

// Una conversación: con una persona o con un grupo. Su cabecera, los mensajes y el cuadro para
// escribir. Las dos funcionan igual (mismo sondeo, mismo "visto", mismos envíos); cambia lo
// que se pinta: en un grupo cada tanda lleva el nombre de quien escribe, salen los avisos del
// grupo ("ana añadió a luis") y el "visto" dice quién lo ha leído.
//  - clave: "ana" o "g:12" (ver logicaChat.js)
//  - fila: lo que dice la lista de esa conversación (en un grupo, su nombre y su gente), para
//    la cabecera mientras carga
//  - amigo: lo que sé de esa persona por la lista de amigos ({ playing }), o undefined
//  - amigos: mis amigos (para añadir gente a un grupo)
//  - yo: mi nombre de usuario
//  - borradores: { current: Map } con lo que tenía a medio escribir en cada conversación
//  - onCambio(): avisa de que hay algo nuevo (mensaje enviado, leído...) para que la lista de
//    conversaciones se ponga al día
//  - onVolver(): vuelve a la lista (en un panel estrecho; en uno ancho ya está al lado)
//  - onSalir(): he salido del grupo (o me han sacado)
//  - cerrarSesion(): para un 401
function Conversacion({ clave, fila, amigo, amigos, yo, borradores, onCambio, onVolver, onSalir, cerrarSesion }) {
  const { t, locale } = useIdioma()
  const navigate = useNavigate()
  const grupo = esGrupo(clave)
  const ruta = rutaConversacion(clave)

  const [estado, setEstado] = useState('cargando') // 'cargando' | 'listo' | 'error' | 'fuera'
  const [errorCarga, setErrorCarga] = useState('')
  // Conversación de dos: la otra persona, si seguimos siendo amigos y hasta dónde ha leído
  const [usuario, setUsuario] = useState(null)
  const [esAmigo, setEsAmigo] = useState(true)
  const [peerRead, setPeerRead] = useState(null)
  // Grupo: su nombre y su gente, y hasta dónde ha leído cada uno
  const [infoGrupo, setInfoGrupo] = useState(null)
  const [lecturas, setLecturas] = useState([])
  // Quién está escribiendo ahora (nombres; en una conversación de dos, la otra persona o nadie)
  const [escriben, setEscriben] = useState([])
  const [mensajes, setMensajes] = useState([])
  const [hayMas, setHayMas] = useState(false)
  // Lo que acabo de escribir y aún no ha confirmado el servidor: [{ tmp, body, estado, created_at }]
  const [pendientes, setPendientes] = useState([])
  const [cargandoAntes, setCargandoAntes] = useState(false)
  const [aviso, setAviso] = useState('')
  const [texto, setTexto] = useState(() => borradores.current.get(clave) ?? '')
  const [porEliminar, setPorEliminar] = useState(null)
  // Confirmación pendiente del menú: 'vaciar' o 'salir'
  const [confirmar, setConfirmar] = useState(null)
  const [menu, setMenu] = useState(null) // { x, y, n } mientras el menú de opciones está abierto
  const [infoAbierta, setInfoAbierta] = useState(false)
  const { montado: infoMontada, saliendo: infoSaliendo } = usePresencia(infoAbierta, 260)
  const [nuevosSinVer, setNuevosSinVer] = useState(0)
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')

  const visorRef = useRef(null)
  const cajaRef = useRef(null)
  const opcionesRef = useRef(null)
  // Para decidir si hay que bajar solo al llegar algo: ¿estaba leyendo lo último?
  const abajoRef = useRef(true)
  // El último mensaje que ya conté al decidir el scroll, y si es la primera vez
  const ultimoVistoRef = useRef(0)
  const primeraVezRef = useRef(true)
  // Posición del visor antes de cargar mensajes anteriores, para no saltar al añadirlos arriba
  const antesDeCargarRef = useRef(null)
  // Hasta qué mensaje de los demás ya avisé al servidor que lo vi
  const leidoHastaRef = useRef(0)
  // Cuántos envíos hay en vuelo; mientras, no meto mis mensajes que lleguen por el sondeo
  // (ya los traerá la respuesta del envío, y saldrían duplicados un momento)
  const enviandoRef = useRef(0)
  const mensajesRef = useRef(mensajes)
  const contadorTmpRef = useRef(0)
  // Cuándo avisé por última vez de que estoy escribiendo (0 = no lo estoy)
  const avisoEscribiendoRef = useRef(0)

  useEffect(() => { mensajesRef.current = mensajes }, [mensajes])

  // Lo que trae cada respuesta del servidor además de los mensajes
  const aplicarDatos = useCallback((data) => {
    if (grupo) {
      setInfoGrupo(data.group)
      setLecturas(data.reads)
      setEscriben(data.typing)
    } else {
      setUsuario(data.user)
      setEsAmigo(data.is_friend)
      setPeerRead((prev) => (
        prev?.id === data.peer_read?.id && prev?.at === data.peer_read?.at ? prev : data.peer_read
      ))
      setEscriben(data.typing ? [clave] : [])
    }
  }, [grupo, clave])

  // ---- Carga inicial -----------------------------------------------------------------
  useEffect(() => {
    let cancelado = false

    apiFetch(ruta)
      .then((data) => {
        if (cancelado) return
        aplicarDatos(data)
        setMensajes(data.messages)
        setHayMas(data.has_more)
        setEstado('listo')
      })
      .catch((err) => {
        if (cancelado) return
        if (err.status === 401) return cerrarSesion()
        setErrorCarga(grupo && err.status === 404 ? t('chat.grupo.fuera') : err.message)
        setEstado('error')
      })

    return () => { cancelado = true }
  }, [ruta, grupo, aplicarDatos, cerrarSesion, t])

  // ---- Sondeo de lo nuevo ------------------------------------------------------------
  const traerNuevos = useCallback(() => {
    const despues = ultimoId(mensajesRef.current)
    return apiFetch(`${ruta}?after=${despues}`, { avisoLento: false })
      .then((data) => {
        // Mis propios mensajes los trae la respuesta del envío
        const nuevos = (enviandoRef.current > 0 ? data.messages.filter((m) => !m.mine) : data.messages)
          .map((m) => ({ ...m, nuevo: true }))
        setMensajes((prev) => marcarBorrados(fusionar(prev, nuevos), data.deleted))
        aplicarDatos(data)
        if (nuevos.length > 0) onCambio()
      })
      .catch((err) => {
        if (err.status === 401) cerrarSesion()
        // Me han sacado del grupo mientras lo miraba
        else if (grupo && err.status === 404) setEstado('fuera')
        // Cualquier otro fallo: ya se reintenta en el siguiente turno
      })
  }, [ruta, grupo, aplicarDatos, onCambio, cerrarSesion])

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
      const llegoDeOtro = ultimo && !ultimo.mine && idUltimo > ultimoVistoRef.current
      ultimoVistoRef.current = idUltimo
      if (abajoRef.current || !llegoDeOtro) bajar(true)
      else setNuevosSinVer((n) => n + 1)
    } else if (hayPendientes && abajoRef.current) {
      bajar(true)
    }
  }, [mensajes, pendientes.length, estado])

  // Si aparece "escribiendo" y estaba abajo, sigo abajo para verlo
  const hayEscritura = escriben.length > 0
  useLayoutEffect(() => {
    if (hayEscritura && abajoRef.current && visorRef.current) {
      visorRef.current.scrollTop = visorRef.current.scrollHeight
    }
  }, [hayEscritura])

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

  // ---- Escribiendo -------------------------------------------------------------------
  // Mientras hay texto, aviso cada AVISO_ESCRIBIENDO_MS; al vaciar el cuadro, aviso de que lo
  // dejo. Si un aviso falla no pasa nada: es solo un detalle.
  const puedeEscribir = grupo || esAmigo
  function avisarEscribiendo(nuevo) {
    if (!puedeEscribir) return
    const ahora = Date.now()
    if (nuevo.trim()) {
      if (ahora - avisoEscribiendoRef.current < AVISO_ESCRIBIENDO_MS) return
      avisoEscribiendoRef.current = ahora
      apiFetch(`${ruta}/typing`, { method: 'POST', avisoLento: false }).catch(() => {})
    } else if (avisoEscribiendoRef.current) {
      avisoEscribiendoRef.current = 0
      apiFetch(`${ruta}/typing`, { method: 'POST', body: { active: false }, avisoLento: false }).catch(() => {})
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
      if (grupo && err.status === 404) setEstado('fuera')
      setPendientes((prev) => prev.map((p) => (p.tmp === tmp ? { ...p, estado: 'error' } : p)))
      setAviso(err.message)
    } finally {
      enviandoRef.current -= 1
    }
  }

  function enviar(cuerpoCrudo) {
    const cuerpo = cuerpoCrudo.trim()
    if (!cuerpo || cuerpo.length > MENSAJE_MAX || !puedeEscribir) return

    contadorTmpRef.current += 1
    const tmp = contadorTmpRef.current
    // Al enviar, el servidor ya da por terminado el "escribiendo"
    avisoEscribiendoRef.current = 0
    setAviso('')
    setPendientes((prev) => [...prev, { tmp, body: cuerpo, estado: 'enviando', created_at: new Date().toISOString() }])
    enviarTexto(cuerpo, tmp)
  }

  function alEnviar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    enviar(texto)
    setTexto('')
    borradores.current.set(clave, '')
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
    borradores.current.set(clave, nuevo)
    avisarEscribiendo(nuevo)
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

  // ---- Eliminar un mensaje -----------------------------------------------------------
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

  // ---- Vaciar y salir ----------------------------------------------------------------
  // Vaciar es solo para mí: la otra persona (o el resto del grupo) lo sigue teniendo todo
  async function vaciar() {
    setConfirmar(null)
    setAviso('')
    try {
      await apiFetch(`${ruta}/clear`, { method: 'POST' })
      setMensajes([])
      setHayMas(false)
      leidoHastaRef.current = 0
      onCambio()
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setAviso(err.message)
    }
  }

  async function salir() {
    setConfirmar(null)
    setAviso('')
    try {
      await apiFetch(`${ruta}/members/${encodeURIComponent(yo)}`, { method: 'DELETE' })
      onSalir()
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setAviso(err.message)
    }
  }

  // El menú de "⋯" de la cabecera. Se abre debajo del botón.
  function abrirMenu() {
    const caja = opcionesRef.current.getBoundingClientRect()
    setMenu((previo) => ({ x: caja.right - 220, y: caja.bottom + 6, n: (previo?.n ?? 0) + 1 }))
  }

  const opcionesMenu = grupo
    ? [
      { id: 'info', etiqueta: t('chat.grupo.info'), onElegir: () => setInfoAbierta(true) },
      { id: 'vaciar', etiqueta: t('chat.vaciar'), peligro: true, onElegir: () => setConfirmar('vaciar') },
      { id: 'salir', etiqueta: t('chat.grupo.salir'), peligro: true, onElegir: () => setConfirmar('salir') },
    ]
    : [
      { id: 'perfil', etiqueta: t('menu.verPerfil'), onElegir: () => navigate(`/usuarios/${clave}`) },
      { id: 'vaciar', etiqueta: t('chat.vaciar'), peligro: true, onElegir: () => setConfirmar('vaciar') },
    ]

  // ---- Pintar ------------------------------------------------------------------------
  const { montado: pastillaMontada, saliendo: pastillaSaliendo } = usePresencia(nuevosSinVer > 0)
  // Para que la pastilla diga algo mientras se desvanece
  const [ultimaCuenta, setUltimaCuenta] = useState(0)
  if (nuevosSinVer > 0 && nuevosSinVer !== ultimaCuenta) setUltimaCuenta(nuevosSinVer)

  // "Escribiendo" entra y sale con su animación; mientras sale sigue diciendo lo último
  const { montado: escrituraMontada, saliendo: escrituraSaliendo } = usePresencia(hayEscritura, 220)
  const [ultimosEscriben, setUltimosEscriben] = useState([])
  if (hayEscritura && escriben.join() !== ultimosEscriben.join()) setUltimosEscriben(escriben)

  const formatoHora = new Intl.DateTimeFormat(locale, { timeStyle: 'short' })
  const lista = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })

  // El "Visto": en una conversación de dos, bajo el último mío que ha leído la otra persona;
  // en un grupo, bajo mi último mensaje, con quién lo ha leído
  let visto = null
  if (grupo) {
    const v = vistoPor(mensajes, lecturas)
    if (v) visto = { id: v.id, texto: v.todos ? t('chat.vistoTodos') : t('chat.vistoPor', { nombres: lista.format(v.nombres) }) }
  } else {
    const id = mensajeVisto(mensajes, peerRead)
    if (id !== null) visto = { id, texto: t('chat.vistoA', { hora: formatoHora.format(new Date(peerRead.at)) }) }
  }

  const juego = grupo ? null : amigo?.playing?.name ?? null
  const dias = agrupar(mensajes)
  const hayTexto = mensajes.some((m) => m.kind !== 'event')
  const vacia = estado === 'listo' && !hayTexto && pendientes.length === 0
  const excede = texto.trim().length > MENSAJE_MAX

  const formatoDia = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const formatoDiaAnio = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const rotulo = (dia) => {
    const r = rotuloDia(dia.dia)
    if (r) return t(`chat.dia.${r}`)
    const fecha = new Date(dia.fecha)
    return (fecha.getFullYear() === new Date().getFullYear() ? formatoDia : formatoDiaAnio).format(fecha)
  }

  // Lo que se sabe del grupo: lo que trajo el servidor o, mientras carga, lo de la lista
  const nombreGrupo = infoGrupo?.name ?? fila?.name ?? ''
  const miembros = infoGrupo?.members ?? null
  const otrosMiembros = miembros
    ? miembros.filter((m) => m.username !== yo)
    : fila?.members ?? []
  const fotoDe = new Map((miembros ?? []).map((m) => [m.username, m]))
  const persona = usuario ?? { username: clave }
  const titulo = grupo ? nombreGrupo : clave

  // El subtítulo de la cabecera: quién escribe; si no, a qué juega tu amigo o quién hay en el grupo
  let subtitulo = null
  if (hayEscritura) {
    subtitulo = (
      <small className="chat-hilo__escribiendo">
        <PuntosEscribiendo />
        {textoEscribiendo(escriben, t, grupo)}
      </small>
    )
  } else if (grupo && miembros) {
    subtitulo = <small className="chat-hilo__miembros">{lista.format([...otrosMiembros.map((m) => m.username), t('chat.grupo.tu')])}</small>
  } else if (juego) {
    subtitulo = (
      <small className="chat-hilo__jugando">
        <span className="chat-hilo__pulso" aria-hidden="true" />
        {t('chat.jugando', { juego })}
      </small>
    )
  }

  const textoPerfil = (
    <span className="chat-hilo__texto">
      <strong>{titulo}</strong>
      {subtitulo}
    </span>
  )

  const fuera = estado === 'fuera'

  return (
    <section
      className={grupo ? 'chat-hilo chat-hilo--grupo' : 'chat-hilo'}
      style={estiloTono(grupo ? nombreGrupo : clave)}
      aria-label={grupo ? t('chat.grupo.panel', { grupo: nombreGrupo }) : t('chat.panel', { usuario: clave })}
    >
      {estado !== 'error' && <header className="chat-hilo__cabecera">
        <button type="button" className="chat-hilo__volver" aria-label={t('chat.volver')} onClick={onVolver}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {grupo ? (
          <button
            type="button"
            className="chat-hilo__persona"
            aria-label={t('chat.grupo.verInfo', { grupo: nombreGrupo })}
            disabled={!infoGrupo || fuera}
            onClick={() => setInfoAbierta(true)}
          >
            <AvatarGrupo nombre={nombreGrupo || '?'} miembros={otrosMiembros} />
            {textoPerfil}
          </button>
        ) : (
          <Link to={`/usuarios/${clave}`} className="chat-hilo__persona" aria-label={t('chat.verPerfil', { usuario: clave })}>
            <AvatarTono usuario={persona} tamano="normal" vivo={Boolean(juego)} />
            {textoPerfil}
          </Link>
        )}

        {estado === 'listo' && (
          <button
            ref={opcionesRef}
            type="button"
            className="chat-hilo__opciones"
            aria-label={t('chat.opciones')}
            title={t('chat.opciones')}
            aria-haspopup="menu"
            aria-expanded={Boolean(menu)}
            onClick={abrirMenu}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" />
            </svg>
          </button>
        )}
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

      {(estado === 'listo' || fuera) && (
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
                  {grupo
                    ? <AvatarGrupo nombre={nombreGrupo} miembros={otrosMiembros} tamano="grande" />
                    : <AvatarTono usuario={persona} tamano="grande" />}
                  <h2>{grupo ? nombreGrupo : t('chat.inicio.titulo', { usuario: clave })}</h2>
                  {puedeEscribir && !fuera && (
                    <>
                      <p>{grupo ? t('chat.grupo.inicio') : t('chat.inicio.texto')}</p>
                      <ul className="chat-hilo__sugerencias" aria-label={t('chat.sugerencias')}>
                        {(grupo ? ['holaGrupo', 'jugamos'] : sugerenciasInicio(juego)).map((c, i) => (
                          <li key={c} style={{ '--orden': i }}>
                            <button type="button" onClick={() => enviar(t(`chat.sug.${c}`, { juego }))}>
                              {t(`chat.sug.${c}`, { juego })}
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
                  {dia.bloques.map((bloque) => {
                    if (bloque.evento) {
                      const e = bloque.evento
                      return (
                        <p key={e.id} className={`chat-evento chat-evento--${e.event}${e.nuevo ? ' chat-evento--nuevo' : ''}`}>
                          <IconoEvento evento={e.event} />
                          <span>{textoEvento(e, t, yo)}</span>
                          <time dateTime={e.created_at}>{formatoHora.format(new Date(e.created_at))}</time>
                        </p>
                      )
                    }
                    const autor = grupo && !bloque.mine ? bloque.sender : null
                    return (
                      <div
                        key={bloque.mensajes[0].id}
                        className={[
                          'chat-bloque',
                          bloque.mine ? 'chat-bloque--mio' : 'chat-bloque--suyo',
                          autor && 'chat-bloque--con-autor',
                        ].filter(Boolean).join(' ')}
                        style={autor ? estiloTono(autor) : undefined}
                        role="group"
                        aria-label={bloque.mine ? t('chat.miMensaje') : t('chat.mensajeDe', { usuario: autor ?? clave })}
                      >
                        {autor && (
                          <span className="chat-bloque__autor">
                            <AvatarTono usuario={fotoDe.get(autor) ?? { username: autor }} tamano="pequeno" />
                            <strong>{autor}</strong>
                          </span>
                        )}
                        {bloque.mensajes.map((m, i) => (
                          <Burbuja
                            key={m.id}
                            mensaje={m}
                            ultimo={i === bloque.mensajes.length - 1}
                            visto={visto?.id === m.id ? visto.texto : null}
                            onEliminar={fuera ? undefined : setPorEliminar}
                          />
                        ))}
                      </div>
                    )
                  })}
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

              {escrituraMontada && (
                <div
                  className={[
                    'chat-tecleo',
                    escrituraSaliendo && 'chat-tecleo--saliendo',
                    grupo && 'chat-bloque--con-autor',
                  ].filter(Boolean).join(' ')}
                  // En un grupo, del color de quien escribe (si es uno solo)
                  style={grupo && ultimosEscriben.length === 1 ? estiloTono(ultimosEscriben[0]) : undefined}
                  aria-hidden="true"
                >
                  {grupo && <small>{textoEscribiendo(ultimosEscriben, t, true)}</small>}
                  <span className="chat-tecleo__burbuja"><PuntosEscribiendo /></span>
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

          {fuera ? (
            <div className="chat-hilo__ya-no-amigos chat-hilo__fuera">
              <p>{t('chat.grupo.fuera')}</p>
              <button type="button" className="btn btn--secundario" onClick={onSalir}>{t('chat.volver')}</button>
            </div>
          ) : puedeEscribir ? (
            <form className="chat-escribir" onSubmit={alEnviar}>
              <div className="chat-escribir__caja">
                <textarea
                  ref={cajaRef}
                  rows={1}
                  value={texto}
                  maxLength={MENSAJE_MAX}
                  placeholder={grupo ? t('chat.escribirGrupo', { grupo: nombreGrupo }) : t('chat.escribir')}
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

      {/* Encima de toda la conversación, cabecera incluida */}
      {infoMontada && infoGrupo && !fuera && (
        <InfoGrupo
          grupo={infoGrupo}
          saliendo={infoSaliendo}
          ruta={ruta}
          yo={yo}
          amigos={amigos}
          onCambio={() => { traerNuevos(); onCambio() }}
          onVaciar={() => setConfirmar('vaciar')}
          onSalir={() => setConfirmar('salir')}
          onCerrar={() => setInfoAbierta(false)}
          cerrarSesion={cerrarSesion}
        />
      )}

      {menu && (
        <MenuContextual
          key={menu.n}
          x={menu.x}
          y={menu.y}
          opciones={opcionesMenu}
          etiqueta={t('chat.opciones')}
          onCerrar={() => setMenu(null)}
        />
      )}

      {porEliminar && (
        <DialogoConfirmar
          titulo={t('chat.eliminarTitulo')}
          mensaje={grupo ? t('chat.eliminarTextoGrupo') : t('chat.eliminarTexto')}
          textoConfirmar={t('chat.eliminar')}
          onConfirmar={() => eliminar(porEliminar)}
          onCancelar={() => setPorEliminar(null)}
        />
      )}

      {confirmar === 'vaciar' && (
        <DialogoConfirmar
          titulo={grupo ? t('chat.vaciarTituloGrupo') : t('chat.vaciarTitulo')}
          mensaje={grupo ? t('chat.vaciarTextoGrupo') : t('chat.vaciarTexto', { usuario: clave })}
          textoConfirmar={t('chat.vaciarBoton')}
          onConfirmar={vaciar}
          onCancelar={() => setConfirmar(null)}
        />
      )}

      {confirmar === 'salir' && (
        <DialogoConfirmar
          titulo={t('chat.grupo.salirTitulo', { grupo: nombreGrupo })}
          mensaje={infoGrupo?.is_owner && (infoGrupo?.members.length ?? 0) > 1 ? t('chat.grupo.salirTextoAdmin') : t('chat.grupo.salirTexto')}
          textoConfirmar={t('chat.grupo.salirBoton')}
          onConfirmar={salir}
          onCancelar={() => setConfirmar(null)}
        />
      )}
    </section>
  )
}

export default Conversacion
