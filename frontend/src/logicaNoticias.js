// Lógica de las noticias sin React, para poder probarla (test/noticias.test.js).

// La clave de texto del motivo de una noticia de "Para ti" (ver services/recomendador.js en el
// backend): 'juego', 'amigos', 'similar', 'portal', 'descubrir' o 'reciente'
export function claveMotivo(motivo) {
  return motivo ? `noticias.motivo.${motivo.kind}` : null
}

// Los portales en dos grupos por idioma, el de la interfaz primero:
//   [{ lang: 'es', portales: [...] }, { lang: 'en', portales: [...] }]
export function portalesPorIdioma(portales, idioma) {
  const idiomas = [idioma, ...['es', 'en'].filter((l) => l !== idioma)]
  return idiomas
    .map((lang) => ({ lang, portales: portales.filter((p) => p.lang === lang) }))
    .filter((g) => g.portales.length > 0)
}

// Lo que se propone seguir la primera vez: los portales del idioma de la interfaz
export function preseleccion(portales, idioma) {
  return portales.filter((p) => p.lang === idioma).map((p) => p.slug)
}

// Añade las noticias de otra página sin repetir ninguna (por id), en su orden
export function juntarNoticias(actuales, nuevas) {
  const vistas = new Set(actuales.map((n) => n.id))
  return [...actuales, ...nuevas.filter((n) => !vistas.has(n.id))]
}

// El cursor de "Siguiendo" para pedir la página siguiente: la fecha y el id de la última
export function cursorSiguiente(noticias) {
  const ultima = noticias[noticias.length - 1]
  return ultima ? `before=${encodeURIComponent(ultima.published_at)}&before_id=${ultima.id}` : ''
}

// Los titulares de la cinta de "Última hora": los más recientes de lo cargado, sin repetir portal
// seguido, como mucho `cuantos`
export function titularesCinta(noticias, cuantos = 8) {
  const recientes = [...noticias].sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
  const salida = []
  for (const n of recientes) {
    if (salida.length >= cuantos) break
    if (salida[salida.length - 1]?.source.slug === n.source.slug) continue
    salida.push(n)
  }
  return salida
}

// La cola de sucesos que se envían al servidor (impresiones y clics). Una impresión se apunta UNA
// vez por noticia y pestaña mientras la página está abierta (si la vuelves a ver al desplazar, no
// cuenta otra vez); un clic, cada vez. `tomar()` saca una tanda (como mucho `max`) para enviarla.
export function crearCola(max = 50) {
  const pendientes = []
  const vistas = new Set()
  return {
    impresion(noticia, feed, posicion) {
      const clave = `${feed}:${noticia.id}`
      if (vistas.has(clave)) return false
      vistas.add(clave)
      pendientes.push({ article_id: noticia.id, kind: 'impression', feed, position: posicion })
      return true
    },
    clic(noticia, feed, posicion) {
      pendientes.push({ article_id: noticia.id, kind: 'click', feed, position: posicion })
    },
    tomar() {
      return pendientes.splice(0, max)
    },
    get pendientes() {
      return pendientes.length
    },
  }
}
