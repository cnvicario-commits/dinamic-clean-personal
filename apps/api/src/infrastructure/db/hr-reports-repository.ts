import type { Db } from './pool.js'
export function createHrReportsRepository(db: Db) {
  return {
    async bejerman(from:string,to:string) {
      const [employees,assignments,clients,attendance]=await Promise.all([
        db.query('select id,nombre_apellido,legajo,empresa from public.empleados order by nombre_apellido'),
        db.query('select empleado_id,cliente_id from public.asignaciones where fecha_hasta is null'),
        db.query(`select c.id,c.nombre,c.codigo_costos from public.clientes c
          where exists (select 1 from public.asignaciones a where a.cliente_id=c.id and a.fecha_hasta is null)`),
        db.query('select empleado_id,fecha,codigo from public.asistencias where fecha >= $1 and fecha <= $2',[from,to]),
      ])
      return {employees:employees.rows,assignments:assignments.rows,clients:clients.rows,attendance:attendance.rows}
    },
    async overtime(from:string,to:string) {
      const [attendance,assignments,clients]=await Promise.all([
        db.query(
          `select a.empleado_id,a.horas_extras,a.cliente_destino_id,a.cliente_horas_extra_id,e.nombre_apellido
from public.asistencias a join public.empleados e on e.id=a.empleado_id
where a.horas_extras > 0 and a.fecha >= $1 and a.fecha <= $2`,
          [from, to],
        ),
        db.query(`select empleado_id,cliente_id from public.asignaciones
          where fecha_hasta is null
          and empleado_id in (
            select distinct empleado_id from public.asistencias
            where horas_extras > 0 and fecha >= $1 and fecha <= $2
          )`,[from,to]),
        db.query(`select id,nombre from public.clientes where id in (
          select distinct cliente_id from public.asignaciones
          where fecha_hasta is null
          and empleado_id in (
            select distinct empleado_id from public.asistencias
            where horas_extras > 0 and fecha >= $1 and fecha <= $2
          )
          union
          select distinct cliente_destino_id from public.asistencias
          where horas_extras > 0 and fecha >= $1 and fecha <= $2 and cliente_destino_id is not null
          union
          select distinct cliente_horas_extra_id from public.asistencias
          where horas_extras > 0 and fecha >= $1 and fecha <= $2 and cliente_horas_extra_id is not null
        )`,[from,to]),
      ])
      return {attendance:attendance.rows,assignments:assignments.rows,clients:clients.rows}
    },
  }
}
