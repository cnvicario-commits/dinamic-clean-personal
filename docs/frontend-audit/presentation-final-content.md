# Presentación final — contenido slide por slide (25 slides + anexo opcional)

Audiencia no técnica. Un mensaje y un visual dominante por slide. Fuente de verdad: los `*-final.md` y, para el estado actual, las capturas y clips reales de `presentation/`.

**Datos verificados en el sistema real (sesión autenticada, entorno de prueba):**
- Ventas → Listado: 16 columnas, 50 filas cargadas, filtros por estado/responsable/tipo de cliente, botón Exportar a Excel. Al escribir “limpieza” el contador pasó de “Listado (50)” a “Listado (8)”. (RUNTIME)
- Menú de Ventas real: Tablero · Leads · Agenda · Nueva oportunidad · Listado · Resumen ejecutivo · Novedades de Facturación. (RUNTIME)
- Clientes: formulario de alta arriba y listado debajo, 113 clientes en una sola lista sin paginado. Columnas reales: Nombre, Domicilio, Presup. 4hs, Presup. 8hs, Insumos. (RUNTIME)
- Nuevo pedido de compra: “Artículos del catálogo (460)”, una fila por artículo con Cantidad y Observaciones. (RUNTIME)
- Novedades: formulario, dos descargas de reportes (Bejerman y horas extra por cliente), “Listado (0)” con Exportar a Excel y Anterior/Siguiente, todo en una pantalla. En el entorno de prueba el listado está vacío. (RUNTIME)
- Login: columna de menú lateral presente pero sin opciones (solo marca y “Cerrar sesión”). (RUNTIME)
- Los “142 oportunidades” de los mockups son ilustrativos. No hay métricas de rendimiento.

**Convención de rótulos en las slides:** `HOY` para el estado actual y `PROPUESTA` para lo propuesto (se evitó alternar con “Antes/Después/Actual”). Los títulos de las slides 11, 14, 16 y 17 pasaron a “Clientes: hoy y propuesta”, “Ventas: propuesta”, “Pedido de compra: propuesta” y “Panel de compras”. La slide 25 cierra con la frase dominante “Ordenar cómo se usa Dinamic Clean para que sea más claro, confiable y fácil de seguir creciendo.” y “Validar primero. Implementar después.” El texto de apoyo vive en el guion hablado; la slide lleva el mensaje.

Convención: `[VIDEO n]` = clip real en `presentation/videos/`. `[HIPÓTESIS]` = a validar en entrevistas.

---

## BLOQUE 1 — Contexto

### 1 · Portada
Título: Dinamic Clean — Propuesta de evolución de la experiencia del sistema. Subtítulo: Auditoría UX/UI · Diagnóstico · Propuesta de mejora. Fondo blanco, línea teal, sin logo nuevo.

### 2 · Qué hicimos
Mensaje: antes de proponer cambios, revisamos cómo está construido y cómo se usa. Pasos: Revisar → Detectar problemas → Entender por qué ocurren → Diseñar una alternativa → Validar antes de implementar.

### 3 · Una aclaración importante
Mensaje grande: **Dinamic Clean funciona.** CRM, Compras, RRHH y Auditorías funcionan. “La propuesta no busca reemplazar el sistema. Busca ordenar cómo se usa y cómo puede seguir creciendo.”

---

## BLOQUE 2 — Qué está pasando hoy

### 4 · El sistema fue creciendo
Visual: 4 capturas reales (Ventas, Clientes, Pedido de compra, Novedades). Texto: cada módulo fue resolviendo necesidades a medida que aparecían; tareas parecidas hoy se resuelven de maneras distintas. Datos personales difuminados.

### 5 · Tres cosas que vimos
1 Información que puede generar confusión (Ventas). 2 Pantallas con demasiadas tareas (Clientes, Novedades). 3 Cada módulo resuelve lo mismo de manera distinta.

---

## BLOQUE 3 — Demostraciones

### 6 · Buscar debería significar buscar en todo
`[VIDEO 1]` “Buscando dentro de una parte del listado”. Previo: “Primero veamos un ejemplo sencillo.” Hoy: la búsqueda trabaja sobre una parte de la información. Propuesta: consulta todo y devuelve solo lo que coincide. Beneficio: resultados confiables, menos dudas, exportaciones coherentes. Cierre: “La pantalla parece estar buscando en todas las oportunidades, pero en realidad trabaja sobre el grupo que ya estaba cargado.”

### 7 · ¿Por qué mostrar por páginas?
HOY: cargar mucho → mostrar una parte → filtrar esa parte. PROPUESTA: buscar primero → traer solo lo necesario → página 1 · 2 · 3. Analogía del archivo. Aclaración obligatoria: filtros y búsqueda siguen trabajando sobre toda la información. Sin porcentajes de mejora.

### 8 · Los filtros tienen que trabajar sobre toda la información
Chips: Responsable · Estado · Tipo de cliente · Buscar. “Primero se busca qué registros cumplen la condición; después se muestran.” Ejemplo: oportunidades de María en seguimiento.

### 9 · Crear, buscar y editar son tareas diferentes
`[VIDEO 2]` “Crear + buscar + consultar, todo en la misma pantalla” (Clientes). Hoy: Alta · Listado · Edición · Filtros en un lugar. Propuesta: Listado · Nuevo · Ficha · Editar conectados. “Separar no significa duplicar. Significa ordenar.”

---

## BLOQUE 4 — Nuevo modelo de pantallas

### 10 · Una tarea por pantalla
Listado → (Nuevo | Ficha → Editar). Listado = encontrar · Nuevo = crear · Ficha = consultar · Editar = modificar. Lo pequeño que vive dentro de algo se queda en la ficha.

### 11 · Clientes — antes y después
Antes (captura real): alta y listado de 113 clientes en la misma pantalla, sin paginado. Después (imagen ilustrativa): listado limpio. Qué cambia / por qué mejora. Nota: las columnas reales hoy son Nombre, Domicilio, Presup. 4hs, Presup. 8hs, Insumos; las del mockup (CUIT, Código de costos) son una propuesta `[REQUIERE VALIDACIÓN]`. Hoy no hay pantalla para editar un cliente.

### 12 · Crear y editar deberían sentirse iguales
Mockup de edición; mismos campos en Nuevo y Editar; cambia título y botón final. Beneficio: menos aprendizaje y errores.

---

## BLOQUE 5 — Ventas

### 13 · Ventas hoy
Captura real del listado. Muchas columnas (16, con desplazamiento lateral) · dos accesos (Tablero y Listado) · filtros sobre las 50 cargadas · “Nueva oportunidad” convive con las vistas en el menú.

### 14 · Ventas propuesta
Mockup Lista (ilustrativo): un espacio de trabajo con Lista o Kanban, mismos filtros y resultados; Ficha para el detalle; botón claro de Nueva oportunidad. `[HIPÓTESIS]` columnas y vista por defecto.

---

## BLOQUE 6 — Compras

### 15 · Armar un pedido hoy
`[VIDEO 3]` “Una fila por cada artículo, aunque pidas pocos”. La pantalla dice “Artículos del catálogo (460)” y muestra una fila por cada uno. Propuesta: buscar lo que se necesita y construir el pedido solo con esos artículos.

### 16 · Pedido propuesto
Vacío (“Todavía no agregaste artículos”) → con líneas. Pasos: cliente → buscar artículo → agregar → cantidad → enviar. Se edita solo en borrador.

### 17 · Panel de compras
Antes: listado + formulario largo. Después (ilustrativo): pantalla dividida; botón “Generar OC” provisorio. `[HIPÓTESIS]` split vs. detalle; requiere preparar el listado de pendientes `[REQUIERE SOPORTE TÉCNICO]`.

---

## BLOQUE 7 — RRHH

### 18 · Novedades
`[VIDEO 4]` “Cargar + consultar + reportar, todo junto”: formulario, dos reportes, listado con Exportar a Excel y paginación. Después: Consultar novedades y Cargar novedad como pantallas separadas. En el entorno de prueba el listado está vacío. Pantalla de admin/gerencia; quién carga en campo es pregunta abierta. No se propone editar novedades.

---

## BLOQUE 8 — Navegación y consistencia

### 19 · Ingreso y home
`[VIDEO 5]` “Menú lateral vacío antes de ingresar”. Hoy: el ingreso muestra la columna del menú sin opciones. Propuesta: login limpio · home según el rol · menú con destinos. Ejemplos `[HIPÓTESIS]`: Ventas → Trabajo, Agenda, Leads; Compras → Cola, Pedidos, Órdenes.

### 20 · Todo se siente como el mismo sistema
Tira de elementos comunes. “Si una acción significa lo mismo, debería verse y funcionar igual.” Sin cambio de marca.

---

## BLOQUE 9 — Por qué mejora

### 21 · Para quien lo usa
Más claridad · más confianza · menos información innecesaria · más consistencia · mejor uso en pantallas chicas donde tiene sentido.

### 22 · Para Dinamic Clean
Más fácil agregar funciones · menos riesgo al cambiar · menor capacitación · más fácil seguir creciendo. Beneficios esperados, no medidos.

---

## BLOQUE 10 — Camino

### 23 · No se hace todo junto
Navegación e ingreso → Ventas → Clientes → Pedido de compra → Cola de compras → Novedades → Home. Cada bloque: se implementa, se prueba, se valida. Orden orientativo, sin fechas.

### 24 · Cómo sabremos si mejoró
Seis preguntas sobre tareas reales (cliente más rápido, filtro esperado, qué hacer al entrar, pedido sin recorrer todo el catálogo, corregir un cliente, cola de Compras).

### 25 · Próximo paso
Validar con Ventas, Compras, RRHH/Gerencia y Administración. “Validar primero. Implementar después.” Frase de salida: “No quieren rehacer Dinamic Clean; quieren ordenar cómo se usa para que sea más claro, confiable y fácil de seguir creciendo.”

---

## Anexo técnico opcional (solo equipo técnico)
A1 filtros/exportación sobre página de 50 · A2 rutas Listado/Nuevo/Ficha/Editar · A3 brechas de soporte técnico (edición de Empleados, pendientes de compras, Empresas) · A4 orden por etapas.

## Traducciones usadas
| Técnico | En la deck |
|---|---|
| filtros del lado del cliente | “buscar solo dentro de lo que ya se cargó” |
| paginación del servidor | “mostrar por páginas, buscando primero en todo” |
| componentes acoplados | “muchas funciones dependen unas de otras en el mismo lugar” |
| design system | “un lenguaje visual común” |
