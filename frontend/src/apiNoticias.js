import { apiFetch } from './api'
import { esInvitado, guardarPortalesInvitado, marcarPortalesInvitado } from './invitado'

// Los portales de noticias que sigues, con cuenta o sin ella. Con cuenta viven en el servidor; sin
// ella, en este navegador (ver invitado.js), y el servidor los recibe en cada petición.

// El catálogo de portales (GET /news/sources), con los que sigues marcados. Sin cuenta el servidor
// no sabe cuáles sigues: se marcan los que guarda este navegador.
export async function pedirPortales(opciones) {
  const data = await apiFetch('/news/sources', opciones)
  return esInvitado() ? marcarPortalesInvitado(data.sources) : data.sources
}

// Guarda la lista de portales que sigues (PUT /news/follows; sin cuenta, en este navegador) y
// devuelve el catálogo al día
export async function guardarPortales(slugs) {
  if (esInvitado()) guardarPortalesInvitado(slugs)
  else await apiFetch('/news/follows', { method: 'PUT', body: { slugs } })
  return pedirPortales()
}
