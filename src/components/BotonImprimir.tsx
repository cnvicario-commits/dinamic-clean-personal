'use client'

export default function BotonImprimir({ nombreArchivo }: { nombreArchivo?: string }) {
  function handleClick() {
    // El navegador usa document.title como nombre sugerido al "Guardar como PDF"
    // desde el diálogo de impresión. Lo cambiamos justo antes de imprimir y lo
    // restauramos al cerrar el diálogo para no dejar la pestaña con ese título.
    if (nombreArchivo) {
      const tituloOriginal = document.title
      document.title = nombreArchivo
      const restaurar = () => {
        document.title = tituloOriginal
        window.removeEventListener('afterprint', restaurar)
      }
      window.addEventListener('afterprint', restaurar)
    }
    window.print()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="print:hidden px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
    >
      Imprimir
    </button>
  )
}
