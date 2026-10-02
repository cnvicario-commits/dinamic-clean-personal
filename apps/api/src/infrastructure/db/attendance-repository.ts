import type { Db } from './pool.js'
import type { AttendanceQuery, AttendanceUpsert } from '../../http/schemas/attendance.js'
import { notFound } from '../../http/errors/app-error.js'

type Row = {
  id: string
  empleado_id: string
  fecha: string
  codigo: string
  horas_extras: number
  cargado_por: string | null
  created_at: string
  observaciones: string | null
  archivo_url: string | null
  archivo_storage_path: string | null
  cliente_destino_id: string | null
  cliente_horas_extra_id: string | null
  empleado_nombre?: string | null
}

export type AttendanceRecord = {
  id: string
  empleadoId: string
  fecha: string
  codigo: string
  horasExtras: number
  cargadoPor: string | null
  createdAt: string
  observaciones: string | null
  hasJustification: boolean
  clienteDestinoId: string | null
  clienteHorasExtraId: string | null
  empleadoNombre: string | null
}

export type AttendanceJustificationRow = {
  id: string
  empleadoId: string
  archivoUrl: string | null
  archivoStoragePath: string | null
}

export type AttendanceRepository = ReturnType<typeof createAttendanceRepository>

export function createAttendanceRepository(db: Db) {
  return {
    async list(q: AttendanceQuery) {
      const where: string[] = []
      const params: unknown[] = []
      if (q.empleadoId) {
        params.push(q.empleadoId)
        where.push(`a.empleado_id=$${params.length}`)
      }
      if (q.desde) {
        params.push(q.desde)
        where.push(`a.fecha >= $${params.length}`)
      }
      if (q.hasta) {
        params.push(q.hasta)
        where.push(`a.fecha <= $${params.length}`)
      }
      const clause = where.length ? `where ${where.join(' and ')}` : ''
      const count = await db.query<{ count: string }>(
        `select count(*)::text count from public.asistencias a ${clause}`,
        params,
      )
      params.push((q.page - 1) * q.pageSize, q.pageSize)
      const rows = await db.query<Row>(
        `select a.id,a.empleado_id,a.fecha,a.codigo,a.horas_extras,a.cargado_por,a.created_at,a.observaciones,a.archivo_url,a.archivo_storage_path,a.cliente_destino_id,a.cliente_horas_extra_id,e.nombre_apellido empleado_nombre from public.asistencias a join public.empleados e on e.id=a.empleado_id ${clause} order by a.fecha desc,a.id desc offset $${params.length - 1} limit $${params.length}`,
        params,
      )
      return {
        items: rows.rows.map(map),
        page: q.page,
        pageSize: q.pageSize,
        total: Number(count.rows[0]?.count ?? 0),
      }
    },
    async upsert(input: AttendanceUpsert, userId: string) {
      const r = await db.query<Row>(
        `insert into public.asistencias (empleado_id,fecha,codigo,horas_extras,cargado_por,observaciones,archivo_url,archivo_storage_path,cliente_destino_id,cliente_horas_extra_id) values ($1,$2,$3,$4,$5,$6,null,null,$7,$8) on conflict (empleado_id,fecha) do update set codigo=excluded.codigo,horas_extras=excluded.horas_extras,cargado_por=excluded.cargado_por,observaciones=excluded.observaciones,cliente_destino_id=excluded.cliente_destino_id,cliente_horas_extra_id=excluded.cliente_horas_extra_id returning *, (select nombre_apellido from public.empleados where id=asistencias.empleado_id) empleado_nombre`,
        [
          input.empleadoId,
          input.fecha,
          input.codigo,
          input.horasExtras,
          userId,
          input.observaciones ?? null,
          input.clienteDestinoId ?? null,
          input.clienteHorasExtraId ?? null,
        ],
      )
      if (!r.rows[0]) throw new Error('Attendance upsert returned no row')
      return map(r.rows[0])
    },
    async listCodes() {
      const r = await db.query<{
        codigo: string
        descripcion: string
        codigo_bejerman: string | null
        cuenta_como_ausencia: boolean
      }>(
        'select codigo, descripcion, codigo_bejerman, cuenta_como_ausencia from public.codigos_novedad order by codigo asc',
      )
      return r.rows.map((x) => ({
        codigo: x.codigo,
        descripcion: x.descripcion,
        codigoBejerman: x.codigo_bejerman ?? null,
        cuentaComoAusencia: Boolean(x.cuenta_como_ausencia),
      }))
    },
    async getById(id: string): Promise<AttendanceJustificationRow> {
      const r = await db.query<{
        id: string
        empleado_id: string
        archivo_url: string | null
        archivo_storage_path: string | null
      }>(
        'select id, empleado_id, archivo_url, archivo_storage_path from public.asistencias where id=$1',
        [id],
      )
      if (!r.rows[0]) throw notFound('Attendance record not found')
      const row = r.rows[0]
      return {
        id: row.id,
        empleadoId: row.empleado_id,
        archivoUrl: row.archivo_url,
        archivoStoragePath: row.archivo_storage_path,
      }
    },
    async setJustificationStoragePath(id: string, storagePath: string) {
      const r = await db.query(
        `update public.asistencias set archivo_storage_path=$2, archivo_url=null where id=$1`,
        [id, storagePath],
      )
      if (r.rowCount !== 1) throw notFound('Attendance record not found')
    },
    async clearJustification(id: string) {
      const r = await db.query<{
        archivo_url: string | null
        archivo_storage_path: string | null
      }>(
        `update public.asistencias t
         set archivo_storage_path = null, archivo_url = null
         from (
           select id, archivo_url as prev_url, archivo_storage_path as prev_path
           from public.asistencias
           where id = $1
         ) as prev
         where t.id = prev.id
         returning prev.prev_url as archivo_url, prev.prev_path as archivo_storage_path`,
        [id],
      )
      if (!r.rows[0]) throw notFound('Attendance record not found')
      return {
        archivoUrl: r.rows[0].archivo_url,
        archivoStoragePath: r.rows[0].archivo_storage_path,
      }
    },
    async restoreJustification(
      id: string,
      input: { storagePath: string | null; archivoUrl: string | null },
    ) {
      const r = await db.query(
        `update public.asistencias set archivo_storage_path=$2, archivo_url=$3 where id=$1`,
        [id, input.storagePath, input.archivoUrl],
      )
      if (r.rowCount !== 1) throw notFound('Attendance record not found')
    },
  }
}

function map(r: Row): AttendanceRecord {
  return {
    id: r.id,
    empleadoId: r.empleado_id,
    fecha: String(r.fecha),
    codigo: r.codigo,
    horasExtras: Number(r.horas_extras),
    cargadoPor: r.cargado_por,
    createdAt: r.created_at,
    observaciones: r.observaciones,
    hasJustification: Boolean(r.archivo_storage_path || r.archivo_url),
    clienteDestinoId: r.cliente_destino_id,
    clienteHorasExtraId: r.cliente_horas_extra_id,
    empleadoNombre: r.empleado_nombre ?? null,
  }
}
