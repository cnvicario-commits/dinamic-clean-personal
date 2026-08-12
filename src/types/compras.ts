// Tipos compartidos del módulo de Compras (Empresas, Pedido de compra,
// Panel de compras, Órdenes de compra, Pedidos a depósito).
//
// A diferencia del resto de la app (que duplica tipos locales por
// componente), acá se centralizan porque son 7 tablas muy relacionadas y
// usadas por muchos componentes distintos.

export type EstadoPedidoCompra = 'borrador' | 'enviada'
export type EstadoOrdenCompra = 'borrador' | 'enviada' | 'recepcionada'
export type EstadoPedidoDeposito = 'borrador' | 'enviada' | 'recepcionada'

export type Empresa = {
  id: string
  nombre: string
  cuit: string
  domicilio: string | null
  activo: boolean
}

// Recortes livianos de tablas que ya existen en otros módulos — no se tocan
// los archivos originales, solo se declaran acá los campos que usa Compras.
export type EmpresaResumen = { id: string; nombre: string }
export type EmpresaConDomicilio = EmpresaResumen & { domicilio: string | null }
export type ClienteResumen = { id: string; nombre: string }

// Domicilios de entrega del cliente (tabla cliente_domicilios), usados para
// elegir el "Lugar de envío" de una orden de compra.
export type ClienteDomicilio = {
  id: string
  cliente_id: string
  alias: string
  direccion: string
  es_principal: boolean
  activo: boolean
}
export type ArticuloResumen = {
  id: string
  codigo_interno: string
  nombre: string
  unidad: string | null
  categoria: string | null
  proveedor_habitual_id: string | null
}
export type ProveedorResumen = { id: string; razon_social: string }

export type PedidoCompra = {
  id: string
  numero_pedido: string
  empresa_id: string
  cliente_id: string
  observaciones_generales: string | null
  lugar_envio_domicilio_id: string | null // referencia viva a cliente_domicilios (no un texto congelado)
  lugar_envio_empresa: boolean // true = usar el domicilio de la empresa en vez de un domicilio del cliente
  lugar_envio_texto: string | null // texto de la dirección elegida al guardar, no una referencia (igual que en OC)
  lugar_envio_alias: string | null // alias del domicilio (o nombre de empresa) elegido al guardar, congelado igual que el texto
  estado: EstadoPedidoCompra
  creado_por: string
  created_at: string
  updated_at: string
}
export type PedidoCompraItem = {
  id: string
  pedido_id: string
  articulo_id: string
  cantidad: number
  observaciones: string | null
  descartada: boolean
  motivo_descarte: string | null
}

export type OrdenCompra = {
  id: string
  numero_oc: string
  empresa_id: string
  proveedor_id: string
  cliente_id: string
  pedido_id: string | null // pedido de compra de origen (null si es una OC independiente/duplicada)
  fecha: string
  observaciones_generales: string | null
  lugar_envio_texto: string | null // texto de la dirección elegida al crear la OC, no una referencia
  lugar_envio_alias: string | null // alias del domicilio (o nombre de empresa) elegido, congelado igual que el texto
  estado: EstadoOrdenCompra
  creado_por: string
  created_at: string
  updated_at: string
}
export type OrdenCompraItem = {
  id: string
  oc_id: string
  pedido_compra_item_id: string | null
  articulo_id: string
  cantidad: number
  precio_unitario: number
  observaciones: string | null
}

export type PedidoDeposito = {
  id: string
  numero_pedido_deposito: string
  empresa_id: string
  cliente_id: string
  pedido_id: string | null // pedido de compra de origen (null si es un pedido independiente/duplicado)
  fecha: string
  observaciones_generales: string | null
  estado: EstadoPedidoDeposito
  creado_por: string
  created_at: string
  updated_at: string
}
export type PedidoDepositoItem = {
  id: string
  pedido_deposito_id: string
  pedido_compra_item_id: string | null
  articulo_id: string
  cantidad: number
  observaciones: string | null
}

// --- Tipos "vista" (con joins), tal como los traen los Server Components ---

export type PedidoCompraListado = PedidoCompra & {
  empresas: { nombre: string } | null
  clientes: { nombre: string } | null
}

// Vista del listado del Panel de compras: agrega el estado calculado
// pendiente/procesado (no es una columna real, se calcula agregando
// pedidos_compra_items + ordenes_compra_items + pedidos_deposito_items).
export type PedidoEnviado = PedidoCompraListado & { procesado: boolean }
export type PedidoCompraItemConArticulo = PedidoCompraItem & { articulos: ArticuloResumen | null }
export type PedidoCompraDetalleView = PedidoCompra & {
  empresas: Empresa | null
  clientes: ClienteResumen | null
  cliente_domicilios: { alias: string; direccion: string } | null
  pedidos_compra_items: PedidoCompraItemConArticulo[]
}

// Línea del pedido enriquecida con lo ya asignado, usada SOLO en el Panel de compras.
export type LineaPendiente = PedidoCompraItemConArticulo & {
  cantidad_asignada_oc: number
  cantidad_asignada_deposito: number
  cantidad_pendiente: number
}

export type OrdenCompraItemConArticulo = OrdenCompraItem & { articulos: ArticuloResumen | null }
export type OrdenCompraListado = OrdenCompra & {
  empresas: { nombre: string } | null
  proveedores: { razon_social: string } | null
  clientes: { nombre: string } | null
}
export type OrdenCompraDetalleView = OrdenCompra & {
  empresas: Empresa | null
  proveedores: ProveedorResumen | null
  clientes: ClienteResumen | null
  ordenes_compra_items: OrdenCompraItemConArticulo[]
}

export type PedidoDepositoItemConArticulo = PedidoDepositoItem & { articulos: ArticuloResumen | null }
export type PedidoDepositoListado = PedidoDeposito & {
  empresas: { nombre: string } | null
  clientes: { nombre: string } | null
}
export type PedidoDepositoDetalleView = PedidoDeposito & {
  empresas: Empresa | null
  clientes: ClienteResumen | null
  pedidos_deposito_items: PedidoDepositoItemConArticulo[]
}

// Estado local (en memoria, NO persistido hasta "Confirmar") del Panel de compras.
//
// 'proveedor'           -> solo OC (el proveedor entrega directo al cliente).
// 'deposito'            -> solo pedido a depósito (ya hay stock).
// 'proveedor_deposito'  -> genera AMBOS a la vez, sin relación ni bloqueo entre
//                          sí: una línea de OC al proveedor (el proveedor entrega
//                          en nuestro depósito) y una línea en el pedido a
//                          depósito (para armar el envío al cliente).
export type DestinoAsignacion = 'proveedor' | 'deposito' | 'proveedor_deposito'

export type AsignacionPendiente = {
  clave: string // solo para key de React y para poder "quitar" la fila
  pedidoCompraItemId: string
  articulo: ArticuloResumen
  cantidad: number
  destino: DestinoAsignacion
  proveedorId: string | null // null si destino === 'deposito'
  proveedorNombre: string | null
  precioUnitario: number | null // null si destino === 'deposito'
  observaciones: string
}
