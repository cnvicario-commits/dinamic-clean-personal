import { z } from 'zod'
import { uuid, idempotencyKey } from './catalog.js'
export { idempotencyKey, uuid }
const state=z.enum(['borrador','enviada','recepcionada'])
const note=z.string().trim().max(2000).nullable().optional()
const requestItem=z.object({articuloId:uuid,cantidad:z.number().finite().positive(),observaciones:note}).strict()
export const purchaseRequest=z.object({empresaId:uuid,clienteId:uuid,observacionesGenerales:note,lugarEnvioDomicilioId:uuid.nullable().optional(),lugarEnvioEmpresa:z.boolean().optional(),lugarEnvioTexto:note,lugarEnvioAlias:note,estado:z.enum(['borrador','enviada']).optional(),items:z.array(requestItem).min(1).max(500)}).strict()
export const transition=z.object({estado:state}).strict()
export const discard=z.object({descartada:z.boolean(),motivo:note}).strict()
const assignment=z.object({pedidoCompraItemId:uuid,destino:z.enum(['proveedor','deposito','proveedor_deposito']),proveedorId:uuid.nullable().optional(),cantidad:z.number().finite().positive(),precioUnitario:z.number().finite().positive().nullable().optional(),observaciones:note}).strict().superRefine((x,c)=>{if(x.destino!=='deposito'&&!x.proveedorId)c.addIssue({code:'custom',message:'Supplier is required'});if(x.destino!=='deposito'&&!x.precioUnitario)c.addIssue({code:'custom',message:'Price is required'})})
export const assignments=z.object({lugarEnvioTexto:note,lugarEnvioAlias:note,horarioAtencionTexto:note,items:z.array(assignment).min(1).max(500)}).strict()
const orderItem=z.object({articuloId:uuid,cantidad:z.number().finite().positive(),precioUnitario:z.number().finite().positive(),observaciones:note}).strict()
export const purchaseOrder=z.object({empresaId:uuid,proveedorId:uuid,clienteId:uuid,observacionesGenerales:note,lugarEnvioTexto:note,lugarEnvioAlias:note,condicionPago:note,horarioAtencionTexto:note,items:z.array(orderItem).min(1).max(500)}).strict()
export const importBody=z.object({empresaId:uuid,orders:z.array(z.object({clienteId:uuid,clienteDomicilioId:uuid.nullable().optional(),lugarEnvioTexto:note,lugarEnvioAlias:note,items:z.array(requestItem).min(1).max(500)}).strict()).min(1).max(500)}).strict()
