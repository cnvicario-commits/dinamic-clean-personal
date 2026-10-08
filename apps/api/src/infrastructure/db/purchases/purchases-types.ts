export type Note = string | null | undefined
export type RequestItem = { articuloId: string; cantidad: number; observaciones?: Note }
export type RequestInput = {
  empresaId: string
  clienteId: string
  observacionesGenerales?: Note
  lugarEnvioDomicilioId?: string | null | undefined
  lugarEnvioEmpresa?: boolean | undefined
  lugarEnvioTexto?: Note
  lugarEnvioAlias?: Note
  estado?: 'borrador' | 'enviada' | undefined
  items: RequestItem[]
}
export type OrderItem = RequestItem & { precioUnitario: number }
export type OrderInput = {
  empresaId: string
  proveedorId: string
  clienteId: string
  observacionesGenerales?: Note
  lugarEnvioTexto?: Note
  lugarEnvioAlias?: Note
  condicionPago?: Note
  horarioAtencionTexto?: Note
  items: OrderItem[]
}
export type Assignment = {
  pedidoCompraItemId: string
  destino: 'proveedor' | 'deposito' | 'proveedor_deposito'
  proveedorId?: string | null | undefined
  cantidad: number
  precioUnitario?: number | null | undefined
  observaciones?: Note
}
export type AssignInput = {
  lugarEnvioTexto?: Note
  lugarEnvioAlias?: Note
  horarioAtencionTexto?: Note
  items: Assignment[]
}
export type ImportInput = {
  empresaId: string
  orders: Array<{
    clienteId: string
    clienteDomicilioId?: string | null | undefined
    lugarEnvioTexto?: Note
    lugarEnvioAlias?: Note
    items: RequestItem[]
  }>
}
