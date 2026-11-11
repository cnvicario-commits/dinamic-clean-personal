import { describe, expect, it } from "vitest";
import {
  etiquetaPctSobreVentasAcumulado,
  etiquetaSumaAcumulado,
  pctSobreVentasAcumulado,
  sumarDetalleConceptoEnRango,
  sumarMontosEnRango,
  type SumaAcumulado,
} from "./acumulado";

const formatearMonto = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? "-" : String(Math.round(valor));

describe("sumarMontosEnRango", () => {
  it("sums decimal strings without concatenation", () => {
    const valores = ["4500000.50", "4600000.25", "4700000.75"];
    expect(sumarMontosEnRango(valores)).toEqual({ estado: "ok", valor: 13_800_001.5 });
  });

  it("sums multiple integer strings arithmetically", () => {
    expect(sumarMontosEnRango(["4500000", "4600000", "4700000"])).toEqual({
      estado: "ok",
      valor: 13_800_000,
    });
  });

  it("sums decimal then integer (4500000.50 + 4600000)", () => {
    expect(sumarMontosEnRango(["4500000.50", "4600000"])).toEqual({
      estado: "ok",
      valor: 9_100_000.5,
    });
  });

  it("skips null and undefined without treating them as zero contributors", () => {
    expect(sumarMontosEnRango([null, "100", undefined, "50"])).toEqual({
      estado: "ok",
      valor: 150,
    });
    expect(sumarMontosEnRango([null, undefined])).toEqual({ estado: "sin_datos" });
  });

  it("marks invalid present values explicitly instead of returning NaN", () => {
    expect(sumarMontosEnRango(["100", "no-es-numero"])).toEqual({ estado: "monto_invalido" });
  });

  it("sums representative excel-scale postgres strings without concatenation", () => {
    expect(sumarMontosEnRango(["2497214323.19", "2002391642.27"])).toEqual({
      estado: "ok",
      valor: 4_499_605_965.46,
    });
  });
});

describe("pctSobreVentasAcumulado", () => {
  const ventasOk: SumaAcumulado = { estado: "ok", valor: 10_000_000 };
  const rubroOk: SumaAcumulado = { estado: "ok", valor: 2_500_000 };

  it("uses sum of rubro over sum of ventas", () => {
    const pct = pctSobreVentasAcumulado(rubroOk, ventasOk);
    expect(pct).toEqual({ estado: "ok", valor: 25 });
  });

  it("distinguishes absent ventas from zero and invalid denominators", () => {
    expect(pctSobreVentasAcumulado(rubroOk, { estado: "sin_datos" })).toEqual({
      estado: "sin_ventas",
    });
    expect(pctSobreVentasAcumulado(rubroOk, { estado: "ok", valor: 0 })).toEqual({
      estado: "ventas_cero",
    });
    expect(pctSobreVentasAcumulado(rubroOk, { estado: "monto_invalido" })).toEqual({
      estado: "ventas_invalidas",
    });
  });

  it("distinguishes invalid rubro from absent rubro", () => {
    expect(pctSobreVentasAcumulado({ estado: "sin_datos" }, ventasOk)).toEqual({
      estado: "ok",
      valor: 0,
    });
    expect(pctSobreVentasAcumulado({ estado: "monto_invalido" }, ventasOk)).toEqual({
      estado: "rubro_invalido",
    });
  });
});

describe("sumarDetalleConceptoEnRango", () => {
  it("sums PostgreSQL string montos for detail acumulado", () => {
    expect(sumarDetalleConceptoEnRango(["100.5", "200.25", "50"])).toEqual({
      estado: "ok",
      valor: 350.75,
    });
  });

  it("returns zero when all months are absent", () => {
    expect(sumarDetalleConceptoEnRango([undefined, null])).toEqual({
      estado: "ok",
      valor: 0,
    });
  });

  it("marks invalid detail montos explicitly", () => {
    expect(sumarDetalleConceptoEnRango(["10", "invalido"])).toEqual({
      estado: "monto_invalido",
    });
  });
});

describe("presentation helpers", () => {
  it("does not surface raw NaN for invalid sums", () => {
    const etiqueta = etiquetaSumaAcumulado({ estado: "monto_invalido" }, formatearMonto);
    expect(etiqueta.texto).toBe("—");
    expect(etiqueta.titulo).toMatch(/no válido/i);
    expect(etiqueta.resaltarAviso).toBe(true);
  });

  it("does not surface NaN% for invalid percentage denominators", () => {
    const etiqueta = etiquetaPctSobreVentasAcumulado({ estado: "ventas_invalidas" });
    expect(etiqueta?.texto).toBe("—");
    expect(etiqueta?.titulo).toMatch(/porcentaje/i);
  });

  it("omits percentage line when ventas are absent or zero", () => {
    expect(etiquetaPctSobreVentasAcumulado({ estado: "sin_ventas" })).toBeNull();
    expect(etiquetaPctSobreVentasAcumulado({ estado: "ventas_cero" })).toBeNull();
  });
});
