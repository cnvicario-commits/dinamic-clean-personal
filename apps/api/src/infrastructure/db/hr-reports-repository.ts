import type { Db } from './pool.js'
export function createHrReportsRepository(db: Db) {
  return {
    async bejerman(from:string,to:string) {
      const [employees,assignments,clients,attendance]=await Promise.all([
        db.query('select id,nombre_apellido,legajo,empresa from public.empleados order by nombre_apellido'),
        db.query('select empleado_id,cliente_id from public.asignaciones where fecha_hasta is null'),
        db.query('select id,nombre,codigo_costos from public.clientes'),
        db.query('select empleado_id,fecha,codigo from public.asistencias where fecha >= $1 and fecha <= $2',[from,to]),
      ])
      return {employees:employees.rows,assignments:assignments.rows,clients:clients.rows,attendance:attendance.rows}
    },
    async overtime(from:string,to:string) {
      const [attendance,assignments,clients]=await Promise.all([
        db.query('select a.empleado_id,a.horas_extras,a.cliente_destino_id,a.cliente_horas_extra_id,e.nombre_apellido from public.asistencias a join public.empleados e on e.id=a.empleado_id where a.horas_extras > 0 and a.fecha >= $1 and a.fecha <= $2',[from,to]),
        db.query('select empleado_id,cliente_id from public.asignaciones where fecha_hasta is null'),
        db.query('select id,nombre from public.clientes'),
      ])
      return {attendance:attendance.rows,assignments:assignments.rows,clients:clients.rows}
    },
  }
}
