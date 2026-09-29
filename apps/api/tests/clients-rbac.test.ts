import { describe,expect,it } from 'vitest'
import { authorize } from '../src/domain/rbac.js'

describe('Phase 4A RBAC',()=>{
  for(const role of ['admin','gerente','compras'] as const)it(`${role} has complete client permissions`,()=>{for(const permission of ['clients:read','clients:create','clients:update','client_addresses:read','client_addresses:update','client_quotes:read','client_quotes:create','client_quotes:delete'] as const)expect(authorize({role},permission)).toBe(true)})
  for(const role of ['supervisor','auditoria'] as const)it(`${role} receives no Phase 4A permissions`,()=>{for(const permission of ['clients:create','client_addresses:update','client_quotes:create','client_quotes:delete'] as const)expect(authorize({role},permission)).toBe(false)})
})
