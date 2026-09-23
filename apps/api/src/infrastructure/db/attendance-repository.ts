import type { Db } from './pool.js'
import type { AttendanceQuery, AttendanceUpsert } from '../../http/schemas/attendance.js'

export function createAttendanceRepository(db: Db) {
  type Row = { id:string; empleado_id:string; fecha:string; codigo:string; horas_extras:number; cargado_por:string|null; created_at:string; observaciones:string|null; archivo_url:string|null; cliente_destino_id:string|null; cliente_horas_extra_id:string|null; empleado_nombre?:string|null }
  return {
    async list(q: AttendanceQuery) {
      const where:string[]=[]; const params:unknown[]=[]
      if(q.empleadoId){params.push(q.empleadoId);where.push(`a.empleado_id=$${params.length}`)}
      if(q.desde){params.push(q.desde);where.push(`a.fecha >= $${params.length}`)}
      if(q.hasta){params.push(q.hasta);where.push(`a.fecha <= $${params.length}`)}
      const clause=where.length?`where ${where.join(' and ')}`:''; const count=await db.query<{count:string}>(`select count(*)::text count from public.asistencias a ${clause}`,params)
      params.push((q.page-1)*q.pageSize,q.pageSize)
      const rows=await db.query<Row>(`select a.id,a.empleado_id,a.fecha,a.codigo,a.horas_extras,a.cargado_por,a.created_at,a.observaciones,a.archivo_url,a.cliente_destino_id,a.cliente_horas_extra_id,e.nombre_apellido empleado_nombre from public.asistencias a join public.empleados e on e.id=a.empleado_id ${clause} order by a.fecha desc,a.id desc offset $${params.length-1} limit $${params.length}`,params)
      return {items:rows.rows.map(map),page:q.page,pageSize:q.pageSize,total:Number(count.rows[0]?.count??0)}
    },
    async upsert(input:AttendanceUpsert,userId:string){
      const r=await db.query<Row>(`insert into public.asistencias (empleado_id,fecha,codigo,horas_extras,cargado_por,observaciones,archivo_url,cliente_destino_id,cliente_horas_extra_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (empleado_id,fecha) do update set codigo=excluded.codigo,horas_extras=excluded.horas_extras,cargado_por=excluded.cargado_por,observaciones=excluded.observaciones,archivo_url=excluded.archivo_url,cliente_destino_id=excluded.cliente_destino_id,cliente_horas_extra_id=excluded.cliente_horas_extra_id returning *, (select nombre_apellido from public.empleados where id=asistencias.empleado_id) empleado_nombre`,[input.empleadoId,input.fecha,input.codigo,input.horasExtras,userId,input.observaciones??null,input.archivoUrl??null,input.clienteDestinoId??null,input.clienteHorasExtraId??null])
      if (!r.rows[0]) throw new Error('Attendance upsert returned no row')
      return map(r.rows[0])
    },
    async listCodes(){
      const r=await db.query<{codigo:string;descripcion:string;codigo_bejerman:string|null;cuenta_como_ausencia:boolean}>('select codigo, descripcion, codigo_bejerman, cuenta_como_ausencia from public.codigos_novedad order by codigo asc')
      return r.rows.map((x)=>({codigo:x.codigo,descripcion:x.descripcion,codigoBejerman:x.codigo_bejerman??null,cuentaComoAusencia:Boolean(x.cuenta_como_ausencia)}))
    },
  }
}
function map(r: {id:string;empleado_id:string;fecha:string;codigo:string;horas_extras:number;cargado_por:string|null;created_at:string;observaciones:string|null;archivo_url:string|null;cliente_destino_id:string|null;cliente_horas_extra_id:string|null;empleado_nombre?:string|null}){return {id:r.id,empleadoId:r.empleado_id,fecha:String(r.fecha),codigo:r.codigo,horasExtras:Number(r.horas_extras),cargadoPor:r.cargado_por,createdAt:r.created_at,observaciones:r.observaciones,archivoUrl:r.archivo_url,clienteDestinoId:r.cliente_destino_id,clienteHorasExtraId:r.cliente_horas_extra_id,empleadoNombre:r.empleado_nombre??null}}
