# Dinamic Clean — Auditoría UX/UI v2

## Qué enviar
- **Con videos:** `Dinamic-Clean-Auditoria-UXUI-v2.pptx` (32 slides, 5 videos MP4 embebidos dentro del archivo; no depende de la carpeta `videos/`).
- **Sin videos:** `Dinamic-Clean-Auditoria-UXUI-v2.pdf` (estático; en las slides de video muestra un fotograma real con un ícono de Play discreto y el hallazgo escrito).

## Contenido
| Ruta | Qué es |
|---|---|
| `Dinamic-Clean-Auditoria-UXUI-v2.pptx` | Presentación editable (texto, formas y capturas como objetos separados) |
| `Dinamic-Clean-Auditoria-UXUI-v2.pdf` | Versión estática (generada con LibreOffice desde el PPTX) |
| `presentation-source.js` | Fuente PptxGenJS que construye el PPTX |
| `prepare-assets.js` | Recortes, lupas, normalización de videos (H.264 + AAC) y posters |
| `assets/` | Capturas recortadas, lupas, fotogramas y `registry.json` |
| `videos/` | 5 clips MP4 normalizados + posters |
| `qa/` | `slide-01.png`…`slide-32.png` y `contact-sheet.png` |

## Regenerar
```
npm i pptxgenjs sharp          # en una carpeta temporal; no se agrega al producto
NODE_PATH=<node_modules> MOCKUP_DIR=<carpeta con mockup-*.jpg> node prepare-assets.js
NODE_PATH=<node_modules> node presentation-source.js
soffice --headless --convert-to pdf Dinamic-Clean-Auditoria-UXUI-v2.pptx
```

## Notas
- Las capturas son reales (ambiente de pruebas) con nombres, CUIL, contactos, montos, sitios y domicilios reemplazados o difuminados. Las propuestas son diseños ilustrativos y están rotuladas como tales.
- PptxGenJS no soporta transiciones; la presentación no incluye ninguna.
- No se incluyen credenciales, tokens ni rutas locales (verificado por escaneo del paquete y del PDF).
