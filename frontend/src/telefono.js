// Lógica del campo de teléfono: el prefijo del país y el número van por separado en el
// formulario, y aquí se juntan y se separan. Sin React, para poder probarla.
//
// Los prefijos telefónicos los conoce libphonenumber-js (la misma librería que valida en
// el servidor): qué prefijo tiene cada país y qué países comparten uno (+1 es de Estados
// Unidos, Canadá y varios países del Caribe; +7 de Rusia y Kazajistán...).
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min'
import metadata from 'libphonenumber-js/min/metadata'
import { normalizarTelefono } from './validacion.js'
import { PAISES } from './paises.js'

// Los países de nuestra lista que tienen prefijo (unos pocos, como la Antártida, no)
const CON_PREFIJO = new Set(getCountries())
export const PAISES_CON_PREFIJO = PAISES.filter((codigo) => CON_PREFIJO.has(codigo))

// "ES" -> "34"
export function prefijoDe(pais) {
  return CON_PREFIJO.has(pais) ? getCountryCallingCode(pais) : ''
}

// Los países de nuestra lista que tienen ese prefijo, el principal primero (US en +1)
function paisesDePrefijo(codigo) {
  return (metadata.country_calling_codes[codigo] ?? []).filter((p) => PAISES_CON_PREFIJO.includes(p))
}

// Qué país enseñar para un prefijo. Si el que el usuario ya eligió como país de su perfil
// usa ese mismo prefijo, ese ("CA" en +1 si vive en Canadá); si no, el país del propio
// número ("US" para +1 415...) y, como último recurso, el principal del prefijo.
function paisDePrefijo(codigo, preferido, delNumero) {
  const paises = paisesDePrefijo(codigo)
  if (preferido && paises.includes(preferido)) return preferido
  if (delNumero && paises.includes(delNumero)) return delNumero
  return paises[0] ?? ''
}

// Si el texto empieza por un prefijo internacional completo ("+34...", "0034..."), lo
// separa: { pais, resto }. Si todavía no es un prefijo completo ("+3") o no lleva "+",
// devuelve null. Los prefijos del mundo no son prefijo unos de otros (+3 no es ninguno,
// +34 sí, y no hay uno que empiece por +34), así que en cuanto coincide uno, ya es ese.
export function separarPrefijo(texto, preferido = '') {
  const t = normalizarTelefono(texto)
  if (!t.startsWith('+')) return null

  const digitos = t.slice(1)
  for (const largo of [1, 2, 3]) {
    const codigo = digitos.slice(0, largo)
    if (codigo.length < largo) break
    const pais = paisDePrefijo(codigo, preferido)
    if (pais) return { pais, resto: digitos.slice(largo) }
  }
  return null
}

// Junta el prefijo elegido y el número escrito en un teléfono en formato internacional
// ("+34600123456"). El número se interpreta como lo escribiría alguien de ese país: con
// parsePhoneNumberFromString se quita el "0" inicial que algunos países marcan solo dentro
// (en Reino Unido, 07700... es +44 7700...). Devuelve "" si no hay número. Si no se puede
// formar uno válido, devuelve lo mejor que hay y telefonoValido dirá que no.
export function componerTelefono(pais, numero) {
  const texto = normalizarTelefono(numero.trim())
  if (texto === '') return ''
  // Ya trae su "+" y su prefijo completo: es el teléfono tal cual
  if (texto.startsWith('+')) return texto
  if (!pais || !CON_PREFIJO.has(pais)) return texto

  const telefono = parsePhoneNumberFromString(texto, pais)
  if (telefono) return telefono.number
  return `+${getCountryCallingCode(pais)}${texto.replace(/\D/g, '')}`
}

// ¿Es un número válido? Recibe el teléfono ya compuesto ("+34600123456")
export function telefonoValido(telefono) {
  if (!telefono.startsWith('+')) return false
  const parseado = parsePhoneNumberFromString(telefono)
  return Boolean(parseado && parseado.isValid() && !parseado.ext)
}

// Lo contrario de componer: de "+34600123456" saca el país del prefijo y el número como
// se escribe dentro del país ("600 12 34 56"). `preferido` es el país del perfil.
export function descomponerTelefono(telefono, preferido = '') {
  if (!telefono) return { pais: '', numero: '' }

  const parseado = parsePhoneNumberFromString(telefono)
  if (!parseado) return { pais: '', numero: telefono }

  return {
    pais: paisDePrefijo(parseado.countryCallingCode, preferido, parseado.country),
    numero: parseado.formatNational(),
  }
}
