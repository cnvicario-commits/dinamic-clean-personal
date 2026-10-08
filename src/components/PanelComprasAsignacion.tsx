"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthenticatedBrowserApiClient } from "@/lib/api/browser";
import type {
  AsignacionPendiente,
  DestinoAsignacion,
  LineaPendiente,
  ProveedorResumen,
  ClienteDomicilio,
} from "@/types/compras";

const inputStyle =
  "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

type PrecioProveedor = { articulo_id: string; proveedor_id: string; precio: number };

function requiereProveedor(destino: DestinoAsignacion) {
  return destino === "proveedor" || destino === "proveedor_deposito";
}

function LineaAsignacionForm({
  linea,
  pendienteRestante,
  proveedores,
  preciosProveedor,
  onAgregar,
}: {
  linea: LineaPendiente;
  pendienteRestante: number;
  proveedores: ProveedorResumen[];
  preciosProveedor: PrecioProveedor[];
  onAgregar: (a: AsignacionPendiente) => void;
}) {
  // Precargados: cantidad con el total pendiente de la línea (editable, para
  // reparto parcial) y proveedor con el "habitual" del artículo si tiene uno
  // cargado (igual editable, sin quedar bloqueado).
  const [cantidad, setCantidad] = useState(String(pendienteRestante));
  const [destino, setDestino] = useState<DestinoAsignacion>("proveedor");
  const [proveedorId, setProveedorId] = useState(linea.articulos?.proveedor_habitual_id ?? "");
  const [precioManual, setPrecioManual] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");

  const precioCatalogo = useMemo(() => {
    if (!proveedorId) return null;
    const fila = preciosProveedor.find(
      (p) => p.proveedor_id === proveedorId && p.articulo_id === linea.articulo_id,
    );
    return fila?.precio ?? null;
  }, [proveedorId, preciosProveedor, linea.articulo_id]);

  if (pendienteRestante <= 0) {
    return <p className="text-sm text-emerald-600">Cantidad totalmente asignada.</p>;
  }

  function agregar() {
    setError("");
    const cant = Number(cantidad);
    if (!cant || cant <= 0) {
      setError("Ingresá una cantidad mayor a 0.");
      return;
    }
    if (cant > pendienteRestante) {
      setError(`No podés asignar más de lo pendiente (${pendienteRestante}).`);
      return;
    }
    if (requiereProveedor(destino)) {
      if (!proveedorId) {
        setError("Elegí un proveedor.");
        return;
      }
      const precio = precioCatalogo ?? Number(precioManual);
      if (!precio || precio <= 0) {
        setError("Ingresá un precio válido para este proveedor.");
        return;
      }
      const proveedor = proveedores.find((p) => p.id === proveedorId);
      onAgregar({
        clave: crypto.randomUUID(),
        pedidoCompraItemId: linea.id,
        articulo: linea.articulos!,
        cantidad: cant,
        destino,
        proveedorId,
        proveedorNombre: proveedor?.razon_social ?? null,
        precioUnitario: precio,
        observaciones,
      });
    } else {
      onAgregar({
        clave: crypto.randomUUID(),
        pedidoCompraItemId: linea.id,
        articulo: linea.articulos!,
        cantidad: cant,
        destino: "deposito",
        proveedorId: null,
        proveedorNombre: null,
        precioUnitario: null,
        observaciones,
      });
    }
    setCantidad("");
    setProveedorId("");
    setPrecioManual("");
    setObservaciones("");
  }

  return (
    <div className="flex flex-wrap gap-2 items-start">
      <input
        type="number"
        min="0.01"
        step="any"
        placeholder={`Cantidad (pend. ${pendienteRestante})`}
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value)}
        className={`w-40 ${inputStyle}`}
      />
      <select
        value={destino}
        onChange={(e) => setDestino(e.target.value as DestinoAsignacion)}
        className={`min-w-[220px] ${inputStyle}`}
      >
        <option value="proveedor">Orden de compra (directo al cliente)</option>
        <option value="proveedor_deposito">Orden de compra (entra a nuestro depósito)</option>
        <option value="deposito">Pedido a depósito (ya tengo stock)</option>
      </select>
      {requiereProveedor(destino) && (
        <>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className={`min-w-[180px] ${inputStyle}`}
          >
            <option value="">Seleccionar proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.razon_social}
              </option>
            ))}
          </select>
          {proveedorId && precioCatalogo === null && (
            <input
              type="number"
              min="0.01"
              step="any"
              placeholder="Precio unitario (manual)"
              value={precioManual}
              onChange={(e) => setPrecioManual(e.target.value)}
              className={`w-44 ${inputStyle}`}
            />
          )}
          {proveedorId && precioCatalogo !== null && (
            <span className="px-3 py-2 text-sm text-slate-600">
              Precio: $ {precioCatalogo.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          )}
        </>
      )}
      <input
        type="text"
        placeholder="Observaciones (opcional)"
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        className={`flex-1 min-w-[160px] ${inputStyle}`}
      />
      <button
        type="button"
        onClick={agregar}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Agregar a la lista
      </button>
      {destino === "proveedor_deposito" && (
        <p className="text-sm text-slate-500 w-full">
          Se van a generar dos líneas independientes: una en la orden de compra a este proveedor y
          otra en el pedido a depósito de este pedido de compra.
        </p>
      )}
      {requiereProveedor(destino) && proveedorId && precioCatalogo === null && (
        <p className="text-amber-600 text-sm w-full">
          Sin precio cargado para este proveedor. El precio que ingreses se usa solo para esta orden
          de compra.
        </p>
      )}
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </div>
  );
}

// Mini-form de confirmación para descartar una línea (motivo opcional). No
// toca supabase directamente: reporta la decisión al padre, igual que hace
// LineaAsignacionForm con onAgregar.
function DescarteLineaForm({
  procesando,
  onConfirmar,
  onCancelar,
}: {
  procesando: boolean;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <div className="flex flex-wrap gap-2 items-start mt-2">
      <input
        type="text"
        placeholder="Motivo del descarte (opcional)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className={`flex-1 min-w-[200px] ${inputStyle}`}
      />
      <button
        type="button"
        onClick={() => onConfirmar(motivo)}
        disabled={procesando}
        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {procesando ? "Descartando..." : "Confirmar descarte"}
      </button>
      <button
        type="button"
        onClick={onCancelar}
        disabled={procesando}
        className="px-3 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
      >
        Cancelar
      </button>
    </div>
  );
}

function destinoEtiqueta(a: AsignacionPendiente) {
  if (a.destino === "deposito") return "Depósito";
  if (a.destino === "proveedor") return a.proveedorNombre ?? "";
  return `${a.proveedorNombre} + Depósito`;
}

export default function PanelComprasAsignacion({
  pedidoId,
  empresaNombre,
  empresaDomicilio,
  domicilios,
  lugarEnvioDefault,
  lineas,
  proveedores,
  preciosProveedor,
}: {
  pedidoId: string;
  empresaId: string;
  clienteId: string;
  empresaNombre: string | null;
  empresaDomicilio: string | null;
  domicilios: ClienteDomicilio[];
  lugarEnvioDefault: string;
  lineas: LineaPendiente[];
  proveedores: ProveedorResumen[];
  preciosProveedor: PrecioProveedor[];
}) {
  const [asignaciones, setAsignaciones] = useState<AsignacionPendiente[]>([]);
  const [lugarEnvio, setLugarEnvio] = useState(lugarEnvioDefault); // '' | 'empresa' | `domicilio:<id>`
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [lineaDescarteAbiertaId, setLineaDescarteAbiertaId] = useState<string | null>(null);
  const [descartandoId, setDescartandoId] = useState<string | null>(null);
  const operationKey = useRef<string | null>(null);
  const router = useRouter();

  async function descartarLinea(itemId: string, motivo: string) {
    setDescartandoId(itemId);
    setError("");
    try {
      await (
        await createAuthenticatedBrowserApiClient()
      ).setPurchaseRequestItemDiscarded(itemId, true, motivo || null);
      setLineaDescarteAbiertaId(null);
      router.refresh();
    } catch (e) {
      setError("Error al descartar la línea: " + (e instanceof Error ? e.message : "desconocido"));
    } finally {
      setDescartandoId(null);
    }
  }

  async function revertirDescarte(itemId: string) {
    setDescartandoId(itemId);
    setError("");
    try {
      await (
        await createAuthenticatedBrowserApiClient()
      ).setPurchaseRequestItemDiscarded(itemId, false, null);
      router.refresh();
    } catch (e) {
      setError(
        "Error al revertir el descarte: " + (e instanceof Error ? e.message : "desconocido"),
      );
    } finally {
      setDescartandoId(null);
    }
  }

  function resolverLugarEnvioTexto(): string | null {
    if (lugarEnvio === "empresa") return empresaDomicilio || null;
    if (lugarEnvio.startsWith("domicilio:")) {
      const dom = domicilios.find((d) => d.id === lugarEnvio.slice("domicilio:".length));
      return dom?.direccion || null;
    }
    return null;
  }

  function resolverLugarEnvioAlias(): string | null {
    if (lugarEnvio === "empresa") return empresaNombre || null;
    if (lugarEnvio.startsWith("domicilio:")) {
      const dom = domicilios.find((d) => d.id === lugarEnvio.slice("domicilio:".length));
      return dom?.alias || null;
    }
    return null;
  }

  // Horario del domicilio elegido como lugar de envío, congelado igual que
  // el texto/alias. La empresa no tiene concepto de horario de atención.
  function resolverHorarioAtencionTexto(): string | null {
    if (lugarEnvio.startsWith("domicilio:")) {
      const dom = domicilios.find((d) => d.id === lugarEnvio.slice("domicilio:".length));
      return dom?.horario_atencion || null;
    }
    return null;
  }

  const hayAsignacionesConProveedor = asignaciones.some(
    (a) => a.destino === "proveedor" || a.destino === "proveedor_deposito",
  );

  const pendientePorLinea = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of lineas) {
      const enCola = asignaciones
        .filter((a) => a.pedidoCompraItemId === l.id)
        .reduce((acc, a) => acc + a.cantidad, 0);
      mapa.set(l.id, l.cantidad_pendiente - enCola);
    }
    return mapa;
  }, [lineas, asignaciones]);

  function quitar(clave: string) {
    setAsignaciones((prev) => prev.filter((a) => a.clave !== clave));
  }

  async function confirmar() {
    setError("");
    setGuardando(true);

    const lugarEnvioTexto = resolverLugarEnvioTexto();
    const lugarEnvioAlias = resolverLugarEnvioAlias();
    const horarioAtencionTexto = resolverHorarioAtencionTexto();

    operationKey.current ??= crypto.randomUUID();
    try {
      await (
        await createAuthenticatedBrowserApiClient()
      ).assignPurchaseRequest(
        pedidoId,
        {
          lugarEnvioTexto,
          lugarEnvioAlias,
          horarioAtencionTexto,
          items: asignaciones.map((a) => ({
            pedidoCompraItemId: a.pedidoCompraItemId,
            destino: a.destino,
            proveedorId: a.proveedorId,
            cantidad: a.cantidad,
            precioUnitario: a.precioUnitario,
            observaciones: a.observaciones || null,
          })),
        },
        operationKey.current,
      );
      operationKey.current = null;
      setAsignaciones([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al confirmar asignaciones");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Líneas del pedido
        </h2>
        <div className="space-y-4">
          {lineas.map((l) => (
            <div key={l.id} className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-medium text-slate-800">
                  {l.articulos
                    ? `${l.articulos.codigo_interno} — ${l.articulos.nombre}`
                    : "Artículo"}
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-slate-500">
                    Pedido: {l.cantidad} · Asignado a OC: {l.cantidad_asignada_oc} · Asignado a
                    depósito: {l.cantidad_asignada_deposito}
                    {" · "}
                    <span className="font-medium text-slate-700">
                      Pendiente: {pendientePorLinea.get(l.id) ?? l.cantidad_pendiente}
                    </span>
                  </p>
                  {!l.descartada && (
                    <button
                      type="button"
                      onClick={() => setLineaDescarteAbiertaId(l.id)}
                      className="text-rose-600 hover:underline text-xs whitespace-nowrap"
                    >
                      Descartar línea
                    </button>
                  )}
                </div>
              </div>

              {l.descartada ? (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                  <p className="text-sm text-slate-600">
                    Línea descartada{l.motivo_descarte ? `: ${l.motivo_descarte}` : "."}
                  </p>
                  <button
                    type="button"
                    onClick={() => revertirDescarte(l.id)}
                    disabled={descartandoId === l.id}
                    className="text-teal-600 hover:underline text-sm disabled:opacity-50"
                  >
                    {descartandoId === l.id ? "Revirtiendo..." : "Revertir descarte"}
                  </button>
                </div>
              ) : (
                <>
                  <LineaAsignacionForm
                    // El estado interno (cantidad/proveedor precargados) no se
                    // resetea solo porque cambie una prop: forzamos un remount
                    // limpio cada vez que cambia el pendiente de esta línea (ej.
                    // después de encolar una asignación parcial), para que la
                    // próxima precarga sea con el valor fresco, no el viejo.
                    key={pendientePorLinea.get(l.id) ?? l.cantidad_pendiente}
                    linea={l}
                    pendienteRestante={pendientePorLinea.get(l.id) ?? l.cantidad_pendiente}
                    proveedores={proveedores}
                    preciosProveedor={preciosProveedor}
                    onAgregar={(a) => setAsignaciones((prev) => [...prev, a])}
                  />
                  {lineaDescarteAbiertaId === l.id && (
                    <DescarteLineaForm
                      procesando={descartandoId === l.id}
                      onConfirmar={(motivo) => descartarLinea(l.id, motivo)}
                      onCancelar={() => setLineaDescarteAbiertaId(null)}
                    />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Asignaciones a confirmar ({asignaciones.length})
        </h2>
        {asignaciones.length === 0 ? (
          <p className="text-slate-500 text-sm">Todavía no agregaste ninguna asignación.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Artículo</th>
                  <th className="px-4 py-3 font-medium">Cantidad</th>
                  <th className="px-4 py-3 font-medium">Destino</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {asignaciones.map((a) => (
                  <tr key={a.clave} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-800">
                      {a.articulo.codigo_interno} — {a.articulo.nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.cantidad}</td>
                    <td className="px-4 py-3 text-slate-600">{destinoEtiqueta(a)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.precioUnitario != null
                        ? `$ ${a.precioUnitario.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => quitar(a.clave)}
                        className="text-rose-600 hover:underline text-sm"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hayAsignacionesConProveedor && (
          <div className="mt-4">
            <label className="block text-sm text-slate-600 mb-1">
              Lugar de envío (para las órdenes de compra que se generen ahora)
            </label>
            <select
              value={lugarEnvio}
              onChange={(e) => setLugarEnvio(e.target.value)}
              className={`w-full max-w-md ${inputStyle}`}
            >
              <option value="">Sin especificar</option>
              {domicilios.length > 0 && (
                <optgroup label="Domicilios del cliente">
                  {domicilios.map((d) => (
                    <option key={d.id} value={`domicilio:${d.id}`}>
                      {d.alias} — {d.direccion}
                    </option>
                  ))}
                </optgroup>
              )}
              {empresaDomicilio && (
                <optgroup label="Empresa">
                  <option value="empresa">
                    {empresaNombre ?? "Empresa"} — {empresaDomicilio}
                  </option>
                </optgroup>
              )}
            </select>
          </div>
        )}

        {error && <p className="text-rose-600 text-sm mt-3">{error}</p>}

        <button
          onClick={confirmar}
          disabled={asignaciones.length === 0 || guardando}
          className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {guardando ? "Confirmando..." : "Confirmar asignaciones"}
        </button>
      </div>
    </div>
  );
}
