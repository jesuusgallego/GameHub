import { useMemo } from 'react'
import Desplegable from './Desplegable'
import { useIdioma } from './IdiomaContext'
import { opcionesPaises } from './paises'
import { PAISES_CON_PREFIJO, prefijoDe, separarPrefijo } from './telefono'

// Teléfono con el prefijo aparte: un desplegable con los países y su prefijo, y el campo
// del número. El prefijo se puede elegir de la lista o escribir en el propio campo del
// número: al teclear "+34" (o "0034") el prefijo salta al desplegable y el campo queda
// listo para el resto del número.
//  - prefijo: código del país del prefijo ("ES") o "" si no hay
//  - numero: lo que hay escrito en el campo del número
//  - preferido: el país del perfil; si comparte prefijo con el escrito (+1: Estados
//    Unidos o Canadá), se elige ese
//  - onChange({ prefijo, numero })
function CampoTelefono({ prefijo, numero, preferido, onChange }) {
  const { t, idioma } = useIdioma()

  // "España (+34)", en el idioma de la interfaz y ordenados por nombre
  const opciones = useMemo(() => [
    { valor: "", etiqueta: t('editarPerfil.prefijoSinIndicar') },
    ...opcionesPaises(idioma)
      .filter((o) => PAISES_CON_PREFIJO.includes(o.valor))
      .map((o) => ({ valor: o.valor, etiqueta: `${o.etiqueta} (+${prefijoDe(o.valor)})` })),
  ], [idioma, t])

  function alEscribir(e) {
    // Solo lo que puede llevar un teléfono: dígitos, "+" y separadores. Las letras no
    // se escriben (igual que en el nombre de usuario)
    // (y sin espacios al principio: el que se teclea tras "+34" sobra)
    const texto = e.target.value.replace(/[^\d\s().+-]/g, '').trimStart()
    const separado = separarPrefijo(texto, preferido)

    if (separado) onChange({ prefijo: separado.pais, numero: separado.resto })
    else onChange({ prefijo, numero: texto })
  }

  return (
    <div className="campo">
      <span id="etiqueta-telefono">{t('editarPerfil.telefono')}</span>
      <div className="campo-telefono">
        <Desplegable
          opciones={opciones}
          valor={prefijo}
          onChange={(nuevo) => onChange({ prefijo: nuevo, numero })}
          etiqueta={t('editarPerfil.prefijo')}
        />
        <input
          type="tel"
          value={numero}
          onChange={alEscribir}
          maxLength={25}
          placeholder={t('editarPerfil.telefonoPlaceholder')}
          autoComplete="tel-national"
          aria-labelledby="etiqueta-telefono"
        />
      </div>
      <small>{t('editarPerfil.telefonoAyuda')}</small>
    </div>
  )
}

export default CampoTelefono
