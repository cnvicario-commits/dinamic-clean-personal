"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { createAuthenticatedBrowserApiClient } from "@/lib/api/browser";
import DescargarPlantillaArticulos from "./DescargarPlantillaArticulos";

type Row = {
  fila: number;
  codigoInterno: string;
  nombre: string;
  categoria: string | null;
  unidad: string | null;
};
type Preview = {
  total: number;
  validas: number;
  invalidas: number;
  nuevos: number;
  actualizaciones: number;
  errores: Array<{ fila: number; motivo: string }>;
};
export default function ImportarArticulos() {
  const [open, setOpen] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [rows, setRows] = useState<Row[] | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [key, setKey] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{ creados: number; actualizados: number } | null>(null);
  const router = useRouter();
  function choose(next: File | null) {
    setFile(next);
    setRows(null);
    setPreview(null);
    setResult(null);
    setError("");
    setKey(next ? crypto.randomUUID() : null);
  }
  async function parseAndPreview() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const book = file.name.toLowerCase().endsWith(".csv")
        ? XLSX.read(await file.text(), { type: "string" })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        book.Sheets[book.SheetNames[0]],
        { defval: "" },
      );
      if (!raw.length) throw new Error("El archivo no tiene filas.");
      if (!Object.keys(raw[0]).includes("nombre"))
        throw new Error("Falta la columna obligatoria nombre.");
      const parsed = raw.map((r, i) => ({
        fila: i + 2,
        codigoInterno: String(r.codigo_interno ?? "").trim(),
        nombre: String(r.nombre ?? "").trim(),
        categoria: String(r.categoria ?? "").trim() || null,
        unidad: String(r.unidad ?? "").trim() || null,
      }));
      const api = await createAuthenticatedBrowserApiClient();
      const p = await api.previewArticleImport({ rows: parsed });
      setRows(parsed);
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo validar el archivo");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!rows || !key || !preview || preview.invalidas > 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await (
        await createAuthenticatedBrowserApiClient()
      ).importArticles({ rows }, key);
      setResult(response.response);
      setFile(null);
      setRows(null);
      setPreview(null);
      setKey(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar el import");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-sm font-medium text-teal-600 hover:underline"
      >
        {open ? "Ocultar importación masiva" : "Importar desde Excel"}
      </button>
      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <DescargarPlantillaArticulos />
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={!file || busy}
            onClick={parseAndPreview}
            className="w-fit px-4 py-2 bg-slate-700 text-white text-sm rounded-lg disabled:opacity-50"
          >
            Vista previa
          </button>
          {preview && (
            <div className="border rounded-lg p-3 text-sm">
              <p>
                Total {preview.total} · válidas {preview.validas} · inválidas {preview.invalidas} ·
                nuevas {preview.nuevos} · actualizaría {preview.actualizaciones}
              </p>
              {preview.errores.map((e, i) => (
                <p key={i} className="text-rose-600">
                  Fila {e.fila || "-"}: {e.motivo}
                </p>
              ))}
              <button
                type="button"
                disabled={busy || preview.invalidas > 0}
                onClick={apply}
                className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-50"
              >
                Confirmar importación
              </button>
            </div>
          )}
          {error && <p className="text-rose-600 text-sm">{error}</p>}
          {result && (
            <p className="text-emerald-700 text-sm">
              Creados: {result.creados}. Actualizados: {result.actualizados}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
