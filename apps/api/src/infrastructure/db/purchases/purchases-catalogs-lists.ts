import type { Db } from '../pool.js'

export function createPurchasesCatalogsAndLists(db: Db) {
  const catalogs = () =>
    Promise.all([
      db.query(
        'select id,nombre,cuit,domicilio,activo from public.empresas where activo=true order by nombre',
      ),
      db.query('select id,nombre from public.clientes order by nombre'),
      db.query(
        'select id,codigo_interno,nombre,unidad,categoria,proveedor_habitual_id from public.articulos where activo=true order by nombre',
      ),
      db.query(
        'select id,cliente_id,alias,direccion,es_principal,activo,horario_atencion from public.cliente_domicilios where activo=true order by alias',
      ),
      db.query(
        'select id,razon_social,domicilio,provincia,condicion_pago_default from public.proveedores where activo=true order by razon_social',
      ),
      db.query(
        'select articulo_id,proveedor_id,precio from public.articulos_proveedor where activo=true',
      ),
    ]).then(([a, b, c, d, e, f]) => ({
      empresas: a.rows,
      clientes: b.rows,
      articulos: c.rows,
      domicilios: d.rows,
      proveedores: e.rows,
      preciosProveedor: f.rows,
    }))

  const listRequests = () =>
    db
      .query(
        `select h.*,jsonb_build_object('nombre',e.nombre) empresas,jsonb_build_object('nombre',cl.nombre) clientes,
p.nombre_completo creado_por_nombre,
case when exists(select 1 from public.pedidos_compra_items i where i.pedido_id=h.id) then not exists(
select 1 from public.pedidos_compra_items i where i.pedido_id=h.id and not i.descartada and i.cantidad>coalesce((
select sum(x.cantidad) from (
select cantidad from public.ordenes_compra_items where pedido_compra_item_id=i.id
union all select cantidad from public.pedidos_deposito_items where pedido_compra_item_id=i.id
)x),0)) else false end procesado
from public.pedidos_compra h join public.empresas e on e.id=h.empresa_id join public.clientes cl on cl.id=h.cliente_id
left join public.perfiles p on p.id=h.creado_por order by h.created_at desc`,
      )
      .then((r) => r.rows)

  const listOrders = () =>
    db
      .query(
        `select h.*,jsonb_build_object('nombre',e.nombre) empresas,jsonb_build_object('nombre',cl.nombre) clientes,
jsonb_build_object('razon_social',p.razon_social) proveedores
from public.ordenes_compra h join public.empresas e on e.id=h.empresa_id join public.clientes cl on cl.id=h.cliente_id
join public.proveedores p on p.id=h.proveedor_id order by h.created_at desc`,
      )
      .then((r) => r.rows)

  const listWarehouses = () =>
    db
      .query(
        `select h.*,jsonb_build_object('nombre',e.nombre) empresas,jsonb_build_object('nombre',cl.nombre) clientes,
p.nombre_completo creado_por_nombre
from public.pedidos_deposito h join public.empresas e on e.id=h.empresa_id join public.clientes cl on cl.id=h.cliente_id
left join public.perfiles p on p.id=h.creado_por order by h.created_at desc`,
      )
      .then((r) => r.rows)

  return { catalogs, listRequests, listOrders, listWarehouses }
}
