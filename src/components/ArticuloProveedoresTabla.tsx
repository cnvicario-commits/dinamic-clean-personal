type Vinculo = {
  id: string
  codigo_proveedor: string | null
  nombre_proveedor: string | null
  precio: number
  fecha_actualizacion: string
  activo: boolean
  proveedores: { id: string; razon_social: string } | null
}

export default function ArticuloProveedoresTabla({ vinculos }: { vinculos: Vinculo[] }) {
  const precioMinimo = vinculos.length > 0 ? Math.min(...vinculos.map((v) => v.precio)) : null

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
            <th className="px-4 py-3 font-medium">Proveedor</th>
            <th className="px-4 py-3 font-medium">Código proveedor</th>
            <th className="px-4 py-3 font-medium">Descripción proveedor</th>
            <th className="px-4 py-3 font-medium">Precio</th>
            <th className="px-4 py-3 font-medium">Actualizado</th>
            <th className="px-4 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {vinculos.map((v) => (
            <tr key={v.id} className={`border-b border-slate-100 last:border-0 ${!v.activo ? 'opacity-50' : ''}`}>
              <td className="px-4 py-3 text-slate-800">{v.proveedores?.razon_social ?? '-'}</td>
              <td className="px-4 py-3 text-slate-600">{v.codigo_proveedor || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{v.nombre_proveedor ?? '-'}</td>
              <td className="px-4 py-3">
                <span className={`font-medium ${v.precio === precioMinimo ? 'text-emerald-600' : 'text-slate-700'}`}>
                  ${v.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {new Date(v.fecha_actualizacion).toLocaleDateString('es-AR')}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                  v.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {v.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {vinculos.length === 0 && (
        <p className="text-slate-500 text-sm p-4">Ningún proveedor tiene cargado este artículo todavía.</p>
      )}
    </div>
  )
}
