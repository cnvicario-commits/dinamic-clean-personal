// Prepara recortes, zooms, videos normalizados y posters. Uso: NODE_PATH=<node_modules> node prepare-assets.js
const sharp = require("sharp"); const fs = require("fs"); const path = require("path"); const { execFileSync } = require("child_process");
const SH = path.join(__dirname, "../screenshots/"); const FV = path.join(__dirname, "../final/videos/");
const A = path.join(__dirname, "assets/"); const VD = path.join(__dirname, "videos/");
const reg = {};
async function crop(key, src, r) { // r: [left,top,w,h] en px de la captura original
  const file = A + key + ".png";
  await sharp(SH + src).extract({ left: r[0], top: r[1], width: r[2], height: r[3] }).toFile(file);
  reg[key] = { file, w: r[2], h: r[3], ox: r[0], oy: r[1] };
}
(async () => {
  await crop("ventas", "real-ventas-listado.png", [0, 0, 1440, 900]);
  await crop("clientes", "real-clientes.png", [0, 0, 1440, 900]);
  await crop("empleados", "real-empleados.png", [0, 0, 1440, 1000]);
  await crop("pedido", "real-pedido-nuevo.png", [256, 0, 1184, 900]);
  await crop("novedades", "real-ausencias-completa.png", [256, 0, 1184, 1250]);
  await crop("dash", "real-auditorias-dashboard.png", [0, 0, 1440, 1100]);
  await crop("plan", "real-auditorias-planificacion.png", [0, 0, 1440, 1000]);
  await crop("login", "real-login.png", [0, 0, 1440, 900]);
  // zooms (coordenadas originales)
  await crop("zoom-plan", "real-auditorias-planificacion.png", [725, 290, 175, 255]);
  await crop("zoom-dash", "real-auditorias-dashboard.png", [288, 535, 200, 225]);
  // Tablero compuesto: inicio (Novedades 71) + salto + controles y Kanban
  const T = SH + "real-ventas-tablero-full.png";
  const segA = await sharp(T).extract({ left: 256, top: 0, width: 1184, height: 470 }).toBuffer();
  const segB = await sharp(T).extract({ left: 256, top: 3290, width: 1184, height: 700 }).toBuffer();
  const gap = Buffer.from(`<svg width="1184" height="60" xmlns="http://www.w3.org/2000/svg"><rect width="1184" height="60" fill="#E2E8F0"/><text x="592" y="38" font-family="Arial" font-size="22" fill="#475569" text-anchor="middle">··· la lista continúa: 71 novedades en total ···</text></svg>`);
  await sharp({ create: { width: 1184, height: 1230, channels: 3, background: "#ffffff" } })
    .composite([{ input: segA, top: 0, left: 0 }, { input: gap, top: 470, left: 0 }, { input: segB, top: 530, left: 0 }])
    .png().toFile(A + "tablero.png");
  reg.tablero = { file: A + "tablero.png", w: 1184, h: 1230, ox: 0, oy: 0 };
  // mockups (propuestas ilustrativas, originales fuera del repo)
  const MK = process.env.MOCKUP_DIR; // carpeta con mockup-*.jpg
  const mk = { "mk-cli-lista": ["mockup-clientes-listado.jpg", [256, 0, 1024, 602]], "mk-cli-ficha": ["mockup-clientes-ficha.jpg", [256, 0, 1024, 720]], "mk-cli-edit": ["mockup-clientes-editar.jpg", [256, 0, 1024, 720]], "mk-ventas": ["mockup-ventas-lista.jpg", [220, 0, 1060, 720]], "mk-pedido": ["mockup-pedido-con-lineas.jpg", [256, 0, 1024, 720]], "mk-panel": ["mockup-panel-compras-split.jpg", [256, 0, 1024, 720]] };
  for (const [k, [f, r]] of Object.entries(mk)) {
    await sharp(path.join(MK, f)).extract({ left: r[0], top: r[1], width: r[2], height: r[3] }).png().toFile(A + k + ".png");
    reg[k] = { file: A + k + ".png", w: r[2], h: r[3], ox: 0, oy: 0 };
  }
  // videos: H.264 + AAC (pista de audio silenciosa), yuv420p, faststart; contenido sin cambios
  const clips = ["clip-01-ventas", "clip-02-pantallas-mezcladas", "clip-03-pedido", "clip-04-novedades", "clip-05-login"];
  const play = Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><circle cx="1210" cy="650" r="30" fill="#0F172A" fill-opacity="0.72"/><polygon points="1200,634 1200,666 1228,650" fill="#fff"/></svg>`);
  for (const c of clips) {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", FV + c + ".mp4", "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-crf", "20", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", VD + c + ".mp4"]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.8", "-i", VD + c + ".mp4", "-frames:v", "1", A + c + "-frame.png"]);
    await sharp(A + c + "-frame.png").composite([{ input: play }]).jpeg({ quality: 88 }).toFile(VD + c + "-poster.jpg");
    reg[c] = { video: VD + c + ".mp4", poster: VD + c + "-poster.jpg", frame: A + c + "-frame.png" };
  }
  fs.writeFileSync(A + "registry.json", JSON.stringify(reg, null, 1));
  console.log("assets ok", Object.keys(reg).length);
})();
