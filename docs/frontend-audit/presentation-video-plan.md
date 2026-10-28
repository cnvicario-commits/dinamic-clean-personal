# Plan de videos — estado: LISTO (5 de 5 grabados)

Grabados con una sesión autenticada en el entorno de prueba, sin escribir credenciales en pantalla, sin DevTools, a 1280×720, sin audio. Un cursor rojo translúcido marca el mouse. Se oculta el indicador de desarrollo de Next. En Ventas se difuminan Contacto, Teléfono/Email, Referido por y Monto estimado.

| Clip | Estado | Problema | Pantalla | Qué muestra | Duración real | Slide | Archivo / poster |
|---|---|---|---|---|---|---|---|
| 1 | LISTO | Buscar no equivale a buscar en todo | Ventas → Listado | Total “Listado (50)”; se escribe “limpieza”; el contador pasa a 8; hover sobre Exportar a Excel (sin descargar) | 14,0 s | 6 | `final/videos/clip-01-ventas.mp4` · `-poster.jpg` |
| 2 | LISTO | Pantallas con muchas tareas | Clientes | Formulario de alta arriba, listado de 113 debajo, scroll de ida y vuelta, búsqueda “banco” (2 de 113). No se envía nada | 10,3 s | 9 y 11 | `final/videos/clip-02-pantallas-mezcladas.mp4` |
| 3 | LISTO | Una fila por cada artículo | Pedidos de compra → Nuevo | “Artículos del catálogo (460)”; scroll por la grilla; búsqueda “alcohol”. No se carga cantidad ni se guarda | 12,3 s | 15 | `final/videos/clip-03-pedido.mp4` |
| 4 | LISTO | Novedades: demasiadas tareas | `/ausencias` | Formulario, dos reportes, listado con Exportar a Excel y paginación, en un scroll. Listado vacío en este entorno. No se registra nada | 9,4 s | 18 | `final/videos/clip-04-novedades.mp4` |
| 5 | LISTO | Menú lateral sin opciones al ingresar | `/login` (sin sesión) | Login y la columna de menú vacía. No se escribe ninguna credencial | 8,5 s | 19 | `final/videos/clip-05-login.mp4` |

## Diferencias con el objetivo
- Clips 2, 4 y 5 duran menos de 15 s (el plan pedía 15–20 s; clip 5 ~10 s). Están dentro del rango general de 10–25 s salvo 4 (9,4 s) y 5 (8,5 s).
- Clip 5: el texto original (“navegación que todavía no sirve”) no coincidía con lo real; el menú está vacío. El texto superpuesto pasó a “Menú lateral vacío antes de ingresar”.
- Clip 2 usa solo Clientes. No se probó Proveedores/Artículos como segundo ejemplo.
- Clip 4 no muestra filas en el listado por no haber novedades cargadas.
- Los videos se grabaron en navegador headless; la barra de scroll y el paginado se ven como en uso normal.

## Poster, PDF y enlaces
Cada slide de video lleva su fotograma, el ícono ▶ y un enlace relativo a la carpeta `videos/` (el PDF y la carpeta deben estar juntos). No hay URL pública, por lo que no hay QR. Si se sube a un lugar compartido, se agrega en `presentation/`.
