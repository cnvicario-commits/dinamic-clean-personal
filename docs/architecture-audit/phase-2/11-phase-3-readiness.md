# Preparación de la fase 3

Next.js de Cristian no se construyó y no va a Vercel. Producción sigue en el proyecto Vercel existente.

El diseño deja, sin crearlos todavía:

- un segundo servicio en el mismo Compose, o un Compose hermano, con otro contenedor y otro puerto de loopback
- un vhost y un certificado distintos para el dominio del frontend
- memoria propia, elegida con la misma medición que la API
- `CORS_ORIGIN` de la API igual al origen HTTPS de ese frontend
- las redirect URLs de Supabase Auth apuntando a ese origen, configuradas en el proyecto Test cuando exista el dominio

La fase 3 no empieza en este cierre. El puerto `8086` queda reservado para ese frontend y hay que verificar que siga libre antes de usarlo. La API demo ya está instalada, con 1 CPU y 512 MB, y deja el resto de las 16 CPU y de la RAM libre para ese contenedor.
