'use client'

import ClienteDomicilioEstadoBoton from './ClienteDomicilioEstadoBoton'
import MarcarPrincipalBoton from './MarcarPrincipalBoton'
import type { ClienteDomicilio } from '@/types/compras'

export default function ClienteDomiciliosTabla({
  domicilios,
  onEditar,
}: {
  domicilios: ClienteDomicilio[]
  onEditar: (d: ClienteDomicilio) => void
}) {
  if (domicilios.length === 0) {
    return <p className="text-slate-500 text-sm mt-3">Todavía no cargaste ningún domicilio de entrega.</p>
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto mt-4">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
            <th className="px-4 py-3 font-medium">Alias</th>
            <th className="px-4 py-3 font-medium">Dirección</th>
            <th className="px-4 py-3 font-medium">Principal</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {domicilios.map((d) => (
            <tr key={d.id} className={`border-b border-slate-100 last:border-0 ${!d.activo ? 'opacity-50' : ''}`}>
              <td className="px-4 py-3 text-slate-800">{d.alias}</td>
              <td className="px-4 py-3 text-slate-600">{d.direccion}</td>
              <td className="px-4 py-3">
                {d.es_principal ? (
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    Principal
                  </span>
                ) : d.activo ? (
                  <MarcarPrincipalBoton id={d.id} clienteId={d.cliente_id} />
                ) : (
                  '-'
                )}
              </td>
              <td className="px-4 py-3">
                <ClienteDomicilioEstadoBoton id={d.id} activo={d.activo} />
              </td>
              <td className="px-4 py-3">
                <button onClick={() => onEditar(d)} className="text-teal-600 hover:underline text-sm">
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
