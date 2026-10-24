import { useSyncExternalStore } from 'react'
import { avisosDisponibles, preferenciaAvisos, guardarPreferenciaAvisos } from './avisos'

// El estado de los avisos del sistema, compartido por toda la app: lo leen la barra (para
// avisar), el menú de ajustes (el interruptor) y el chat (la tarjeta que los ofrece). Es un
// pequeño "almacén" fuera de React: cuando cambia, useSyncExternalStore repinta a todos los que
// lo usan, sin pasar props de un componente a otro.
//
// Estado: { disponible, permiso, preferencia, activos }
//  - disponible: el navegador tiene notificaciones
//  - permiso: 'default' (no ha respondido), 'granted' o 'denied' (bloqueadas en el navegador)
//  - preferencia: true / false / null (aún no ha elegido), guardada en este equipo
//  - activos: todo junto, que es lo que decide si se avisa

function leer() {
  const disponible = avisosDisponibles()
  const permiso = disponible ? Notification.permission : 'denied'
  const preferencia = preferenciaAvisos()
  return { disponible, permiso, preferencia, activos: disponible && permiso === 'granted' && preferencia === true }
}

let estado = leer()
const oyentes = new Set()

// Vuelve a leer el estado y avisa a los componentes solo si algo cambió
function actualizar() {
  const nuevo = leer()
  if (Object.keys(nuevo).every((k) => nuevo[k] === estado[k])) return
  estado = nuevo
  for (const oyente of oyentes) oyente()
}

// El permiso se puede cambiar desde los ajustes del navegador, fuera de la app: al volver a la
// ventana lo miro otra vez
if (typeof window !== 'undefined') window.addEventListener('focus', actualizar)

function suscribir(oyente) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

// Activa los avisos. Si el navegador aún no ha preguntado, pregunta (tiene que ser al pulsar
// un botón: los navegadores no dejan pedirlo sin más). Devuelve el permiso final.
export async function activarAvisos() {
  if (!avisosDisponibles()) return 'denied'
  let permiso = Notification.permission
  if (permiso === 'default') {
    try {
      permiso = await Notification.requestPermission()
    } catch {
      permiso = Notification.permission
    }
  }
  guardarPreferenciaAvisos(permiso === 'granted')
  actualizar()
  return permiso
}

export function desactivarAvisos() {
  guardarPreferenciaAvisos(false)
  actualizar()
}

export function useAvisos() {
  return useSyncExternalStore(suscribir, () => estado)
}
