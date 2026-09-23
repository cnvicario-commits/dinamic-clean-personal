import { describe, expect, it, vi } from 'vitest'
import { createAttendanceRepository } from '../src/infrastructure/db/attendance-repository.js'
describe('attendance repository',()=>{
  it('lists with count, parameterized filters, ordering and camel-case mapping',async()=>{
    const query=vi.fn().mockResolvedValueOnce({rows:[{count:'1'}]}).mockResolvedValueOnce({rows:[{id:'i',empleado_id:'e',fecha:'2026-09-01',codigo:'P',horas_extras:2,cargado_por:null,created_at:'x',observaciones:null,archivo_url:null,cliente_destino_id:null,cliente_horas_extra_id:null,empleado_nombre:'Ana'}]});const repo=createAttendanceRepository({query} as never);const out=await repo.list({page:2,pageSize:25,empleadoId:'e',desde:'2026-09-01',hasta:'2026-09-30'});expect(out.total).toBe(1);expect(out.items[0]?.empleadoNombre).toBe('Ana');const [sql,params]=query.mock.calls[1];expect(String(sql)).toContain('order by a.fecha desc,a.id desc');expect(params).toContain(25);expect(params).toContain('e')
  })
  it('upserts by employee/date with actor and rejects missing result',async()=>{
    const query=vi.fn().mockResolvedValue({rows:[]});const repo=createAttendanceRepository({query} as never);await expect(repo.upsert({empleadoId:'e',fecha:'2026-09-01',codigo:'P',horasExtras:0},'actor')).rejects.toThrow('no row');expect(String(query.mock.calls[0][0])).toContain('on conflict (empleado_id,fecha)');expect(query.mock.calls[0][1]).toContain('actor')
  })
})
