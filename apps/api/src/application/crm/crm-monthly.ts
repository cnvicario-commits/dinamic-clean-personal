export type MonthlyAggregate = { mes: string; categoria: string; cantidad: number };
export type MonthlySeries = { mes: string; total: number; categorias: { nombre: string; cantidad: number }[] };

const OTROS = "Otros";
const MAX_CATEGORIAS = 7;

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Last 12 calendar months through `now` when the caller omits a bound. */
export function monthlyWindow(
  desde: string | undefined,
  hasta: string | undefined,
  now: Date,
): { desde: string; hasta: string } {
  const hastaEfectiva = hasta ?? isoDate(now);
  if (desde) return { desde, hasta: hastaEfectiva };
  const inicio = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return { desde: isoDate(inicio), hasta: hastaEfectiva };
}

export function enumerateMonths(desde: string, hasta: string): string[] {
  const [anioDesde, mesDesde] = desde.slice(0, 7).split("-").map(Number);
  const [anioHasta, mesHasta] = hasta.slice(0, 7).split("-").map(Number);
  const meses: string[] = [];
  let anio = anioDesde ?? 0;
  let mes = mesDesde ?? 1;
  let guard = 0;
  while ((anio < (anioHasta ?? 0) || (anio === anioHasta && mes <= (mesHasta ?? 1))) && guard < 600) {
    meses.push(`${anio}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
    guard += 1;
  }
  return meses;
}

function fold(rows: MonthlyAggregate[], months: string[], top: string[]): MonthlySeries[] {
  const principales = new Set(top);
  return months.map((mes) => {
    const categorias = new Map<string, number>();
    for (const row of rows) {
      if (row.mes !== mes) continue;
      const nombre = principales.has(row.categoria) ? row.categoria : OTROS;
      categorias.set(nombre, (categorias.get(nombre) ?? 0) + row.cantidad);
    }
    const lista = [...categorias.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad }));
    return { mes, total: lista.reduce((sum, item) => sum + item.cantidad, 0), categorias: lista };
  });
}

export function fillMonthly(
  desde: string,
  hasta: string,
  creadas: MonthlyAggregate[],
  aceptadas: MonthlyAggregate[],
) {
  const meses = enumerateMonths(desde, hasta);
  const totales = new Map<string, number>();
  for (const row of [...creadas, ...aceptadas]) {
    totales.set(row.categoria, (totales.get(row.categoria) ?? 0) + row.cantidad);
  }
  const top = [...totales.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CATEGORIAS)
    .map(([nombre]) => nombre);
  const hayOtros = [...creadas, ...aceptadas].some((row) => !top.includes(row.categoria));
  return {
    desde,
    hasta,
    categorias: hayOtros ? [...top, OTROS] : top,
    creadas: fold(creadas, meses, top),
    aceptadas: fold(aceptadas, meses, top),
  };
}
