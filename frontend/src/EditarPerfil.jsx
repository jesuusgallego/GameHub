import { useState, useRef, useEffect, useMemo } from 'react'
import { apiFetch } from './api'
import Avatar from './Avatar'
import Cargando from './Cargando'
import SelectorArtwork from './SelectorArtwork'
import RecortadorFoto from './RecortadorFoto'
import { useCambioVista } from './useCambioVista'
import Mensaje from './Mensaje'
import { useIdioma } from './IdiomaContext'
import Desplegable from './Desplegable'
import {
  usernameRegex, normalizarUsername, USERNAME_MAX, SEXOS, VISIBILIDADES, LIMITES_PERFIL, limitesFechaNacimiento,
} from './validacion'
import CampoTelefono from './CampoTelefono'
import {
  PAISES_CON_PREFIJO, componerTelefono, descomponerTelefono, telefonoValido,
} from './telefono'
import { opcionesPaises } from './paises'

const BIO_MAX = 300

// Formulario de foto, nombre de usuario, bio y datos personales (nombre y apellidos,
// fecha de nacimiento, sexo, localización, país y teléfono: todos opcionales).
// La foto puede ser una imagen subida o una ilustración de uno de los juegos de la
// biblioteca. En los dos casos se encuadra en el RecortadorFoto y acaba siendo un
// cuadrado de 256 px en base64.
//  - perfil: los datos guardados ahora mismo
//  - onGuardado(usuario): el padre actualiza el perfil compartido con la barra
//  - cerrarSesion(): para cuando el backend dice 401 (sesión caducada)
// Los campos son copias locales: no se guarda nada hasta pulsar "Guardar".
function EditarPerfil({ perfil, onGuardado, cerrarSesion }) {
  const { t, idioma } = useIdioma()
  const [username, setUsername] = useState(perfil.username)
  const [bio, setBio] = useState(perfil.bio ?? "")
  const [nombre, setNombre] = useState(perfil.first_name ?? "")
  const [apellidos, setApellidos] = useState(perfil.last_name ?? "")
  const [nacimiento, setNacimiento] = useState(perfil.birth_date ?? "") // "AAAA-MM-DD" o ""
  const [sexo, setSexo] = useState(perfil.gender ?? "") // "" = sin indicar
  const [localizacion, setLocalizacion] = useState(perfil.location ?? "")
  const [pais, setPais] = useState(perfil.country ?? "") // código ISO ("ES") o "" = sin indicar
  // Quién ve cada parte del perfil: "nadie", "amigos" o "todos"
  const [visPersonal, setVisPersonal] = useState(perfil.visibility_personal ?? "nadie")
  const [visBiblioteca, setVisBiblioteca] = useState(perfil.visibility_library ?? "amigos")
  // El teléfono se edita en dos partes: el prefijo (código del país, "ES") y el número
  const [telefono, setTelefono] = useState(() => {
    const { pais: prefijo, numero } = descomponerTelefono(perfil.phone, perfil.country)
    return { prefijo, numero }
  })
  const [avatar, setAvatar] = useState(perfil.avatar)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const [guardado, setGuardado] = useState(false)
  // Panel de debajo de la foto: abierto o no, y qué enseña: las ilustraciones de
  // mis juegos o el recortador de una foto subida. Al cambiar de uno a otro con el
  // panel abierto, el que sale se desvanece (useCambioVista).
  const [eligiendo, setEligiendo] = useState(false)
  const [modo, setModo] = useState("ilustraciones") // "ilustraciones" o "subida"
  const { saliendo, cambiar } = useCambioVista()
  // La foto subida, como URL temporal (blob:) para poder enseñarla al recortarla
  const [subida, setSubida] = useState(null)
  // Las ilustraciones de mis juegos (null = aún sin pedir; se piden la primera vez
  // que se abre el selector)
  const [juegos, setJuegos] = useState(null)
  const [errorJuegos, setErrorJuegos] = useState("")
  // Sube cada vez que abro el selector: como es su `key`, así empieza siempre en
  // la lista y no en la ilustración que dejé a medias
  const [aperturas, setAperturas] = useState(0)
  const archivoRef = useRef(null)

  // Al elegir el país, si todavía no hay prefijo de teléfono, se pone el de ese país. Si ya
  // había uno (elegido o escrito) no se toca: no quiero pisar lo que alguien puso a propósito
  function cambiarPais(nuevo) {
    setPais(nuevo)
    if (!telefono.prefijo && PAISES_CON_PREFIJO.includes(nuevo)) {
      setTelefono({ ...telefono, prefijo: nuevo })
    }
  }

  // Lo que admite el campo de fecha: ni futura ni de hace más de 120 años
  const { min: nacimientoMin, max: nacimientoMax } = limitesFechaNacimiento()
  // Los países en el idioma de la interfaz, ordenados por su nombre
  const opcionesPais = useMemo(
    () => [{ valor: "", etiqueta: t('editarPerfil.paisSinIndicar') }, ...opcionesPaises(idioma)],
    [idioma, t]
  )
  const opcionesVisibilidad = VISIBILIDADES.map((valor) => ({ valor, etiqueta: t(`privacidad.${valor}`) }))
  const opcionesSexo = [
    { valor: "", etiqueta: t('sexo.sinIndicar') },
    ...SEXOS.map((valor) => ({ valor, etiqueta: t(`sexo.${valor}`) })),
  ]

  // Solo envío lo que ha cambiado, y "Guardar" se activa solo si hay algo que enviar
  const cambios = {}
  if (username !== perfil.username) cambios.username = username
  if (bio.trim() !== (perfil.bio ?? "")) cambios.bio = bio.trim() || null
  if (avatar !== perfil.avatar) cambios.avatar = avatar
  // Un campo vacío se manda como null: así se borra el dato
  if (nombre.trim() !== (perfil.first_name ?? "")) cambios.first_name = nombre.trim() || null
  if (apellidos.trim() !== (perfil.last_name ?? "")) cambios.last_name = apellidos.trim() || null
  if (nacimiento !== (perfil.birth_date ?? "")) cambios.birth_date = nacimiento || null
  if (sexo !== (perfil.gender ?? "")) cambios.gender = sexo || null
  if (localizacion.trim() !== (perfil.location ?? "")) cambios.location = localizacion.trim() || null
  if (pais !== (perfil.country ?? "")) cambios.country = pais || null
  if (visPersonal !== perfil.visibility_personal) cambios.visibility_personal = visPersonal
  if (visBiblioteca !== perfil.visibility_library) cambios.visibility_library = visBiblioteca
  // Comparo y envío el teléfono ya compuesto en formato internacional (el servidor lo
  // guarda así): si no, "600 12 34 56" frente a "+34600123456" parecería un cambio
  // pendiente para siempre
  const telefonoCompuesto = componerTelefono(telefono.prefijo, telefono.numero)
  if (telefonoCompuesto !== (perfil.phone ?? "")) cambios.phone = telefonoCompuesto || null
  const hayCambios = Object.keys(cambios).length > 0

  // Al cambiar de foto subida (o al irme) libero la URL temporal anterior, que si
  // no se queda ocupando memoria hasta cerrar la pestaña
  useEffect(() => {
    return () => { if (subida) URL.revokeObjectURL(subida) }
  }, [subida])

  // Enseña `nuevoModo` en el panel: lo abre si está cerrado y, si está abierto con
  // el otro modo, hace el cambio animado. `preparar` deja listo lo del modo nuevo.
  function mostrar(nuevoModo, preparar) {
    const cambio = () => {
      preparar()
      setModo(nuevoModo)
      setAperturas((n) => n + 1)
    }

    if (eligiendo && modo !== nuevoModo) {
      cambiar(cambio)
    } else {
      cambio()
      setEligiendo(true)
    }
  }

  function elegirFoto(e) {
    const archivo = e.target.files[0]
    // Vacío el input para poder volver a elegir el mismo archivo más tarde
    e.target.value = ""
    if (!archivo) return

    setGuardado(false)
    if (!archivo.type.startsWith('image/')) {
      setError(t('editarPerfil.noImagen'))
      return
    }

    setError("")
    const url = URL.createObjectURL(archivo)
    mostrar("subida", () => setSubida(url))
  }

  async function alternarSelector() {
    // Si ya enseña las ilustraciones, el botón las cierra
    if (eligiendo && modo === "ilustraciones") {
      setEligiendo(false)
      return
    }

    mostrar("ilustraciones", () => {})
    if (juegos) return

    setErrorJuegos("")
    try {
      const data = await apiFetch('/games/artworks')
      setJuegos(data.games)
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setErrorJuegos(err.message)
    }
  }

  // La foto ya recortada, venga de donde venga
  function usarFoto(foto) {
    setAvatar(foto)
    setEligiendo(false)
    setGuardado(false)
    setError("")
  }

  async function handleGuardar(e) {
    e.preventDefault()
    setError("")
    setGuardado(false)

    if (username === "") {
      setError(t('validacion.usernameObligatorio'))
      return
    }

    if (!usernameRegex.test(username)) {
      setError(t('validacion.usernameInvalido'))
      return
    }

    if (telefonoCompuesto !== "" && !telefonoValido(telefonoCompuesto)) {
      setError(telefono.prefijo || telefonoCompuesto.startsWith('+')
        ? t('validacion.telefonoInvalido')
        : t('validacion.telefonoSinPrefijo'))
      return
    }

    setOcupado(true)
    try {
      const data = await apiFetch('/profile', { method: 'PATCH', body: cambios })
      onGuardado(data.user)
      setGuardado(true)
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form className="formulario" onSubmit={handleGuardar}>
      <div className="foto-perfil">
        <Avatar usuario={{ username, avatar }} tamano="grande" />
        <div className="foto-perfil__acciones">
          <input
            ref={archivoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={elegirFoto}
            hidden
          />
          <button type="button" className="btn btn--secundario" onClick={() => archivoRef.current.click()}>
            {t('editarPerfil.subir')}
          </button>
          <button
            type="button"
            className="btn btn--secundario"
            aria-expanded={eligiendo && modo === "ilustraciones"}
            onClick={alternarSelector}
          >
            {t('editarPerfil.elegirIlustracion')}
            <svg className="btn__flecha" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {avatar && (
            <button type="button" className="btn btn--peligro" onClick={() => setAvatar(null)}>
              {t('editarPerfil.quitarFoto')}
            </button>
          )}
          <small>{t('editarPerfil.ayudaFoto')}</small>
        </div>
      </div>

      {/* El panel está siempre en el DOM y se despliega/pliega con CSS (así la
          animación de cerrar es la de abrir al revés). Cerrado queda oculto
          (visibility: hidden), por lo que no se puede tabular a sus botones. */}
      <div className={eligiendo ? "selector-avatar selector-avatar--abierto" : "selector-avatar"}>
        <div className="selector-avatar__interior">
          <div className="selector-avatar__caja">
            {/* key: al cambiar de modo (o reabrir) la vista nueva entra con su animación */}
            <div key={modo} className={saliendo ? "vista vista--saliendo" : "vista"}>
              {modo === "subida" ? (
                subida && (
                  <RecortadorFoto
                    key={aperturas}
                    url={subida}
                    onUsar={usarFoto}
                    onVolver={() => setEligiendo(false)}
                    etiquetaVolver={t('comun.cancelar')}
                  />
                )
              ) : (
                <>
                  <Mensaje texto={errorJuegos} />
                  {!errorJuegos && !juegos && <Cargando texto={t('editarPerfil.buscandoIlustraciones')} />}
                  {juegos?.length === 0 && (
                    <p className="estado">
                      {t('editarPerfil.sinIlustraciones')}
                    </p>
                  )}
                  {juegos?.length > 0 && <SelectorArtwork key={aperturas} juegos={juegos} onUsar={usarFoto} />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <label className="campo">
        <span>{t('editarPerfil.username')}</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(normalizarUsername(e.target.value))}
          maxLength={USERNAME_MAX}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <small>{t('validacion.usernameAyuda')}</small>
      </label>

      <label className="campo">
        <span>{t('editarPerfil.bio')}</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={BIO_MAX}
          placeholder={t('editarPerfil.bioPlaceholder')}
        />
        <small>{bio.length}/{BIO_MAX}</small>
      </label>

      <h2 className="subtitulo-formulario">{t('editarPerfil.datosPersonales')}</h2>
      <p className="ayuda-formulario">{t('editarPerfil.datosAyuda')}</p>

      <div className="formulario__pareja">
        <label className="campo">
          <span>{t('editarPerfil.nombre')}</span>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={LIMITES_PERFIL.first_name}
            autoComplete="given-name"
          />
        </label>
        <label className="campo">
          <span>{t('editarPerfil.apellidos')}</span>
          <input
            type="text"
            value={apellidos}
            onChange={(e) => setApellidos(e.target.value)}
            maxLength={LIMITES_PERFIL.last_name}
            autoComplete="family-name"
          />
        </label>
      </div>

      <div className="formulario__pareja">
        <label className="campo">
          <span>{t('editarPerfil.nacimiento')}</span>
          <input
            type="date"
            value={nacimiento}
            onChange={(e) => setNacimiento(e.target.value)}
            min={nacimientoMin}
            max={nacimientoMax}
            autoComplete="bday"
          />
        </label>
        <label className="campo">
          <span>{t('editarPerfil.sexo')}</span>
          <Desplegable opciones={opcionesSexo} valor={sexo} onChange={setSexo} />
        </label>
      </div>

      <div className="formulario__pareja">
        <label className="campo">
          <span>{t('editarPerfil.pais')}</span>
          <Desplegable opciones={opcionesPais} valor={pais} onChange={cambiarPais} />
        </label>
        <label className="campo">
          <span>{t('editarPerfil.localizacion')}</span>
          <input
            type="text"
            value={localizacion}
            onChange={(e) => setLocalizacion(e.target.value)}
            maxLength={LIMITES_PERFIL.location}
            placeholder={t('editarPerfil.localizacionPlaceholder')}
            autoComplete="address-level2"
          />
        </label>
      </div>

      <CampoTelefono
        prefijo={telefono.prefijo}
        numero={telefono.numero}
        preferido={pais}
        onChange={setTelefono}
      />

      <h2 className="subtitulo-formulario">{t('privacidad.titulo')}</h2>
      <p className="ayuda-formulario">{t('privacidad.ayuda')}</p>

      <div className="formulario__pareja">
        <label className="campo">
          <span>{t('privacidad.personal')}</span>
          <Desplegable opciones={opcionesVisibilidad} valor={visPersonal} onChange={setVisPersonal} />
        </label>
        <label className="campo">
          <span>{t('privacidad.biblioteca')}</span>
          <Desplegable opciones={opcionesVisibilidad} valor={visBiblioteca} onChange={setVisBiblioteca} />
        </label>
      </div>

      <Mensaje texto={error} />
      <Mensaje tipo="ok" texto={guardado && !hayCambios ? t('editarPerfil.actualizado') : ""} />

      <div className="formulario__acciones">
        <button type="submit" className="btn btn--primario" disabled={ocupado || !hayCambios}>
          {ocupado ? <><Cargando tamano="pequeno" /> {t('comun.guardando')}</> : t('editarPerfil.guardar')}
        </button>
      </div>
    </form>
  )
}

export default EditarPerfil
