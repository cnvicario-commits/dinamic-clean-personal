"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthenticatedBrowserApiClient } from "@/lib/api/browser";
import BuscadorArticulo from "./BuscadorArticulo";
import ArticuloForm from "./ArticuloForm";
type Articulo = { id: string; codigo_interno: string; nombre: string };
type Pendiente = {
  id: string;
  codigo_proveedor: string | null;
  nombre_proveedor: string | null;
  precio: number | null;
  archivo_origen: string | null;
  motivo: string | null;
  sugerencias: Array<{
    articulo_id: string;
    codigo_interno: string;
    nombre: string;
    similitud: number;
  }> | null;
  razon_social?: string;
};
export default function PendientesTabla({
  pendientes,
  articulos,
}: {
  pendientes: Pendiente[];
  articulos: Articulo[];
}) {
  if (!pendientes.length)
    return <p className="text-slate-500 text-sm">No hay líneas pendientes por resolver.</p>;
  return (
    <div className="flex flex-col gap-3">
      {pendientes.map((p) => (
        <Fila key={p.id} pendiente={p} articulos={articulos} />
      ))}
    </div>
  );
}
function Fila({ pendiente, articulos }: { pendiente: Pendiente; articulos: Articulo[] }) {
  const [modo, setModo] = useState<"vincular" | "crear" | null>(null),
    [seleccion, setSeleccion] = useState<Articulo | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const router = useRouter();
  async function vincular(articuloId: string) {
    setLoading(true);
    setError("");
    try {
      await (
        await createAuthenticatedBrowserApiClient()
      ).resolveSupplierArticlePending(pendiente.id, articuloId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo resolver el pendiente");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-slate-800 font-medium">
            {pendiente.nombre_proveedor || "Sin descripción"}
          </p>
          <p className="text-sm text-slate-500">
            {pendiente.razon_social ?? "Proveedor"} · Código:{" "}
            {pendiente.codigo_proveedor || "sin código"} · Precio: {pendiente.precio ?? "-"}
          </p>
          {pendiente.motivo && <p className="text-sm text-amber-600 mt-1">{pendiente.motivo}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModo(modo === "vincular" ? null : "vincular")}
            className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg"
          >
            Vincular a artículo existente
          </button>
          <button
            onClick={() => setModo(modo === "crear" ? null : "crear")}
            className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg"
          >
            Crear artículo nuevo
          </button>
        </div>
      </div>
      {pendiente.sugerencias?.map((s) => (
        <button
          key={s.articulo_id}
          onClick={() => vincular(s.articulo_id)}
          disabled={loading}
          className="mt-2 block text-left px-3 py-2 text-sm bg-teal-50 text-teal-800 rounded-lg"
        >
          {s.codigo_interno} — {s.nombre}
        </button>
      ))}
      {modo === "vincular" && (
        <div className="mt-4 flex gap-2">
          <div className="flex-1">
            <BuscadorArticulo articulos={articulos} onSeleccionar={setSeleccion} />
          </div>
          <button
            disabled={!seleccion || loading}
            onClick={() => seleccion && vincular(seleccion.id)}
            className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg"
          >
            {loading ? "Vinculando..." : "Vincular"}
          </button>
        </div>
      )}
      {modo === "crear" && (
        <div className="mt-4">
          <ArticuloForm nombreSugerido={pendiente.nombre_proveedor ?? ""} onCreated={vincular} />
        </div>
      )}
      {error && <p className="text-rose-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
