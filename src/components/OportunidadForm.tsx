"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthenticatedBrowserApiClient } from "@/lib/api/browser";
import BuscadorProspecto from "./BuscadorProspecto";
import ProspectoForm from "./ProspectoForm";
import SelectConCrear from "./SelectConCrear";
import type { CatalogoItem, PerfilResumen } from "@/types/crm";

type Prospecto = { id: string; nombre: string };

const inputStyle =
  "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

export default function OportunidadForm({
  prospectos,
  tiposServicio,
  tiposCliente,
  referidores,
  responsables,
  responsableFijo = null,
  prospectoInicial = null,
  leadId = null,
}: {
  prospectos: Prospecto[];
  tiposServicio: CatalogoItem[];
  tiposCliente: CatalogoItem[];
  referidores: CatalogoItem[];
  responsables: PerfilResumen[];
  responsableFijo?: PerfilResumen | null;
  prospectoInicial?: Prospecto | null;
  leadId?: string | null;
}) {
  // Elegir un prospecto existente o crear uno nuevo al vuelo: mismo patrón
  // de dos modos excluyentes que ya usa PendientesTabla.tsx.
  const [modoProspecto, setModoProspecto] = useState<"buscar" | "crear">("buscar");
  const [prospecto, setProspecto] = useState<Prospecto | null>(prospectoInicial);

  const [numeroReferencia, setNumeroReferencia] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipoServicioId, setTipoServicioId] = useState("");
  const [tiposServicioState, setTiposServicioState] = useState(tiposServicio);
  const [cantidadPersonal, setCantidadPersonal] = useState("");
  const [montoEstimado, setMontoEstimado] = useState("");
  const [fechaEnvio, setFechaEnvio] = useState("");
  const [comisionMonto, setComisionMonto] = useState("");
  const [responsableId, setResponsableId] = useState(responsableFijo?.id ?? "");
  const [comentarios, setComentarios] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!prospecto) {
      setError("Elegí un prospecto existente o creá uno nuevo.");
      return;
    }
    if (!responsableId) {
      setError("Elegí un responsable.");
      return;
    }
    setLoading(true);
    let data: { id: string } | null = null;
    let errInsert: unknown = null;
    try {
      const api = await createAuthenticatedBrowserApiClient();
      const campos = {
        numeroReferencia: numeroReferencia || null,
        fechaIngreso,
        tipoServicioId: tipoServicioId || null,
        cantidadPersonal: cantidadPersonal ? Number(cantidadPersonal) : null,
        montoEstimado: montoEstimado ? Number(montoEstimado) : null,
        fechaEnvio: fechaEnvio || null,
        comisionMonto: comisionMonto ? Number(comisionMonto) : null,
        comentarios: comentarios || null,
        responsableId,
      };
      if (leadId) {
        const result = await api.convertCrmLead(leadId, campos, crypto.randomUUID());
        data = { id: result.response.opportunity.id };
      } else {
        const result = await api.createCrmOpportunity(
          { ...campos, prospectoId: prospecto.id },
          crypto.randomUUID(),
        );
        data = { id: result.response.id };
      }
    } catch (error) {
      errInsert = error;
    }
    setLoading(false);
    if (errInsert || !data) {
      setError(
        "Error al guardar: " + (errInsert instanceof Error ? errInsert.message : "desconocido"),
      );
      return;
    }

    router.push(`/ventas/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Prospecto (cliente que cotiza)</label>
        {prospecto ? (
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-800 font-medium flex-1">{prospecto.nombre}</span>
            <button
              type="button"
              onClick={() => setProspecto(null)}
              className="text-rose-600 hover:underline text-sm"
            >
              Quitar
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setModoProspecto("buscar")}
                className={`px-3 py-1.5 text-sm rounded-lg ${modoProspecto === "buscar" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                Buscar existente
              </button>
              <button
                type="button"
                onClick={() => setModoProspecto("crear")}
                className={`px-3 py-1.5 text-sm rounded-lg ${modoProspecto === "crear" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                Crear prospecto nuevo
              </button>
            </div>
            {modoProspecto === "buscar" ? (
              <BuscadorProspecto prospectos={prospectos} onSeleccionar={setProspecto} />
            ) : (
              <ProspectoForm
                tiposCliente={tiposCliente}
                referidores={referidores}
                onCreated={setProspecto}
              />
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-start">
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">N° de referencia (opcional)</label>
          <input
            type="text"
            placeholder="Ej: 4806-BIS"
            value={numeroReferencia}
            onChange={(e) => setNumeroReferencia(e.target.value)}
            className={`w-40 ${inputStyle}`}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Fecha de ingreso</label>
          <input
            type="date"
            value={fechaIngreso}
            onChange={(e) => setFechaIngreso(e.target.value)}
            required
            className={inputStyle}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Tipo de servicio</label>
          <SelectConCrear
            recurso="tipos-servicio"
            items={tiposServicioState}
            value={tipoServicioId}
            onChange={(id, items) => {
              setTipoServicioId(id);
              setTiposServicioState(items);
            }}
            placeholder="Elegir tipo de servicio"
            className={`w-56 ${inputStyle}`}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Cantidad de personal</label>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="Ej: 2.5"
            value={cantidadPersonal}
            onChange={(e) => setCantidadPersonal(e.target.value)}
            className={`w-32 ${inputStyle}`}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Monto estimado</label>
          <input
            type="number"
            min="0"
            step="any"
            value={montoEstimado}
            onChange={(e) => setMontoEstimado(e.target.value)}
            className={`w-40 ${inputStyle}`}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Fecha de envío (opcional)</label>
          <input
            type="date"
            value={fechaEnvio}
            onChange={(e) => setFechaEnvio(e.target.value)}
            className={inputStyle}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Comisión (opcional)</label>
          <input
            type="number"
            min="0"
            step="any"
            value={comisionMonto}
            onChange={(e) => setComisionMonto(e.target.value)}
            className={`w-32 ${inputStyle}`}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Responsable</label>
          {responsableFijo ? (
            <p className={`w-48 ${inputStyle} bg-slate-50 text-slate-600 flex items-center`}>
              {responsableFijo.nombre_completo}
            </p>
          ) : (
            <select
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              required
              className={`w-48 ${inputStyle}`}
            >
              <option value="">Elegir responsable</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre_completo}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <textarea
        placeholder="Comentarios (opcional)"
        value={comentarios}
        onChange={(e) => setComentarios(e.target.value)}
        rows={3}
        className={`w-full ${inputStyle}`}
      />

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="self-start px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? "Guardando..." : leadId ? "Convertir a oportunidad" : "Crear oportunidad"}
      </button>
    </form>
  );
}
