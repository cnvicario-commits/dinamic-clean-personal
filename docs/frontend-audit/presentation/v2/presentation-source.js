// Dinamic Clean — Auditoría UX/UI v2. Construido directamente con PptxGenJS (no desde HTML).
// Uso: NODE_PATH=<node_modules con pptxgenjs> node prepare-assets.js && node presentation-source.js
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

const REG = JSON.parse(fs.readFileSync(path.join(__dirname, "assets/registry.json")));
const IMG = (k) => path.join(__dirname, "assets", path.basename(REG[k].file));
const VID = (k) => path.join(__dirname, "videos", path.basename(REG[k].video));
const POS = (k) => path.join(__dirname, "videos", path.basename(REG[k].poster));

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in (16:9)
pres.title = "Dinamic Clean — Auditoría UX/UI";
pres.author = "Equipo de producto";
const F = "Arial";
const C = { navy: "0F172A", slate: "475569", mute: "94A3B8", line: "CBD5E1", bg: "F8FAFC", white: "FFFFFF", teal: "0D9488", tealL: "E3F4F1", coral: "E5484D", coralL: "FDECEC", amber: "D97706", amberL: "FEF3C7" };
const KIND = { hoy: ["PROBLEMA HOY", C.coral, 1.6], imp: ["IMPACTO", C.amber, 1.05], prop: ["PROPUESTA", C.teal, 1.25] };
let N = 0;

// ---------- primitivas ----------
const T = (s, t, x, y, w, h, o = {}) => s.addText(t, { x, y, w, h, fontFace: F, fontSize: 14, color: C.navy, margin: 0, valign: "top", ...o });
const box = (s, x, y, w, h, o = {}) => s.addShape(o.r ? pres.ShapeType.roundRect : pres.ShapeType.rect, {
  x, y, w, h, rectRadius: o.r,
  fill: o.fill ? { color: o.fill, transparency: o.tr || 0 } : { color: "FFFFFF", transparency: 100 },
  line: o.line ? { color: o.line, width: o.lw || 1, dashType: o.dash || "solid" } : { color: "FFFFFF", transparency: 100, width: 0 },
});
const chip = (s, t, x, y, w, h, o = {}) => s.addText(t, {
  shape: o.sq ? pres.ShapeType.rect : pres.ShapeType.roundRect, rectRadius: o.rr ?? 0.06, x, y, w, h, fontFace: F, fontSize: o.size || 12,
  bold: o.bold, italic: o.italic, color: o.color || C.navy, align: o.align || "center", valign: "middle", margin: o.m ?? 0.05,
  fill: o.fill ? { color: o.fill } : { color: "FFFFFF", transparency: 100 },
  line: o.line ? { color: o.line, width: o.lw || 1, dashType: o.dash || "solid" } : { color: "FFFFFF", transparency: 100, width: 0 },
});
const ln = (s, x1, y1, x2, y2, o = {}) => {
  const dx = x2 - x1, dy = y2 - y1;
  s.addShape(pres.ShapeType.line, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(dx) || 0.001, h: Math.abs(dy) || 0.001, flipH: dx < 0, flipV: dy < 0,
    line: { color: o.color || C.slate, width: o.w || 1.25, dashType: o.dash || "solid", endArrowType: o.arrow ? "triangle" : undefined },
  });
};
const num = (s, cx, cy, n, color = C.coral) => chip(s, String(n), cx - 0.17, cy - 0.17, 0.34, 0.34, { shape: 1, rr: 0.17, fill: C.white, line: color, lw: 2.25, color, bold: true, size: 12, m: 0 });
const tag = (s, kind, x, y) => { const [t, c, w] = KIND[kind]; chip(s, t, x, y, w, 0.28, { fill: c, color: C.white, bold: true, size: 10, rr: 0.14 }); };

function slide(kicker, title, notes, o = {}) {
  const s = pres.addSlide(); N++;
  s.background = { color: o.dark ? C.navy : C.bg };
  if (kicker) T(s, kicker.toUpperCase(), 0.5, 0.32, 10, 0.25, { fontSize: 11, bold: true, color: o.dark ? "5EEAD4" : C.teal, charSpacing: 2 });
  if (title) T(s, title, 0.5, 0.6, 12.3, 0.9, { fontSize: o.tsize || 26, bold: true, color: o.dark ? C.white : C.navy });
  T(s, "Dinamic Clean · Auditoría UX/UI", 0.5, 7.1, 6, 0.22, { fontSize: 9, color: o.dark ? "94A3B8" : C.mute });
  T(s, String(N), 12.33, 7.1, 0.5, 0.22, { fontSize: 9, color: o.dark ? "94A3B8" : C.mute, align: "right" });
  s.addNotes(notes);
  return s;
}

// Captura real + anotaciones (coordenadas en píxeles de la captura original)
function shot(s, key, x, y, size, ann = []) {
  const r = REG[key]; const k = size.w ? size.w / r.w : size.h / r.h; const W = r.w * k, H = r.h * k;
  s.addImage({ path: IMG(key), x, y, w: W, h: H, altText: "Captura de pantalla: " + key });
  box(s, x, y, W, H, { line: C.line, lw: 0.75 });
  const px = (v) => x + (v - r.ox) * k, py = (v) => y + (v - r.oy) * k;
  for (const a of ann) {
    const col = a.c === "teal" ? C.teal : C.coral;
    if (a.r) box(s, px(a.r[0]), py(a.r[1]), a.r[2] * k, a.r[3] * k, { fill: col, tr: 90, line: col, lw: 2, dash: a.dash });
    if (a.n && a.r) num(s, px(a.na ? a.na[0] : a.r[0]), py(a.na ? a.na[1] : a.r[1]), a.n, col);
    if (a.n && a.at) num(s, px(a.at[0]), py(a.at[1]), a.n, col);
    if (a.label) chip(s, a.label, px(a.at[0]), py(a.at[1]), a.w || 1.5, 0.27, { fill: col, color: C.white, bold: true, size: 10, rr: 0.05 });
    if (a.arrow) ln(s, px(a.arrow[0][0]), py(a.arrow[0][1]), px(a.arrow[1][0]), py(a.arrow[1][1]), { color: col, w: 1.5, arrow: true });
  }
  return { x, y, W, H, k, px, py };
}
// Lupa: recorte ampliado conectado con el área original
function zoom(s, p, key, srcRect, dx, dy, dw) {
  const r = REG[key]; const dh = dw * r.h / r.w;
  const a = [p.px(srcRect[0]), p.py(srcRect[1])], b = [p.px(srcRect[0] + srcRect[2]), p.py(srcRect[1] + srcRect[3])];
  ln(s, b[0], a[1], dx, dy, { color: C.coral, w: 1 }); ln(s, b[0], b[1], dx, dy + dh, { color: C.coral, w: 1 });
  s.addImage({ path: IMG(key), x: dx, y: dy, w: dw, h: dh, altText: "Zoom: " + key }); box(s, dx, dy, dw, dh, { line: C.coral, lw: 2.5 });
  return dh;
}
function video(s, key, x, y, w) {
  const h = w * 9 / 16; s.addMedia({ type: "video", path: VID(key), cover: "data:image/jpeg;base64," + fs.readFileSync(POS(key)).toString("base64"), x, y, w, h }); box(s, x, y, w, h, { line: C.line, lw: 0.75 }); return h;
}
const band = (s, t, x, y, w, h, kind = "hoy", size = 17) => {
  const c = kind === "prop" ? C.teal : kind === "imp" ? C.amber : C.coral;
  box(s, x, y, w, h, { fill: C.white, line: C.line, lw: 0.75 }); box(s, x, y, 0.09, h, { fill: c });
  T(s, t, x + 0.3, y, w - 0.5, h, { fontSize: size, bold: true, valign: "middle" });
};
const bullets = (s, items, x, y, w, rowH, color = C.coral, size = 13) => items.forEach((t, i) => {
  num(s, x + 0.17, y + i * rowH + rowH / 2, i + 1, color); T(s, t, x + 0.5, y + i * rowH, w - 0.5, rowH, { fontSize: size, valign: "middle" });
});
const nodeGraph = (s, nodes, edges, color, nw = 1.4) => {
  edges.forEach(([a, b]) => ln(s, nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, { color, w: 1 }));
  nodes.forEach((n) => chip(s, n.t, n.x - (n.w || nw) / 2, n.y - 0.19, n.w || nw, 0.38, { fill: n.fill || C.white, line: n.dash ? color : color, dash: n.dash ? "dash" : "solid", color: n.color || C.navy, size: 11, bold: n.bold }));
};

// =====================================================================
// ACTO 1 — Contexto
// =====================================================================
{ // 1 Portada
  const s = slide("", "", "Qué veo: la portada. Qué importa: esta presentación muestra lo que encontramos al recorrer la aplicación real. Qué proponemos: ordenar cómo crece Dinamic Clean, sin perder ninguna función.", { dark: true });
  T(s, "AUDITORÍA UX/UI", 0.7, 1.5, 6, 0.3, { fontSize: 13, bold: true, color: "5EEAD4", charSpacing: 3 });
  T(s, "Dinamic Clean", 0.7, 1.95, 6.2, 1.1, { fontSize: 54, bold: true, color: C.white });
  T(s, "Funciona. Creció agregando necesidades dentro de las mismas pantallas. Proponemos separar responsabilidades sin perder funcionalidades.", 0.7, 3.25, 5.9, 1.7, { fontSize: 18, color: "CBD5E1" });
  box(s, 0.7, 5.35, 0.8, 0.05, { fill: C.teal });
  T(s, "Qué encontramos · por qué importa · cómo ordenarlo", 0.7, 5.55, 6, 0.3, { fontSize: 12, color: "94A3B8" });
  T(s, "Octubre 2026", 0.7, 6.8, 3, 0.25, { fontSize: 11, color: "94A3B8" });
  const p = shot(s, "ventas", 7.1, 1.3, { w: 5.7 }, [{ r: [262, 152, 1160, 72], n: 1 }]);
  chip(s, "16 columnas", p.px(900), p.py(240), 1.3, 0.27, { fill: C.coral, color: C.white, bold: true, size: 10, rr: 0.05 });
  T(s, "Captura real del listado de Ventas", 7.1, 5.0, 5.7, 0.25, { fontSize: 10, color: "94A3B8" });
}
{ // 2 Qué hicimos
  const s = slide("Qué hicimos", "Recorrimos la aplicación como la usa una persona", "Qué veo: cuatro pasos de trabajo. Por qué importa: todo se apoya en pantallas reales, no en opiniones. Qué proponemos: leer el resto de la presentación con esta convención de colores: coral = problema hoy, ámbar = impacto, verde azulado = propuesta.");
  const st = [["1", "Recorrimos", "Cada módulo, en la aplicación real y en un ambiente de pruebas."], ["2", "Contamos", "Columnas, campos, botones y bloques que una persona ve a la vez."], ["3", "Grabamos", "Cinco recorridos cortos para ver el problema en movimiento."], ["4", "Propusimos", "Diseños ilustrativos para mostrar la dirección, no pantallas finales."]];
  st.forEach(([n, h, d], i) => { const x = 0.5 + i * 3.1; box(s, x, 1.75, 2.9, 2.7, { fill: C.white, line: C.line, lw: 0.75 }); box(s, x, 1.75, 2.9, 0.07, { fill: i === 3 ? C.teal : C.navy }); T(s, n, x + 0.25, 2.0, 1, 0.8, { fontSize: 40, bold: true, color: i === 3 ? C.teal : C.navy }); T(s, h, x + 0.25, 2.9, 2.5, 0.4, { fontSize: 20, bold: true }); T(s, d, x + 0.25, 3.4, 2.45, 0.95, { fontSize: 13, color: C.slate }); });
  T(s, "Cómo leer los colores", 0.5, 4.85, 5, 0.3, { fontSize: 13, bold: true, color: C.slate });
  [["hoy", "Lo que pasa hoy en pantalla"], ["imp", "Qué consecuencia tiene"], ["prop", "Qué proponemos"]].forEach(([k, d], i) => { tag(s, k, 0.5 + i * 4.4, 5.3); T(s, d, 0.5 + i * 4.4 + KIND[k][2] + 0.15, 5.3, 2.6, 0.28, { fontSize: 13, color: C.slate, valign: "middle" }); });
  band(s, "Todo se hizo en un ambiente de pruebas. No se modificó ninguna pantalla ni ningún dato.", 0.5, 6.0, 12.33, 0.7, "prop", 15);
}
{ // 3 Dinamic Clean funciona
  const s = slide("Punto de partida", "Dinamic Clean funciona", "Qué veo: los módulos que ya cubre la aplicación. Por qué importa: la propuesta no cuestiona que el sistema sirve; parte de ahí. Qué proponemos: conservar cada función y ordenar dónde vive.");
  T(s, "Resuelve necesidades reales de la operación, en un mismo lugar.", 0.5, 1.7, 12, 0.5, { fontSize: 20, color: C.slate });
  const mods = ["Ventas", "Clientes", "Empresas", "Resultados", "Usuarios", "Auditoría y Calidad", "RRHH", "Compras", "Dashboard"];
  mods.forEach((m, i) => { const col = i % 3, row = Math.floor(i / 3); chip(s, m, 0.5 + col * 2.75, 2.55 + row * 0.95, 2.55, 0.75, { fill: C.white, line: C.teal, lw: 1.5, size: 16, bold: true, color: C.navy }); });
  [["Cada módulo tiene un propósito claro de negocio.", "Ventas, compras, RRHH y auditoría ya tienen su lugar en el menú."], ["Las funciones existen.", "Buscar, crear, editar, exportar y reportar ya están resueltos."], ["Lo que hay que ordenar es otra cosa.", "Cómo se presentan juntas dentro de cada pantalla."]].forEach(([h, d], i) => { const y = 2.55 + i * 1.3; box(s, 9.0, y, 0.09, 1.05, { fill: C.teal }); T(s, h, 9.3, y, 3.5, 0.5, { fontSize: 15, bold: true }); T(s, d, 9.3, y + 0.5, 3.5, 0.6, { fontSize: 12, color: C.slate }); });
  band(s, "Nada de lo que hoy funciona se pierde.", 0.5, 5.9, 8.3, 0.75, "prop", 18);
}
{ // 4 Fue creciendo
  const s = slide("Cómo llegamos acá", "El sistema fue creciendo dentro de las mismas pantallas", "Qué veo: una pantalla simple que, etapa tras etapa, suma filtros, formularios y acciones. Por qué importa: cada necesidad nueva fue razonable, pero juntas compiten por atención. Qué proponemos: dar a cada función un lugar propio.");
  const mini = (x, st, hot) => {
    const y = 1.85, w = 2.7, h = 2.55; box(s, x, y, w, h, { fill: C.white, line: hot ? C.coral : C.line, lw: hot ? 2.25 : 1 }); box(s, x + 0.15, y + 0.15, 0.9, 0.09, { fill: C.navy });
    let cy = y + 0.4;
    if (st >= 3) { for (let i = 0; i < 3; i++) box(s, x + 0.15 + i * 0.85, cy, 0.75, 0.2, { line: C.teal, lw: 1 }); cy += 0.32; }
    if (st >= 2) { for (let i = 0; i < 4; i++) box(s, x + 0.15 + i * 0.64, cy, 0.55, 0.18, { fill: C.line }); cy += 0.3; }
    if (st >= 4) { for (let i = 0; i < 3; i++) box(s, x + 0.15 + i * 0.8, cy, 0.7, 0.2, { fill: hot ? C.coral : C.slate }); cy += 0.32; }
    while (cy < y + h - 0.2) { for (let i = 0; i < Math.min(st + 1, 5); i++) box(s, x + 0.15 + i * ((w - 0.3) / Math.min(st + 1, 5)), cy, (w - 0.3) / Math.min(st + 1, 5) - 0.06, 0.07, { fill: C.line }); cy += 0.21; }
  };
  const lab = ["Una lista", "+ filtros", "+ formulario de alta", "+ reportes y acciones"];
  lab.forEach((l, i) => { const x = 0.5 + i * 3.15; mini(x, i + 1, i === 3); T(s, `${i + 1} · ${l}`, x, 4.55, 2.7, 0.3, { fontSize: 13, bold: true, color: i === 3 ? C.coral : C.navy }); if (i < 3) ln(s, x + 2.78, 3.1, x + 3.07, 3.1, { color: C.slate, w: 2, arrow: true }); });
  T(s, "Cada necesidad nueva se sumó dentro de la misma pantalla.", 0.5, 5.0, 12, 0.4, { fontSize: 16, color: C.slate });
  band(s, "Dinamic Clean funciona, pero fue creciendo agregando necesidades dentro de las mismas pantallas y módulos.", 0.5, 5.7, 12.33, 0.95, "hoy", 18);
}
{ // 5 En números
  const s = slide("La aplicación hoy en números", "Lo que una persona encuentra en pantalla", "Qué veo: cinco cifras medidas en la aplicación. Por qué importa: son cosas que la persona tiene que mirar o decidir si ignorar. Qué proponemos: ayudar a encontrar antes que obligar a recorrer. Datos tomados en el ambiente de pruebas.");
  const d = [["16", "columnas", "en el listado de Ventas"], ["50", "oportunidades", "cargadas a la vez en ese listado"], ["113", "clientes", "en una única lista"], ["460", "artículos", "en un solo pedido de compra"], ["71", "novedades", "visibles antes del Kanban de Ventas"]];
  d.forEach(([n, u, c], i) => { const x = 0.5 + i * 2.5; box(s, x, 1.9, 2.35, 3.3, { fill: C.white, line: C.line, lw: 0.75 }); box(s, x, 1.9, 2.35, 0.07, { fill: C.coral }); T(s, n, x + 0.2, 2.2, 2, 1.1, { fontSize: 58, bold: true, color: C.coral }); T(s, u, x + 0.2, 3.35, 2, 0.4, { fontSize: 20, bold: true }); T(s, c, x + 0.2, 3.85, 2, 1.1, { fontSize: 13, color: C.slate }); });
  T(s, "Cifras verificadas en la aplicación real, ambiente de pruebas.", 0.5, 5.4, 9, 0.3, { fontSize: 12, color: C.slate });
  band(s, "No son errores. Son señales de que cada pantalla carga más de lo que una persona puede abarcar de una vez.", 0.5, 5.9, 12.33, 0.8, "hoy", 16);
}
{ // 6 Tres problemas
  const s = slide("Resumen de lo encontrado", "Tres problemas principales", "Qué veo: tres patrones que se repiten en varios módulos. Por qué importa: explican la mayor parte de lo que vimos. Qué proponemos: ninguno se resuelve agregando funciones; se resuelve ordenando.");
  const p = [["1", "Demasiado a la vez", "Muchas columnas, bloques y acciones compiten en una sola pantalla."], ["2", "Buscar no siempre es buscar en todo", "Los filtros actúan sobre lo que ya está cargado, no sobre todo."], ["3", "Cada módulo lo resuelve distinto", "Crear, buscar, listar y editar cambian de forma de un módulo a otro."]];
  p.forEach(([n, h, d], i) => { const x = 0.5 + i * 4.15; box(s, x, 1.8, 4.0, 3.7, { fill: C.white, line: C.line, lw: 0.75 }); box(s, x, 1.8, 4.0, 0.08, { fill: C.coral }); num(s, x + 0.55, 2.55, n); T(s, h, x + 0.3, 3.05, 3.4, 0.9, { fontSize: 20, bold: true }); T(s, d, x + 0.3, 4.05, 3.4, 1.3, { fontSize: 14, color: C.slate }); });
  band(s, "Ninguno es falta de funcionalidad. Son problemas de orden.", 0.5, 5.85, 12.33, 0.8, "hoy", 19);
}
{ // 7 Densidad
  const s = slide("¿Cuánta información recibe una persona al mismo tiempo?", "Contemos lo que hay en cada pantalla", "Qué veo: una cuenta visual por pantalla: columnas, campos, botones, bloques, filtros. Por qué importa: cada número es algo que la persona debe mirar o decidir ignorar antes de hacer su tarea. Qué proponemos: ver, módulo por módulo, cómo repartir esa carga.", { tsize: 26 });
  const rows = [
    ["Listado de Ventas", [["7", "destinos en el menú"], ["16", "columnas"], ["4", "filtros"], ["1", "exportación"]]],
    ["Tablero de Ventas", [["71", "novedades arriba"], ["4", "columnas de Kanban"], ["4", "botones de acción"], ["2", "filtros"]]],
    ["Empleados", [["6", "campos de alta"], ["6", "columnas"], ["25", "filas por página"], ["25", "«Dar de baja»"]]],
    ["Novedades", [["6", "tareas en una pantalla"], ["8", "campos del formulario"], ["3", "botones de reporte"], ["1", "listado"]]],
    ["Clientes", [["8", "campos de alta"], ["1", "buscador"], ["5", "columnas"], ["113", "clientes en la lista"]]],
  ];
  rows.forEach(([name, chips], r) => { const y = 1.65 + r * 0.98; box(s, 0.5, y, 12.33, 0.86, { fill: C.white, line: C.line, lw: 0.75 }); T(s, name, 0.7, y, 2.5, 0.86, { fontSize: 15, bold: true, valign: "middle" });
    chips.forEach(([n, l], i) => { const x = 3.3 + i * 2.38; T(s, n, x, y + 0.04, 0.95, 0.78, { fontSize: 30, bold: true, color: C.coral, valign: "middle", align: "right" }); T(s, l, x + 1.05, y, 1.25, 0.86, { fontSize: 11, color: C.slate, valign: "middle" }); }); });
  T(s, "Conteo sobre capturas reales de la aplicación.", 0.5, 6.6, 8, 0.25, { fontSize: 11, color: C.slate });
}

// =====================================================================
// ACTO 2 — Evidencia por módulo
// =====================================================================
{ // 8 Ventas: buscar ≠ buscar en todo + video
  const s = slide("Ventas · Búsqueda", "Buscar en pantalla no es lo mismo que buscar en todo", "Qué veo: en el listado de Ventas, al escribir «limpieza» el listado se reduce a 8 resultados. Por qué importa: la persona puede creer que ve todas las oportunidades cuando está viendo solo las 50 que ya estaban cargadas. Qué proponemos: que el filtro consulte siempre todas las oportunidades y que lo diga con claridad.");
  const flow = (y, kind, a, b, c, col) => { tag(s, kind, 0.5, y - 0.45); [[a, 0], [b, 1], [c, 2]].forEach(([t, i]) => { const x = 0.5 + i * 2.15; chip(s, t, x, y, 1.75, 1.0, { fill: i === 1 ? C.white : (kind === "prop" ? C.tealL : C.coralL), line: col, lw: 1.5, size: 13, bold: true }); if (i < 2) ln(s, x + 1.78, y + 0.5, x + 2.12, y + 0.5, { color: col, w: 2, arrow: true }); }); };
  flow(2.2, "hoy", "50 registros cargados", "Filtro actual", "8 resultados", C.coral);
  T(s, "Solo se filtra lo que ya está en pantalla.", 0.5, 3.3, 6, 0.3, { fontSize: 12, color: C.coral, bold: true });
  flow(4.4, "prop", "TODAS las oportunidades", "Responsable = María · Estado = Seguimiento", "Resultado correcto", C.teal);
  T(s, "El filtro siempre busca en todo.", 0.5, 5.5, 6, 0.3, { fontSize: 12, color: C.teal, bold: true });
  video(s, "clip-01-ventas", 7.0, 1.75, 5.83);
  T(s, "Video 1 · Escribir «limpieza» en el listado de Ventas", 7.0, 5.1, 5.83, 0.3, { fontSize: 12, bold: true });
  T(s, "El listado pasa a 8 resultados, dentro de las 50 oportunidades ya cargadas.", 7.0, 5.45, 5.83, 0.6, { fontSize: 12, color: C.slate });
  band(s, "Primero hay que saber dónde se busca. Recién después, cuánto se muestra.", 0.5, 6.15, 12.33, 0.65, "prop", 15);
}
{ // 9 Paginado vs búsqueda
  const s = slide("Clientes · Paginado y búsqueda", "Paginar y buscar resuelven cosas distintas", "Qué veo: la lista de 113 clientes; al buscar «banco» quedan 2. Por qué importa: si se pagina antes de buscar, la persona recorre páginas que no necesita. Qué proponemos: primero encontrar el resultado correcto y después decidir cuánto mostrar.");
  const st = [["113", "clientes", C.slate], ["Banco", "filtro", C.teal], ["2", "clientes", C.teal], ["Página 1", "de 1", C.slate]];
  st.forEach(([a, b, col], i) => { const x = 0.5 + i * 3.15; box(s, x, 1.9, 2.7, 1.9, { fill: C.white, line: col, lw: 2 }); T(s, a, x, 2.2, 2.7, 0.9, { fontSize: 38, bold: true, color: col, align: "center" }); T(s, b, x, 3.15, 2.7, 0.4, { fontSize: 16, color: C.slate, align: "center" }); if (i < 3) ln(s, x + 2.75, 2.85, x + 3.1, 2.85, { color: C.teal, w: 2.5, arrow: true }); });
  box(s, 0.5, 4.2, 6.0, 1.5, { fill: C.white, line: C.line }); T(s, "Paginar", 0.8, 4.35, 5.4, 0.4, { fontSize: 14, bold: true, color: C.slate }); T(s, "define cuánto mostramos.", 0.8, 4.8, 5.4, 0.6, { fontSize: 22, bold: true });
  box(s, 6.83, 4.2, 6.0, 1.5, { fill: C.tealL, line: C.teal }); T(s, "Buscar", 7.13, 4.35, 5.4, 0.4, { fontSize: 14, bold: true, color: C.teal }); T(s, "define qué estamos buscando.", 7.13, 4.8, 5.4, 0.6, { fontSize: 22, bold: true });
  band(s, "Primero encontramos el resultado correcto. Después decidimos cuánto mostrar.", 0.5, 6.0, 12.33, 0.75, "prop", 18);
}
{ // 10 Ventas anotado
  const s = slide("Ventas · Listado", "Ventas: muchas cosas compitiendo por atención", "Qué veo: el listado de oportunidades con siete destinos en el menú, cuatro filtros, exportación y dieciséis columnas. Por qué importa: antes de leer una sola oportunidad la persona ya procesó mucho. Qué proponemos: columnas clave en la lista, el resto en la ficha.");
  shot(s, "ventas", 0.5, 1.65, { w: 8.0 }, [
    { r: [20, 322, 200, 296], n: 1 }, { r: [262, 62, 830, 50], n: 2 }, { r: [1276, 64, 148, 48], n: 3 }, { r: [262, 152, 1160, 72], n: 4 },
    { label: "16 columnas →", at: [1020, 232], w: 1.3 }]);
  bullets(s, ["7 destinos en el menú de Ventas", "4 filtros de búsqueda", "Exportar a Excel siempre visible", "16 columnas (siguen más allá del borde)"], 8.9, 1.75, 3.95, 0.62, C.coral, 13);
  tag(s, "hoy", 8.9, 4.4);
  T(s, "50 oportunidades cargadas a la vez.", 8.9, 4.8, 3.9, 0.3, { fontSize: 12, color: C.slate });
  band(s, "El módulo no tiene poca funcionalidad. Tiene demasiadas cosas compitiendo por atención.", 8.9, 5.3, 3.93, 1.35, "hoy", 14);
}
{ // 11 Tablero 71
  const s = slide("Ventas · Tablero", "Antes del trabajo principal hay otra capa de información", "Qué veo: el Tablero abre con un bloque de 71 novedades, luego filtros y botones, y recién después el Kanban de cuatro columnas. Por qué importa: la persona atraviesa otra capa completa antes de llegar al trabajo comercial. Qué proponemos: no quitar las novedades, sino separar seguimiento, alertas y trabajo comercial.");
  shot(s, "tablero", 0.5, 1.6, { h: 5.35 }, [{ r: [10, 104, 1162, 366], n: 1 }, { r: [8, 548, 1160, 48], n: 2 }, { r: [8, 620, 1160, 600], n: 3, c: "teal" }]);
  const x0 = 5.9; tag(s, "hoy", x0, 1.65);
  [["1", "Novedades (71)", "Alertas y seguimiento, lo primero que se ve.", C.coral], ["2", "Filtros y botones", "Agenda · Ver listado · Resumen ejecutivo · Nueva oportunidad.", C.coral], ["3", "Kanban de 4 columnas", "El trabajo comercial, recién acá.", C.teal]].forEach(([n, h, d, col], i) => {
    const y = 2.1 + i * 1.12; box(s, x0, y, 6.9, 0.98, { fill: C.white, line: C.line, lw: 0.75 }); num(s, x0 + 0.4, y + 0.49, n, col); T(s, h, x0 + 0.85, y + 0.1, 5.8, 0.35, { fontSize: 15, bold: true }); T(s, d, x0 + 0.85, y + 0.48, 5.8, 0.45, { fontSize: 12, color: C.slate }); });
  band(s, "Antes de llegar al trabajo principal, el usuario atraviesa otra capa completa de información.", x0, 5.5, 6.9, 0.8, "hoy", 14);
  tag(s, "prop", x0, 6.45); T(s, "Separar información de seguimiento, alertas y trabajo comercial. Las novedades se mantienen.", x0 + 1.4, 6.42, 5.5, 0.5, { fontSize: 12, color: C.slate });
}
{ // 12 Desacople Ventas
  const s = slide("Ventas · Separar responsabilidades", "Las funciones siguen existiendo. Lo que cambia es dónde viven", "Qué veo: a la izquierda, todo conectado en una sola pantalla. A la derecha, la misma lista de funciones repartida en espacios con un propósito. Por qué importa: cambiar una función hoy puede afectar otras que viven en la misma pantalla. Qué proponemos: Ventas se organiza en Trabajo, Agenda, Leads y Facturación; «Nueva oportunidad» pasa a ser una acción dentro del trabajo.");
  box(s, 0.5, 1.6, 6.0, 4.6, { fill: C.white, line: C.line, lw: 0.75 }); box(s, 6.83, 1.6, 6.0, 4.6, { fill: C.white, line: C.line, lw: 0.75 });
  tag(s, "hoy", 0.7, 1.75); tag(s, "prop", 7.03, 1.75);
  const names = ["Novedades", "Kanban", "Listado", "Agenda", "Resumen", "Nueva oportunidad", "Seguimiento", "Export."];
  const cx = 3.5, cy = 3.95, rx = 2.15, ry = 1.35;
  const hn = names.map((t, i) => ({ t, x: cx + rx * Math.cos(i * Math.PI / 4), y: cy + ry * Math.sin(i * Math.PI / 4), w: t === "Nueva oportunidad" ? 1.7 : 1.3 }));
  hn.push({ t: "Ventas · todo en uno", x: cx, y: cy, w: 1.9, fill: C.coralL, bold: true });
  const he = []; for (let i = 0; i < 8; i++) { he.push([8, i]); he.push([i, (i + 1) % 8]); } he.push([0, 4], [2, 6], [1, 5], [3, 7]);
  nodeGraph(s, hn, he, C.coral);
  const pn = [{ t: "Ventas", x: 7.95, y: 4.1, w: 1.3, fill: C.tealL, bold: true }, { t: "Trabajo", x: 9.75, y: 2.75, w: 1.5, fill: C.tealL, bold: true }, { t: "Agenda", x: 9.75, y: 3.8, w: 1.5 }, { t: "Leads", x: 9.75, y: 4.85, w: 1.5 }, { t: "Facturación", x: 9.75, y: 5.65, w: 1.5 },
    { t: "Lista", x: 11.65, y: 2.45, w: 0.95 }, { t: "Kanban", x: 11.65, y: 2.9, w: 0.95 }, { t: "+ Nueva oportunidad", x: 11.75, y: 3.4, w: 1.7, dash: true }];
  nodeGraph(s, pn, [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [1, 6], [1, 7]], C.teal);
  T(s, "Todo conectado con todo", 0.7, 5.8, 5.6, 0.3, { fontSize: 12, color: C.coral, bold: true, align: "center" });
  T(s, "«Nueva oportunidad» es una acción dentro del trabajo", 7.03, 5.85, 5.6, 0.3, { fontSize: 11, color: C.teal, bold: true });
  band(s, "Las funciones siguen existiendo. Lo que cambia es dónde viven.", 0.5, 6.35, 12.33, 0.6, "prop", 17);
}
{ // 13 Clientes + video
  const s = slide("Clientes", "Crear, buscar y listar conviven en la misma pantalla", "Qué veo: arriba un formulario de ocho campos, luego el buscador y debajo 113 clientes. Por qué importa: quien solo quiere buscar ve primero un formulario de alta, y quien quiere crear ve una lista. Qué proponemos: un listado para encontrar y una pantalla propia para crear.");
  shot(s, "clientes", 0.5, 1.65, { w: 7.2 }, [{ r: [416, 96, 848, 104], n: 1 }, { r: [415, 231, 386, 40], n: 2 }, { r: [416, 318, 848, 582], n: 3 }]);
  tag(s, "hoy", 0.5, 6.25);
  T(s, "① Alta  ·  ② Búsqueda  ·  ③ Lista de 113 clientes", 2.2, 6.22, 5.5, 0.32, { fontSize: 12, color: C.slate, valign: "middle" });
  video(s, "clip-02-pantallas-mezcladas", 8.0, 1.75, 4.83);
  T(s, "Video 2 · Funciones mezcladas en una misma pantalla", 8.0, 4.6, 4.83, 0.3, { fontSize: 12, bold: true });
  band(s, "Cada tarea necesita su propio momento: encontrar, crear, editar.", 8.0, 5.1, 4.83, 1.2, "prop", 14);
}
{ // 14 Empleados
  const s = slide("RRHH · Empleados", "Una lista extensa obliga a recorrer", "Qué veo: un formulario de alta, búsqueda y filtros arriba, y debajo 265 empleados con «Dar de baja» repetido en cada fila. Por qué importa: la información secundaria compite con la tarea principal, que es encontrar a una persona. Qué proponemos: búsqueda y filtros claros, detalle fuera de la tabla y acciones secundarias en un menú. Nombres y CUIL de la captura están reemplazados.");
  shot(s, "empleados", 0.5, 1.6, { w: 6.6 }, [{ r: [351, 96, 978, 83], n: 1 }, { r: [351, 208, 647, 89], n: 2 }, { r: [353, 344, 974, 46], n: 3 }, { r: [1172, 396, 100, 600], n: 4 }, { r: [351, 312, 110, 22], n: 5, na: [470, 323] }]);
  const x0 = 7.45; tag(s, "hoy", x0, 1.6);
  bullets(s, ["Formulario de alta sobre la lista", "Búsqueda y filtros", "6 columnas con datos secundarios", "«Dar de baja» repetido en cada fila", "265 empleados, 25 por página"], x0, 1.95, 5.4, 0.36, C.coral, 12);
  tag(s, "prop", x0, 3.95);
  box(s, x0, 4.3, 5.38, 2.05, { fill: C.white, line: C.teal, lw: 1.25 });
  chip(s, "Buscar empleado…", x0 + 0.15, 4.42, 2.6, 0.3, { line: C.line, size: 10, color: C.mute, align: "left", sq: true });
  ["Estado", "Asignación", "Contrato"].forEach((t, i) => chip(s, t + " ▾", x0 + 2.9 + i * 0.82, 4.42, 0.78, 0.3, { line: C.teal, size: 9, color: C.teal, sq: true, m: 0 }));
  T(s, "148 resultados (ejemplo)", x0 + 0.15, 4.8, 3, 0.25, { fontSize: 10, color: C.slate, bold: true });
  for (let i = 0; i < 3; i++) { const y = 5.1 + i * 0.36; box(s, x0 + 0.15, y, 5.08, 0.01, { fill: C.line }); T(s, ["Empleado 001", "Empleado 002", "Empleado 003"][i], x0 + 0.2, y + 0.04, 2, 0.28, { fontSize: 11, valign: "middle" }); T(s, "Ver ficha ›", x0 + 3.4, y + 0.04, 1.2, 0.28, { fontSize: 10, color: C.teal, valign: "middle" }); T(s, "⋯", x0 + 4.8, y + 0.04, 0.35, 0.28, { fontSize: 14, valign: "middle", bold: true }); }
  band(s, "Cuando una lista crece, necesitamos ayudar a encontrar, no obligar a recorrer.", 0.5, 6.5, 12.33, 0.5, "prop", 15);
}
{ // 15 Pedido 460 + video
  const s = slide("Compras · Nuevo pedido", "Para pedir tres productos hay que pasar por 460", "Qué veo: el formulario de pedido muestra todo el catálogo, con dos campos por cada artículo. Por qué importa: el objetivo real es pedir pocos productos, pero la pantalla pone todo el catálogo delante. Qué proponemos: buscar y agregar solo las líneas del pedido.");
  const p = shot(s, "pedido", 0.5, 1.6, { w: 5.8 }, [{ r: [416, 134, 848, 178], n: 1 }, { r: [416, 343, 245, 22], n: 2, na: [672, 354] }, { r: [416, 374, 848, 39], n: 3 }, { r: [1007, 439, 240, 461], n: 4 }]);
  T(s, "① Datos del pedido  ② 460 artículos  ③ Buscador  ④ Dos campos por fila", 0.5, 6.1, 6.1, 0.3, { fontSize: 11, color: C.slate });
  video(s, "clip-03-pedido", 6.95, 1.6, 5.88);
  box(s, 6.95, 5.1, 2.85, 1.15, { fill: C.tealL, line: C.teal }); T(s, "Objetivo real", 7.1, 5.18, 2.6, 0.3, { fontSize: 11, bold: true, color: C.teal }); T(s, "Pedir 3 productos", 7.1, 5.5, 2.6, 0.6, { fontSize: 18, bold: true });
  box(s, 9.98, 5.1, 2.85, 1.15, { fill: C.coralL, line: C.coral }); T(s, "Pantalla actual", 10.13, 5.18, 2.6, 0.3, { fontSize: 11, bold: true, color: C.coral }); T(s, "460 productos disponibles", 10.13, 5.5, 2.6, 0.7, { fontSize: 18, bold: true });
  band(s, "460 artículos × 2 campos por fila. La carga está en lo que se muestra, no en lo que se necesita.", 0.5, 6.4, 12.33, 0.6, "hoy", 15);
}
{ // 16 Novedades + video
  const s = slide("RRHH · Novedades", "Seis tareas comparten una única pantalla", "Qué veo: registrar una novedad, bajar dos reportes, ver el listado, exportar y paginar, todo en una misma página. Por qué importa: tareas con propósitos distintos compiten por atención. Qué proponemos: separar registrar, reportar y consultar. En este ambiente el listado de novedades está vacío.");
  shot(s, "novedades", 0.5, 1.6, { h: 5.3 }, [{ r: [416, 96, 848, 772], n: 1 }, { r: [682, 940, 209, 50], n: 2, na: [905, 965] }, { r: [682, 1004, 239, 48], n: 3, na: [935, 1028] }, { r: [416, 1104, 848, 90], n: 4 }, { r: [1129, 1098, 135, 38], n: 5 }, { r: [416, 1202, 848, 28], n: 6 }]);
  T(s, "Seis tareas\ncompiten por\natención.", 5.55, 1.75, 2.3, 1.7, { fontSize: 22, bold: true, color: C.coral });
  video(s, "clip-04-novedades", 8.0, 1.65, 4.83);
  T(s, "Video 4 · Recorrido de la pantalla de Novedades", 8.0, 4.45, 4.83, 0.3, { fontSize: 12, bold: true });
  const L = ["Registrar novedad", "Reporte Bejerman", "Reporte horas extra", "Listado", "Exportar", "Paginación"];
  L.forEach((t, i) => { const col = i % 2, row = Math.floor(i / 2); const x = 5.55 + col * 3.7, y = 4.95 + row * 0.62; num(s, x + 0.17, y + 0.2, i + 1); T(s, t, x + 0.5, y, 3.0, 0.4, { fontSize: 13, valign: "middle" }); });
  box(s, 5.55, 4.8, 7.28, 0.01, { fill: C.line });
  tag(s, "prop", 5.55, 6.75); T(s, "Registrar, reportar y consultar, cada uno en su lugar.", 6.95, 6.72, 5.8, 0.3, { fontSize: 12, color: C.slate, valign: "middle" });
}
{ // 17 Invalid Date
  const s = slide("Auditoría y Calidad · Dashboard", "Un dato incorrecto llega directamente a una pantalla operativa", "Qué veo: en el ranking de auditorías, la columna Fecha muestra «Invalid Date» en cuatro filas. Por qué importa: baja la confianza en lo que se ve y cuesta leer el historial. Qué proponemos: no es que el sistema esté roto; es un ejemplo visible de por qué necesitamos ordenar cómo cada módulo presenta y valida la información.", { tsize: 24 });
  const p = shot(s, "dash", 0.5, 1.65, { w: 6.6 }, [{ r: [288, 534, 127, 211], n: 1 }]);
  zoom(s, p, "zoom-dash", [288, 534, 127, 211], 7.55, 1.7, 2.7);
  tag(s, "imp", 10.55, 1.7);
  [["Baja la confianza", "en lo que muestra la pantalla"], ["Cuesta leer el historial", "de auditorías"]].forEach(([h, d], i) => { const y = 2.15 + i * 1.15; box(s, 10.55, y, 2.28, 1.0, { fill: C.amberL, line: C.amber, lw: 0.75 }); T(s, h, 10.67, y + 0.1, 2.1, 0.4, { fontSize: 12, bold: true }); T(s, d, 10.67, y + 0.58, 2.1, 0.4, { fontSize: 11, color: C.slate }); });
  chip(s, "Invalid Date × 4", 7.55, 5.45, 2.7, 0.3, { fill: C.coral, color: C.white, bold: true, size: 11, rr: 0.05 });
  band(s, "Es un ejemplo visible de por qué necesitamos ordenar cómo cada módulo presenta y valida la información.", 7.55, 5.9, 5.28, 1.0, "prop", 12);
}
{ // 18 Dashboard densidad
  const s = slide("Auditoría y Calidad · Dashboard", "Indicadores, alertas, detalle y análisis en una sola pasada", "Qué veo: cinco indicadores, cuatro estados de planificación, un ranking y una tabla de conformidad por ítem en la misma pantalla. Por qué importa: la persona no sabe por dónde empezar. Qué proponemos: partir de la decisión que debe tomar y mostrar primero eso.");
  shot(s, "dash", 0.5, 1.6, { w: 7.0 }, [{ r: [288, 179, 1104, 133], n: 1 }, { r: [288, 378, 1104, 82], n: 2 }, { r: [288, 524, 1104, 226], n: 3 }, { r: [288, 813, 1104, 287], n: 4 }]);
  const x0 = 8.0; tag(s, "hoy", x0, 1.65);
  bullets(s, ["5 indicadores y alertas", "4 estados de planificación", "Ranking de menor cumplimiento", "Conformidad por ítem"], x0, 2.05, 4.8, 0.55, C.coral, 13);
  box(s, x0, 4.5, 4.83, 2.0, { fill: C.navy });
  T(s, "La pregunta que ordena\ntodo diseño:", x0 + 0.3, 4.65, 4.3, 0.7, { fontSize: 12, color: "5EEAD4", bold: true });
  T(s, "¿Qué decisión tiene que tomar el usuario en esta pantalla?", x0 + 0.3, 5.3, 4.3, 1.1, { fontSize: 18, bold: true, color: C.white });
}
{ // 19 Planificación
  const s = slide("Auditoría y Calidad · Planificación", "La tabla intenta ser listado, detalle y panel de acciones", "Qué veo: ocho planificaciones con fechas «Invalid Date» y las acciones Cargar auditoría, Editar y Cancelar a la vista, cortadas en el borde derecho. Por qué importa: la tabla hace tres trabajos a la vez. Qué proponemos: una tabla corta para encontrar y una ficha para actuar. Sitio y domicilio de la captura están difuminados.");
  shot(s, "plan", 0.5, 1.6, { w: 6.6 }, [{ r: [353, 188, 976, 61], n: 1 }, { r: [735, 285, 100, 700], n: 2 }, { r: [1110, 785, 225, 140], n: 3 }]);
  const x0 = 7.9; tag(s, "hoy", x0, 1.65);
  bullets(s, ["Muchas columnas en una sola tabla", "«Invalid Date» en las fechas", "Cargar auditoría · Editar · Cancelar a la vista, cortadas en el borde"], x0, 2.05, 4.9, 0.55, C.coral, 12);
  tag(s, "prop", x0, 4.0);
  box(s, x0, 4.35, 2.2, 1.9, { fill: C.white, line: C.teal, lw: 1.25 }); T(s, "Tabla corta", x0 + 0.12, 4.42, 2, 0.25, { fontSize: 10, bold: true, color: C.teal });
  ["Cliente · Fecha · Estado", "Cliente · Fecha · Estado", "Cliente · Fecha · Estado"].forEach((t, i) => { box(s, x0 + 0.12, 4.75 + i * 0.4, 1.96, 0.01, { fill: C.line }); T(s, t, x0 + 0.12, 4.78 + i * 0.4, 2, 0.3, { fontSize: 9, color: C.slate }); });
  ln(s, x0 + 2.25, 5.3, x0 + 2.65, 5.3, { color: C.teal, w: 2.5, arrow: true });
  box(s, x0 + 2.7, 4.35, 2.2, 1.9, { fill: C.white, line: C.teal, lw: 1.25 }); T(s, "Ficha", x0 + 2.82, 4.42, 2, 0.25, { fontSize: 10, bold: true, color: C.teal });
  T(s, "Detalle de la planificación", x0 + 2.82, 4.72, 1.98, 0.5, { fontSize: 10, color: C.slate });
  ["Cargar auditoría", "Editar", "Cancelar"].forEach((t, i) => chip(s, t, x0 + 2.82, 5.2 + i * 0.33, 1.2, 0.28, { fill: i === 0 ? C.teal : C.white, line: C.teal, color: i === 0 ? C.white : C.teal, size: 9, sq: true }));
  band(s, "Una tabla para encontrar. Una ficha para actuar.", 0.5, 6.4, 12.33, 0.55, "prop", 16);
}

// =====================================================================
// ACTO 3 — El concepto
// =====================================================================
{ // 20 No es la cantidad
  const s = slide("La idea central", "El problema no es la cantidad de funciones", "Qué veo: una función no es un problema; el problema aparece cuando funciones distintas se mezclan en un mismo lugar. Por qué importa: eso cambia la conversación, porque no proponemos quitar nada. Qué proponemos: ordenar, no recortar.");
  const eq = (y, a, op, b, ca, cb, fa, fb) => { chip(s, a, 0.5, y, 3.6, 1.1, { fill: fa, line: ca, lw: 2, size: 18, bold: true, color: ca }); T(s, op, 4.15, y, 0.9, 1.1, { fontSize: 44, bold: true, align: "center", valign: "middle", color: C.slate }); chip(s, b, 5.1, y, 3.6, 1.1, { fill: fb, line: cb, lw: 2, size: 18, bold: true, color: cb }); };
  eq(1.8, "FUNCIÓN", "≠", "PROBLEMA", C.teal, C.coral, C.tealL, C.coralL);
  eq(3.4, "FUNCIONES MEZCLADAS", "=", "CARGA", C.coral, C.coral, C.coralL, C.coralL);
  // ilustración: todo junto vs. agrupado
  box(s, 9.2, 1.8, 3.63, 2.0, { fill: C.white, line: C.coral, lw: 1.5 }); T(s, "Mezcladas", 9.35, 1.88, 3, 0.25, { fontSize: 11, bold: true, color: C.coral });
  const cols = [C.teal, C.navy, C.amber, C.slate, C.coral]; for (let i = 0; i < 15; i++) box(s, 9.4 + (i % 5) * 0.62 + (i % 3) * 0.04, 2.3 + Math.floor(i / 5) * 0.48 + (i % 2) * 0.05, 0.5, 0.36, { fill: cols[(i * 2) % 5], r: 0.04 });
  box(s, 9.2, 4.0, 3.63, 2.0, { fill: C.white, line: C.teal, lw: 1.5 }); T(s, "Separadas", 9.35, 4.08, 3, 0.25, { fontSize: 11, bold: true, color: C.teal });
  for (let g = 0; g < 3; g++) for (let i = 0; i < 5; i++) box(s, 9.4 + g * 1.1, 4.45 + i * 0.28, 0.95, 0.2, { fill: cols[g], r: 0.03 });
  band(s, "Mantenemos todas las funciones. Cambiamos dónde vive cada una.", 0.5, 5.4, 8.2, 0.9, "prop", 17);
}
{ // 21 Separar responsabilidades
  const s = slide("La idea central", "Separar responsabilidades", "Qué veo: cinco espacios, cada uno con una sola tarea. Por qué importa: cuando una pantalla tiene un propósito claro, la persona sabe qué hacer. Qué proponemos: Lista para encontrar, Ficha para entender, Editar para cambiar, Reporte para analizar y Dashboard para decidir.");
  [["Lista", "encontrar"], ["Ficha", "entender"], ["Editar", "cambiar"], ["Reporte", "analizar"], ["Dashboard", "decidir"]].forEach(([a, b], i) => { const x = 0.5 + i * 2.5; box(s, x, 1.85, 2.3, 3.3, { fill: C.white, line: C.line, lw: 0.75 }); box(s, x, 1.85, 2.3, 0.08, { fill: C.teal }); T(s, a, x + 0.2, 2.25, 1.95, 0.5, { fontSize: 22, bold: true }); T(s, "sirve para", x + 0.2, 3.0, 1.95, 0.3, { fontSize: 12, color: C.slate }); T(s, b, x + 0.2, 3.35, 1.95, 0.6, { fontSize: 26, bold: true, color: C.teal }); if (i < 4) ln(s, x + 2.32, 3.5, x + 2.48, 3.5, { color: C.mute, w: 1.5 }); });
  band(s, "Cada pantalla tiene un propósito claro. La persona sabe qué hacer en cada una.", 0.5, 5.55, 12.33, 0.9, "prop", 18);
}
{ // 22 Antes/propuesta diagramas
  const s = slide("La idea central", "Cuando todo depende de todo, cualquier cambio afecta más lugares", "Qué veo: a la izquierda, siete piezas conectadas entre sí; a la derecha, las mismas piezas con relaciones claras. Por qué importa: un cambio chico en un sistema enredado toca muchos lugares. Qué proponemos: cada parte con un propósito claro, pero conectada con las demás.", { tsize: 24 });
  box(s, 0.5, 1.6, 6.0, 4.5, { fill: C.white, line: C.line, lw: 0.75 }); box(s, 6.83, 1.6, 6.0, 4.5, { fill: C.white, line: C.line, lw: 0.75 });
  tag(s, "hoy", 0.7, 1.75); tag(s, "prop", 7.03, 1.75);
  const nm = ["Listado", "Ficha", "Nuevo", "Editar", "Reportes", "Dashboard", "Acciones"];
  const a = nm.map((t, i) => ({ t, x: 3.5 + 2.1 * Math.cos(i * 2 * Math.PI / 7 - Math.PI / 2), y: 3.85 + 1.25 * Math.sin(i * 2 * Math.PI / 7 - Math.PI / 2), w: 1.25 }));
  const ae = []; for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) ae.push([i, j]);
  nodeGraph(s, a, ae, C.coral);
  const b = [{ t: "Listado", x: 8.4, y: 3.9, w: 1.3, fill: C.tealL, bold: true }, { t: "Ficha", x: 10.5, y: 2.9, w: 1.3, fill: C.tealL, bold: true }, { t: "Nuevo", x: 8.4, y: 5.2, w: 1.3 }, { t: "Editar", x: 12.0, y: 4.2, w: 1.1 }, { t: "Reportes", x: 10.5, y: 5.3, w: 1.3 }, { t: "Dashboard", x: 12.0, y: 5.3, w: 1.1 }];
  nodeGraph(s, b, [[0, 1], [0, 2], [1, 3], [0, 4], [4, 5]], C.teal);
  T(s, "Cuando todo depende de todo, cualquier cambio afecta más lugares.", 0.7, 5.55, 5.6, 0.5, { fontSize: 12, color: C.coral, bold: true, align: "center" });
  T(s, "Cada parte tiene un propósito claro, pero sigue conectada con las demás.", 7.03, 5.55, 5.6, 0.5, { fontSize: 12, color: C.teal, bold: true, align: "center" });
  band(s, "Mismas funciones. Relaciones claras.", 0.5, 6.3, 12.33, 0.6, "prop", 17);
}
{ // 23 Lenguaje común
  const s = slide("Un lenguaje común", "Hoy cada módulo resuelve lo mismo de otra manera", "Qué veo: Clientes y Empleados hacen lo mismo (crear, buscar, listar, accionar) pero lo ordenan distinto. Por qué importa: quien aprende un módulo no puede reutilizar lo aprendido. Qué proponemos: un patrón único: Listado, Ficha, Nuevo y Editar.");
  tag(s, "hoy", 0.5, 1.65);
  shot(s, "clientes", 0.5, 2.05, { w: 3.0 }, [{ r: [416, 96, 848, 104] }, { r: [415, 231, 386, 40] }, { r: [416, 318, 848, 582] }]);
  shot(s, "empleados", 3.65, 2.05, { w: 3.0 }, [{ r: [351, 96, 978, 83] }, { r: [351, 208, 647, 89] }, { r: [353, 344, 974, 650] }]);
  T(s, "Clientes", 0.5, 4.3, 3, 0.3, { fontSize: 13, bold: true }); T(s, "Alta · buscador · lista", 0.5, 4.6, 3, 0.3, { fontSize: 11, color: C.slate });
  T(s, "Empleados", 3.65, 4.3, 3, 0.3, { fontSize: 13, bold: true }); T(s, "Alta · 3 filtros · lista · baja en cada fila", 3.65, 4.6, 3, 0.5, { fontSize: 11, color: C.slate });
  tag(s, "prop", 7.2, 1.65);
  [["Listado", "encontrar", 0], ["Ficha", "entender", 1], ["Nuevo / Editar", "cambiar", 2]].forEach(([a, b, i]) => { const x = 7.2 + i * 1.95; chip(s, a, x, 2.15, 1.7, 0.9, { fill: C.tealL, line: C.teal, lw: 1.5, size: 14, bold: true }); T(s, b, x, 3.1, 1.7, 0.3, { fontSize: 12, color: C.teal, bold: true, align: "center" }); if (i < 2) ln(s, x + 1.73, 2.6, x + 1.92, 2.6, { color: C.teal, w: 2, arrow: true }); });
  T(s, "El mismo patrón para Clientes, Empleados, Empresas y Proveedores.", 7.2, 3.7, 5.6, 0.6, { fontSize: 14, color: C.slate });
  band(s, "Quien aprende un módulo ya sabe usar los demás.", 7.2, 4.6, 5.63, 1.0, "prop", 16);
  band(s, "Crear, buscar, listar y accionar conviven distinto en cada módulo.", 0.5, 5.2, 6.15, 0.9, "hoy", 14);
}

// =====================================================================
// ACTO 4 — Antes / Propuesta
// =====================================================================
function beforeAfter(kicker, title, notes, hoy, prop, probs, mejoras) {
  const s = slide(kicker, title, notes);
  tag(s, "hoy", 0.5, 1.6); tag(s, "prop", 6.93, 1.6);
  hoy(s); prop(s);
  ln(s, 6.5, 3.7, 6.88, 3.7, { color: C.teal, w: 3, arrow: true });
  probs.forEach((t, i) => { const y = 5.6 + i * 0.44; num(s, 0.67, y + 0.2, i + 1); T(s, t, 1.05, y, 5.4, 0.4, { fontSize: 12, valign: "middle" }); });
  mejoras.forEach((t, i) => { const y = 5.6 + i * 0.44; num(s, 7.1, y + 0.2, i + 1, C.teal); T(s, t, 7.48, y, 5.3, 0.4, { fontSize: 12, valign: "middle" }); });
  box(s, 6.66, 5.6, 0.01, 1.3, { fill: C.line });
  return s;
}
const mkAnn = (s, key, x, y, size, ann) => shot(s, key, x, y, size, ann.map((a) => ({ ...a, c: "teal" })));
beforeAfter("Antes / Propuesta · Clientes", "Clientes: de una pantalla que hace todo a un patrón claro",
  "Qué veo: a la izquierda la pantalla real de Clientes; a la derecha una propuesta ilustrativa. Por qué importa: muestra el mismo contenido repartido por tareas. Qué proponemos: listado para encontrar, pantalla propia para crear y ficha para ver el detalle. La propuesta es un diseño ilustrativo, no una pantalla final.",
  (s) => shot(s, "clientes", 0.5, 2.05, { w: 5.3 }, [{ r: [416, 96, 848, 104], n: 1 }, { r: [900, 318, 323, 582], n: 2 }, { r: [416, 287, 101, 18], n: 3 }]),
  (s) => mkAnn(s, "mk-cli-lista", 6.93, 2.05, { w: 5.6 }, [{ r: [817, 32, 176, 46], n: 1 }, { r: [26, 127, 548, 48], n: 2 }, { r: [945, 278, 40, 260], n: 3 }]),
  ["Alta, búsqueda y lista juntas", "Columnas de presupuesto con ceros repetidos", "113 clientes en una única lista"],
  ["«Nuevo cliente» abre su propia pantalla", "Búsqueda primero, con el total a la vista", "Acciones de cada fila dentro de un menú «⋯»"]);
beforeAfter("Antes / Propuesta · Ventas", "Ventas: columnas clave en la lista, el resto en la ficha",
  "Qué veo: el listado real con dieciséis columnas frente a una propuesta con columnas clave. Por qué importa: la lista sirve para encontrar, no para leerlo todo. Qué proponemos: columnas clave, selector Kanban o Lista, y «Nueva oportunidad» como acción dentro del trabajo. Propuesta ilustrativa.",
  (s) => shot(s, "ventas", 0.5, 2.05, { w: 5.3 }, [{ r: [20, 322, 200, 296], n: 1 }, { r: [262, 152, 1160, 72], n: 2 }, { r: [262, 62, 830, 50], n: 3 }]),
  (s) => mkAnn(s, "mk-ventas", 6.93, 2.05, { w: 4.8 }, [{ r: [790, 48, 202, 47], n: 1 }, { r: [20, 295, 972, 50], n: 2 }, { r: [762, 163, 210, 46], n: 3 }]),
  ["7 destinos de Ventas en el menú", "16 columnas en la lista", "Cuatro filtros sin un total de resultados"],
  ["«Nueva oportunidad» como acción visible", "Pocas columnas; el detalle en la ficha", "Lista y Kanban con un selector, y «142 resultados»"]);
beforeAfter("Antes / Propuesta · Compras", "Pedido: agregar solo lo que se necesita",
  "Qué veo: el formulario real con 460 artículos frente a una propuesta con líneas del pedido. Por qué importa: el objetivo es pedir pocos productos. Qué proponemos: buscar y agregar artículos al pedido. Propuesta ilustrativa.",
  (s) => shot(s, "pedido", 0.5, 2.05, { w: 4.3 }, [{ r: [416, 343, 245, 22], n: 1 }, { r: [1007, 439, 240, 461], n: 2 }, { r: [416, 134, 848, 178], n: 3 }]),
  (s) => mkAnn(s, "mk-pedido", 6.93, 2.05, { w: 4.6 }, [{ r: [30, 440, 500, 70], n: 1 }, { r: [18, 518, 960, 178], n: 2 }, { r: [10, 120, 982, 300], n: 3 }]),
  ["460 artículos en pantalla", "Dos campos por cada artículo", "Datos del pedido mezclados con el catálogo"],
  ["«Líneas del pedido (3)»: solo lo que se pidió", "Se agrega buscando por código o nombre", "Cabecera separada de las líneas"]);
{ // Novedades B/A con wireframe nativo
  const s = beforeAfter("Antes / Propuesta · Novedades", "Novedades: registrar, reportar y consultar, cada uno en su lugar",
    "Qué veo: la pantalla real con seis tareas frente a una propuesta con tres espacios. Por qué importa: la persona suele hacer una tarea por vez. Qué proponemos: pestañas Registrar, Reportes y Listado. Esquema ilustrativo.",
    (s) => shot(s, "novedades", 1.6, 2.05, { h: 3.3 }, [{ r: [416, 96, 848, 772], n: 1 }, { r: [416, 903, 848, 163], n: 2 }, { r: [416, 1104, 848, 126], n: 3 }]),
    (s) => {
      const x = 6.93, y = 2.05, w = 5.9, h = 3.3; box(s, x, y, w, h, { fill: C.white, line: C.teal, lw: 1.5 });
      ["Registrar", "Reportes", "Listado"].forEach((t, i) => chip(s, t, x + 0.2 + i * 1.5, y + 0.15, 1.4, 0.4, { fill: i === 0 ? C.teal : C.white, line: C.teal, color: i === 0 ? C.white : C.teal, bold: true, size: 12, sq: true }));
      ["Empleado", "Fecha", "Código del día", "Horas extra"].forEach((t, i) => { const cx = x + 0.2 + (i % 2) * 2.85, cy = y + 0.75 + Math.floor(i / 2) * 0.72; T(s, t, cx, cy, 2.5, 0.25, { fontSize: 10, color: C.slate }); box(s, cx, cy + 0.27, 2.6, 0.33, { line: C.line }); });
      T(s, "Observaciones y justificación", x + 0.2, y + 2.2, 3, 0.25, { fontSize: 10, color: C.slate }); box(s, x + 0.2, y + 2.47, 5.5, 0.28, { line: C.line });
      chip(s, "Registrar novedad", x + 0.2, y + 2.85, 1.8, 0.33, { fill: C.teal, color: C.white, bold: true, size: 11 });
      num(s, x, y, 1, C.teal); num(s, x + 3.1, y + 0.15, 2, C.teal); num(s, x + 4.6, y + 0.15, 3, C.teal);
    },
    ["Seis tareas en una sola pantalla", "Reportes y listado debajo del formulario", "Registrar y consultar sin separación"],
    ["Pestañas: Registrar · Reportes · Listado", "Cada reporte en su propio lugar", "Una tarea por vez, con foco"]);
}
{ // Login/Home B/A
  const s = beforeAfter("Antes / Propuesta · Ingreso", "Ingreso: una puerta de entrada simple y un inicio que orienta",
    "Qué veo: el ingreso real, con el menú lateral vacío y el botón Cerrar sesión visibles antes de entrar, frente a una propuesta de ingreso a pantalla completa y un inicio con accesos por área. Por qué importa: es lo primero que ve cada persona. Qué proponemos: ingreso simple y un inicio que lleve a cada área. Esquema ilustrativo.",
    (s) => { const k = 5.95 / 1280; video(s, "clip-05-login", 0.5, 2.05, 5.95); num(s, 0.5 + 120 * k, 2.05 + 120 * k, 1); num(s, 0.5 + 60 * k, 2.05 + 690 * k - 0.4, 2); },
    (s) => {
      const x = 6.93, y = 2.05; box(s, x, y, 2.9, 3.3, { fill: C.white, line: C.teal, lw: 1.5 }); box(s, x + 0.55, y + 0.9, 1.8, 1.9, { fill: C.white, line: C.line });
      T(s, "Dinamic Clean", x + 0.7, y + 1.0, 1.6, 0.25, { fontSize: 11, bold: true }); box(s, x + 0.7, y + 1.4, 1.5, 0.25, { line: C.line }); box(s, x + 0.7, y + 1.75, 1.5, 0.25, { line: C.line }); chip(s, "Entrar", x + 0.7, y + 2.15, 1.5, 0.3, { fill: C.teal, color: C.white, bold: true, size: 10 });
      T(s, "Sin menú ni botones ajenos", x + 0.2, y + 2.9, 2.5, 0.3, { fontSize: 10, color: C.teal, bold: true, align: "center" });
      ln(s, x + 2.95, y + 1.75, x + 3.2, y + 1.75, { color: C.teal, w: 2, arrow: true });
      box(s, x + 3.25, y, 2.65, 3.3, { fill: C.white, line: C.teal, lw: 1.5 }); T(s, "Inicio", x + 3.4, y + 0.12, 2, 0.3, { fontSize: 12, bold: true });
      ["Ventas", "Clientes", "RRHH", "Compras", "Auditoría", "Resultados"].forEach((t, i) => chip(s, t, x + 3.4 + (i % 2) * 1.2, y + 0.55 + Math.floor(i / 2) * 0.88, 1.1, 0.76, { fill: C.tealL, line: C.teal, size: 10, bold: true }));
      num(s, x, y, 1, C.teal); num(s, x + 0.55, y + 0.9, 2, C.teal); num(s, x + 3.25, y, 3, C.teal);
    },
    ["Menú lateral vacío antes de ingresar", "«Cerrar sesión» visible sin haber ingresado", "El ingreso usa el mismo marco que el resto"],
    ["Ingreso a pantalla completa, sin menú", "Una sola acción: «Entrar»", "Después, un inicio con acceso a cada área"]);
}

// =====================================================================
// ACTO 5 — Cierre
// =====================================================================
{ // Qué gana quien lo usa
  const s = slide("Qué gana quien lo usa", "Menos esfuerzo para hacer lo mismo de siempre", "Qué veo: cinco beneficios para la persona que usa la aplicación. Por qué importa: el objetivo es que cada tarea sea más clara, no que haya más funciones. Qué proponemos: medir estos beneficios con tareas reales antes de decidir.");
  [["Encuentra", "más rápido lo que busca"], ["Entiende", "dónde está y qué puede hacer"], ["Hace", "una tarea por vez, con foco"], ["Aprende", "una vez y lo usa en todo"], ["Confía", "en lo que ve en pantalla"]].forEach(([a, b], i) => { const x = 0.5 + i * 2.5; box(s, x, 1.85, 2.3, 3.0, { fill: C.white, line: C.line, lw: 0.75 }); box(s, x, 1.85, 2.3, 0.08, { fill: C.teal }); T(s, a, x + 0.2, 2.3, 1.95, 0.6, { fontSize: 26, bold: true, color: C.teal }); T(s, b, x + 0.2, 3.1, 1.95, 1.4, { fontSize: 15, color: C.navy }); });
  band(s, "Mismas funciones. Menos esfuerzo para encontrarlas.", 0.5, 5.3, 12.33, 0.9, "prop", 20);
}
{ // Qué gana Dinamic Clean
  const s = slide("Qué gana Dinamic Clean", "Sabemos dónde debe vivir cada nueva función", "Qué veo: a la izquierda, agregar algo hoy exige entender una pantalla con muchas responsabilidades; a la derecha, cada función nueva tiene un lugar definido. Por qué importa: baja el costo de cambiar y de capacitar. Qué proponemos: mantenimiento más simple, capacitación más corta, consistencia, evolución ordenada y menor riesgo.");
  box(s, 0.5, 1.7, 6.0, 2.1, { fill: C.coralL, line: C.coral, lw: 1.25 }); tag(s, "hoy", 0.7, 1.85); T(s, "Para agregar algo nuevo hay que entender una pantalla con muchas responsabilidades.", 0.7, 2.3, 5.6, 1.3, { fontSize: 18, bold: true });
  box(s, 6.83, 1.7, 6.0, 2.1, { fill: C.tealL, line: C.teal, lw: 1.25 }); tag(s, "prop", 7.03, 1.85); T(s, "Sabemos dónde debe vivir cada nueva función.", 7.03, 2.3, 5.6, 1.3, { fontSize: 18, bold: true });
  ln(s, 6.52, 2.75, 6.8, 2.75, { color: C.teal, w: 3, arrow: true });
  [["Mantenimiento", "más simple"], ["Capacitación", "más corta"], ["Consistencia", "entre módulos"], ["Evolución", "ordenada"], ["Menor riesgo", "al cambiar"]].forEach(([a, b], i) => { const x = 0.5 + i * 2.5; box(s, x, 4.3, 2.3, 1.6, { fill: C.white, line: C.line, lw: 0.75 }); box(s, x, 4.3, 0.08, 1.6, { fill: C.teal }); T(s, a, x + 0.25, 4.5, 2, 0.4, { fontSize: 16, bold: true }); T(s, b, x + 0.25, 5.0, 2, 0.6, { fontSize: 14, color: C.slate }); });
  T(s, "Cambiar una función puede afectar otras que viven en la misma pantalla. Con espacios claros, ese riesgo baja.", 0.5, 6.2, 12.3, 0.6, { fontSize: 13, color: C.slate });
}
{ // Implementación progresiva
  const s = slide("Cómo avanzar", "Un módulo por vez, sin perder lo que ya funciona", "Qué veo: cuatro pasos para avanzar de a poco. Por qué importa: cada módulo se puede validar antes de pasar al siguiente. Qué proponemos: elegir un módulo piloto, por ejemplo Clientes, validarlo con quienes lo usan y replicar el patrón. Los plazos se definen en conjunto.");
  [["1", "Elegir un módulo piloto", "Por ejemplo, Clientes."], ["2", "Validar con quienes lo usan", "Con tareas reales."], ["3", "Replicar el patrón", "Empleados, Empresas, Proveedores."], ["4", "Seguir módulo por módulo", "Ventas, Compras, Novedades."]].forEach(([n, h, d], i) => { const x = 0.5 + i * 3.1; box(s, x, 2.4, 2.9, 2.3, { fill: C.white, line: C.line, lw: 0.75 }); box(s, x, 2.4, 2.9, 0.08, { fill: C.teal }); T(s, n, x + 0.25, 2.65, 1, 0.8, { fontSize: 38, bold: true, color: C.teal }); T(s, h, x + 0.25, 3.5, 2.45, 0.6, { fontSize: 15, bold: true }); T(s, d, x + 0.25, 4.15, 2.45, 0.5, { fontSize: 12, color: C.slate }); if (i < 3) ln(s, x + 2.92, 3.55, x + 3.08, 3.55, { color: C.teal, w: 2, arrow: true }); });
  band(s, "Cada paso conserva todas las funciones y se valida antes del siguiente.", 0.5, 5.2, 12.33, 0.85, "prop", 18);
}
{ // Validar antes de implementar
  const s = slide("Próximo paso", "Validar antes de implementar", "Qué veo: el cierre. Por qué importa: las propuestas son ilustrativas y deben probarse con quienes usan cada módulo. Qué proponemos: mostrar las propuestas, probarlas con tareas reales y decidir juntos qué se ordena primero.", { dark: true });
  [["1", "Mostrar las propuestas", "a quienes usan cada módulo"], ["2", "Probar con tareas reales", "buscar, crear, editar, reportar"], ["3", "Decidir juntos", "qué se ordena primero"]].forEach(([n, h, d], i) => { const x = 0.5 + i * 4.15; box(s, x, 1.9, 4.0, 2.4, { fill: "17233B", line: "334155", lw: 0.75 }); T(s, n, x + 0.3, 2.1, 1, 0.8, { fontSize: 40, bold: true, color: "5EEAD4" }); T(s, h, x + 0.3, 3.0, 3.5, 0.5, { fontSize: 18, bold: true, color: C.white }); T(s, d, x + 0.3, 3.55, 3.5, 0.6, { fontSize: 14, color: "CBD5E1" }); });
  T(s, "Dinamic Clean ya funciona.", 0.5, 4.9, 12.3, 0.8, { fontSize: 34, bold: true, color: C.white });
  T(s, "La propuesta es ordenar cómo crece, sin perder ninguna función.", 0.5, 5.7, 12.3, 0.6, { fontSize: 22, color: "5EEAD4" });
}

pres.writeFile({ fileName: path.join(__dirname, "Dinamic-Clean-Auditoria-UXUI-v2.pptx") }).then((f) => console.log("escrito", f, "slides", N));
