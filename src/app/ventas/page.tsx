import { createClient } from '@/utils/supabase/server'
import TableroVentas from '@/components/TableroVentas'
import PanelNovedades, { type ItemNovedad } from '@/components/PanelNovedades'
import { calcularNovedades } from '@/utils/novedades'
import { nombreUsuarioSeguimiento, type OportunidadVista } from '@/types/crm'
import type { SeguimientoParaNovedad } from '@/utils/novedades'

export default async function VentasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: oportunidades }, { data: responsables }, { data: tiposCliente }, { data: seguimientos }, { data: vistas }] =
    await Promise.all([
      supabase
        .from('crm_oportunidades')
        .select(
          '*, crm_prospectos(id, nombre, tipo_cliente_id, contacto_nombre, telefono), crm_tipos_servicio(nombre), perfiles(nombre_completo)'
        )
        .order('created_at', { ascending: false }),
      supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
      supabase.from('crm_tipos_cliente').select('id, nombre').eq('activo', true).order('nombre'),
      // Solo los campos que usa calcularNovedades, no todo crm_seguimientos.*.
      supabase
        .from('crm_seguimientos')
        .select('oportunidad_id, usuario_id, usuario_nombre_libre, tipo_contacto, nota, created_at, perfiles(nombre_completo)'),
      user
        ? supabase.from('crm_vistas').select('oportunidad_id, last_viewed_at').eq('usuario_id', user.id)
        : Promise.resolve({ data: [] as { oportunidad_id: string; last_viewed_at: string }[] }),
    ])

  // Ver src/utils/novedades.ts: cuenta cualquier seguimiento cargado a mano
  // (sea quien sea) después de la última vez que este usuario vio esa ficha.
  const novedades = user
    ? calcularNovedades({
        seguimientos: (seguimientos ?? []) as unknown as SeguimientoParaNovedad[],
        vistas: vistas ?? [],
      })
    : new Map()

  const oportunidadesPorId = new Map((oportunidades ?? []).map((o) => [o.id, o]))
  const itemsNovedades: ItemNovedad[] = [...novedades.values()]
    .map((n) => {
      const oportunidad = oportunidadesPorId.get(n.oportunidadId)
      if (!oportunidad) return null
      return {
        oportunidadId: n.oportunidadId,
        prospectoNombre: oportunidad.crm_prospectos?.nombre ?? '-',
        cantidad: n.cantidad,
        usuario: nombreUsuarioSeguimiento(n.ultimo),
        creadoEn: n.ultimo.created_at,
      }
    })
    .filter((item): item is ItemNovedad => item !== null)
    .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Ventas</h1>
      <PanelNovedades items={itemsNovedades} />
      <TableroVentas
        oportunidades={(oportunidades ?? []) as unknown as OportunidadVista[]}
        responsables={responsables ?? []}
        tiposCliente={tiposCliente ?? []}
        novedadesIds={[...novedades.keys()]}
      />
    </div>
  )
}
