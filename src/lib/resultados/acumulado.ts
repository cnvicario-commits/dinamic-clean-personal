/** Coerce valores de montos (número o string `numeric` de PostgreSQL). */
export function montoNumerico(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") {
    const texto = valor.trim();
    if (texto === "") return null;
    const n = Number(texto);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type SumaAcumulado =
  | { estado: "ok"; valor: number }
  | { estado: "sin_datos" }
  | { estado: "monto_invalido" };

export type PctSobreVentasAcumuladoResult =
  | { estado: "ok"; valor: number }
  | { estado: "sin_ventas" }
  | { estado: "ventas_cero" }
  | { estado: "ventas_invalidas" }
  | { estado: "rubro_invalido" };

/**
 * Suma de montos en un rango de rubros mensuales: omite `null`/`undefined`;
 * no trata valores inválidos como cero.
 */
export function sumarMontosEnRango(valores: readonly unknown[]): SumaAcumulado {
  let tieneValor = false;
  let suma = 0;
  for (const valor of valores) {
    if (valor === null || valor === undefined) continue;
    const n = montoNumerico(valor);
    if (n === null) return { estado: "monto_invalido" };
    tieneValor = true;
    suma += n;
  }
  return tieneValor ? { estado: "ok", valor: suma } : { estado: "sin_datos" };
}

/** Acumulado de detalle: concepto ausente en un mes no suma; monto inválido → error explícito. */
export function sumarDetalleConceptoEnRango(montosPorMes: readonly unknown[]): SumaAcumulado {
  let suma = 0;
  let tieneValor = false;
  for (const monto of montosPorMes) {
    if (monto === undefined || monto === null) continue;
    const n = montoNumerico(monto);
    if (n === null) return { estado: "monto_invalido" };
    tieneValor = true;
    suma += n;
  }
  return tieneValor ? { estado: "ok", valor: suma } : { estado: "ok", valor: 0 };
}

export function valorNumericoSumaAcumulado(suma: SumaAcumulado): number | null {
  return suma.estado === "ok" ? suma.valor : null;
}

export function pctSobreVentasAcumulado(
  rubro: SumaAcumulado,
  ventasAcumuladas: SumaAcumulado,
): PctSobreVentasAcumuladoResult {
  if (ventasAcumuladas.estado === "sin_datos") return { estado: "sin_ventas" };
  if (ventasAcumuladas.estado === "monto_invalido") return { estado: "ventas_invalidas" };
  if (ventasAcumuladas.valor === 0) return { estado: "ventas_cero" };
  if (rubro.estado === "monto_invalido") return { estado: "rubro_invalido" };
  const valorRubro = rubro.estado === "sin_datos" ? 0 : rubro.valor;
  return { estado: "ok", valor: (valorRubro / ventasAcumuladas.valor) * 100 };
}

export type EtiquetaAcumulado = {
  texto: string;
  titulo?: string;
  resaltarAviso?: boolean;
};

export function etiquetaSumaAcumulado(
  suma: SumaAcumulado,
  formatearMonto: (valor: number | null | undefined) => string,
): EtiquetaAcumulado {
  if (suma.estado === "ok") return { texto: formatearMonto(suma.valor) };
  if (suma.estado === "sin_datos") return { texto: formatearMonto(null) };
  return {
    texto: "—",
    titulo: "Hay montos no válidos en el rango; no se puede mostrar el acumulado.",
    resaltarAviso: true,
  };
}

export function etiquetaPctSobreVentasAcumulado(
  pct: PctSobreVentasAcumuladoResult,
): EtiquetaAcumulado | null {
  if (pct.estado === "ok") {
    return { texto: `${pct.valor.toFixed(1)}% s/ventas` };
  }
  if (pct.estado === "rubro_invalido" || pct.estado === "ventas_invalidas") {
    return {
      texto: "—",
      titulo: "No se pudo calcular el porcentaje por un monto inválido en el acumulado.",
      resaltarAviso: true,
    };
  }
  return null;
}
