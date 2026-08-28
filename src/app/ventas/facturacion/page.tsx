import { createClient } from '@/utils/supabase/server'
import NovedadesFacturacionTabla from '@/components/NovedadesFacturacionTabla'
import type { OportunidadListado } from '@/types/crm'

// Puramente informativa: avisa de altas nuevas para pasarle al área de
// facturación ("a este cliente hay que empezarlo a facturar"), no lleva
// control de la facturación recurrente de clientes ya activos.
export default async function FacturacionVentasPage() {
  const supabase = await createClient()

  const { data: oportunidades } = await supabase
    .from('crm_oportunidades')
    .select(
      '*, crm_prospectos(id, nombre, tipo_cliente_id, contacto_nombre, telefono, email, referido_por_id, crm_tipos_cliente(nombre), crm_referidores(nombre)), crm_tipos_servicio(nombre), perfiles(nombre_completo)'
    )
    .eq('estado', 'aceptado')
    .not('fecha_facturacion', 'is', null)
    .order('fecha_facturacion', { ascending: true })

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Novedades de Facturación</h1>
      <NovedadesFacturacionTabla oportunidades={(oportunidades ?? []) as unknown as OportunidadListado[]} />
    </div>
  )
}
