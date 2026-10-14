// Todo el acceso al backend pasa por aquí: la URL base, el token y el manejo de
// errores. El resto de la app llama a apiFetch en vez de a fetch.
import { idiomaActual, traducir, traducirErrorApi } from './idioma'
import { leerToken } from './sesion'

const URL_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Servidor lento. En un hosting gratuito el servidor se duerme tras un rato sin uso y
// la primera petición tarda hasta un minuto en despertarlo. Si una petición pasa de
// UMBRAL_LENTO_MS sin respuesta, aviso (con alCambiarServidorLento) para que la interfaz
// lo diga en vez de parecer colgada. "lentas" cuenta cuántas peticiones están en ese
// estado a la vez: el aviso se quita cuando llega la última respuesta.
const UMBRAL_LENTO_MS = 4000
let lentas = 0
const oyentes = new Set()

// fn(true/false) se llama cuando empieza o termina el periodo de lentitud.
// Devuelve la función para darse de baja.
export function alCambiarServidorLento(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

function cambiarLentas(delta) {
  const antes = lentas > 0
  lentas += delta
  if (antes !== lentas > 0) oyentes.forEach((fn) => fn(lentas > 0))
}

// Uso: const data = await apiFetch('/games', { method: 'POST', body: { name: 'Zelda' } })
//  - `body` es un objeto normal; aquí lo convierto a JSON.
//  - `avisoLento: false` para las peticiones que tardan por naturaleza (sincronizar
//    Steam): ahí tardar no significa que el servidor estuviera dormido.
//  - Añado el token de localStorage si existe (login y registro no lo tienen).
//  - Si el backend responde con error lanzo un Error con `message` (el data.error
//    del backend, traducido al idioma de la interfaz) y `status` (código HTTP). Qué hacer con un 401 lo decide quien
//    llama: en login significa "contraseña incorrecta".
export async function apiFetch(ruta, { body, headers, avisoLento = true, ...resto } = {}) {
  const token = leerToken()

  let marcadaLenta = false
  const temporizador = avisoLento
    ? setTimeout(() => { marcadaLenta = true; cambiarLentas(1) }, UMBRAL_LENTO_MS)
    : null

  try {
    return await pedir(ruta, { body, headers, ...resto }, token)
  } finally {
    clearTimeout(temporizador)
    if (marcadaLenta) cambiarLentas(-1)
  }
}

async function pedir(ruta, { body, headers, ...resto }, token) {
  let res
  try {
    res = await fetch(`${URL_BASE}${ruta}`, {
      ...resto, // method, signal, etc.
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch (err) {
    // Si cancelé la petición con AbortController, dejo pasar el error tal cual
    if (err.name === 'AbortError') throw err
    throw new Error(traducir(idiomaActual(), 'api.sinConexion'), { cause: err })
  }

  // Si la respuesta no es JSON (por ejemplo un error HTML) sigo con {}
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const error = new Error(data.error ? traducirErrorApi(data.error) : traducir(idiomaActual(), 'api.errorInesperado'))
    error.status = res.status
    throw error
  }

  return data
}

// La foto de perfil de otra persona. Las listas de personas no llevan las fotos dentro
// (pesan mucho): llevan `has_avatar` y el navegador pide cada imagen a esta dirección,
// que no necesita sesión porque un <img> no puede enviar la cabecera Authorization.
export function urlAvatar(username) {
  return `${URL_BASE}/users/${encodeURIComponent(username)}/avatar`
}
