import { useIdioma } from './IdiomaContext'

// Lo que tiene que cumplir una contraseña nueva. Son las mismas reglas que
// passwordRegex (y que valida el backend), una por una para poder enseñar cuáles
// cumple ya la que se está escribiendo.
const REQUISITOS = [
  { id: 'longitud', texto: 'password.req.longitud', cumple: (v) => v.length >= 8 },
  { id: 'mayuscula', texto: 'password.req.mayuscula', cumple: (v) => /[A-Z]/.test(v) },
  { id: 'minuscula', texto: 'password.req.minuscula', cumple: (v) => /[a-z]/.test(v) },
  { id: 'numero', texto: 'password.req.numero', cumple: (v) => /\d/.test(v) },
]

// Lista de requisitos de la contraseña nueva: cada uno se marca con un tic cuando se
// cumple, y una barra de fuerza se llena según cuántos van. Solo es una guía: la
// validación de verdad la hace passwordRegex al enviar y, después, el backend.
function RequisitosContrasena({ valor }) {
  const { t } = useIdioma()
  const cumplidos = REQUISITOS.filter((r) => r.cumple(valor)).length

  return (
    <div className="requisitos">
      {/* data-fuerza (0 a 4) hace que el CSS pinte la barra de un color u otro */}
      <div className="fuerza" data-fuerza={cumplidos} aria-hidden="true">
        <span className="fuerza__relleno" style={{ '--p': cumplidos / REQUISITOS.length }} />
      </div>
      <ul className="requisitos__lista" aria-label={t('password.req.titulo')}>
        {REQUISITOS.map((r) => {
          const cumple = r.cumple(valor)
          return (
            <li key={r.id} className={cumple ? "requisito requisito--ok" : "requisito"}>
              <span className="requisito__marca" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 5 5 9-10" />
                </svg>
              </span>
              {t(r.texto)}
              <span className="sr-only">{cumple ? t('password.req.cumplido') : t('password.req.pendiente')}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default RequisitosContrasena
