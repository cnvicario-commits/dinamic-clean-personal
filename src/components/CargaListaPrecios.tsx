"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { createAuthenticatedBrowserApiClient } from "@/lib/api/browser";
import { normalizarPrecio } from "@/utils/normalizarPrecio";
import DescargarPlantillaListaPrecios from "./DescargarPlantillaListaPrecios";
type Supplier = { id: string; razon_social: string };
type Row = {
  fila: number;
  codigoProveedor: string;
  codigoInterno: string;
  nombreProveedor: string;
  precio: number;
};
type Preview = {
  total: number;
  validas: number;
  invalidas: number;
  matchesExistentes: number;
  relacionesNuevas: number;
  pendientesNuevas: number;
  pendientesActualizadas: number;
  duplicados: string[];
  errores: Array<{ fila: number; motivo: string }>;
};
const REQUIRED = ["codigo_proveedor", "nombre_proveedor", "precio"];
export default function CargaListaPrecios({ proveedores }: { proveedores: Supplier[] }) {
  const [supplierId, setSupplierId] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [rows, setRows] = useState<Row[] | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [key, setKey] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{
      actualizados: number;
      vinculadosPorCodigoInterno: number;
      pendientesNuevas: number;
      pendientesActualizadas: number;
    } | null>(null);
  const router = useRouter();
  function reset(nextSupplier = supplierId, nextFile = file) {
    setSupplierId(nextSupplier);
    setFile(nextFile);
    setRows(null);
    setPreview(null);
    setResult(null);
    setError("");
    setKey(nextSupplier && nextFile ? crypto.randomUUID() : null);
  }
  async function parsePreview() {
    if (!file || !supplierId) return;
    setBusy(true);
    setError("");
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        book.Sheets[book.SheetNames[0]],
        { defval: "" },
      );
      if (!raw.length) throw new Error("El archivo no tiene filas.");
      const missing = REQUIRED.filter((c) => !Object.keys(raw[0]).includes(c));
      if (missing.length) throw new Error(`Faltan columnas obligatorias: ${missing.join(", ")}`);
      const parsed = raw.map((r, i) => {
        const precio = normalizarPrecio(r.precio);
        if (Number.isNaN(precio) || precio < 0) throw new Error(`Precio inválido en fila ${i + 2}`);
        return {
          fila: i + 2,
          codigoProveedor: String(r.codigo_proveedor).trim(),
          codigoInterno: String(r.codigo_interno ?? "").trim(),
          nombreProveedor: String(r.nombre_proveedor).trim(),
          precio,
        };
      });
      const input = { proveedorId: supplierId, archivoOrigen: file.name, rows: parsed };
      const p = await (await createAuthenticatedBrowserApiClient()).previewPriceList(input);
      setRows(parsed);
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo validar la lista");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!file || !rows || !key || !preview || preview.invalidas > 0) return;
    setBusy(true);
    setError("");
    try {
      const r = await (
        await createAuthenticatedBrowserApiClient()
      ).applyPriceList({ proveedorId: supplierId, archivoOrigen: file.name, rows }, key);
      setResult(r.response);
      setRows(null);
      setPreview(null);
      setFile(null);
      setKey(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar la lista");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <DescargarPlantillaListaPrecios proveedorId={supplierId} />
      <select
        value={supplierId}
        onChange={(e) => reset(e.target.value, file)}
        className="px-3 py-2 border rounded-lg"
      >
        <option value="">Elegí un proveedor...</option>
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>
            {p.razon_social}
          </option>
        ))}
      </select>
      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => reset(supplierId, e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={parsePreview}
        disabled={!supplierId || !file || busy}
        className="w-fit px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50"
      >
        Vista previa
      </button>
      {preview && (
        <div className="border rounded-lg p-3 text-sm">
          <p>
            Total {preview.total} · matches {preview.matchesExistentes} · relaciones nuevas{" "}
            {preview.relacionesNuevas} · pendientes nuevas {preview.pendientesNuevas} · pendientes
            actualizadas {preview.pendientesActualizadas}
          </p>
          {preview.duplicados.length > 0 && (
            <p className="text-amber-700">
              Códigos repetidos (se aplicará la última fila): {preview.duplicados.join(", ")}
            </p>
          )}
          {preview.errores.map((e, i) => (
            <p key={i} className="text-rose-600">
              Fila {e.fila}: {e.motivo}
            </p>
          ))}
          <button
            type="button"
            disabled={preview.invalidas > 0 || busy}
            onClick={apply}
            className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-50"
          >
            Confirmar aplicación
          </button>
        </div>
      )}
      {error && <p className="text-rose-600 text-sm">{error}</p>}
      {result && (
        <p className="text-emerald-700 text-sm">
          Actualizados {result.actualizados}, vinculados {result.vinculadosPorCodigoInterno},
          pendientes nuevos {result.pendientesNuevas}, pendientes actualizados{" "}
          {result.pendientesActualizadas}.
        </p>
      )}
    </div>
  );
}
