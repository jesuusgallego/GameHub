// Aviso de que algo no se ve porque su dueño lo ha limitado: un candado y el motivo. Lo
// usan las partes del perfil de otra persona que no comparte (biblioteca, amigos...).
//  - texto: lo que se explica
function AvisoPrivado({ texto }) {
  return (
    <div className="aviso-privado">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <p>{texto}</p>
    </div>
  )
}

export default AvisoPrivado
