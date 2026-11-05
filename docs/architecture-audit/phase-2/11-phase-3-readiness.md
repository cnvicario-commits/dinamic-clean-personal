# Preparación de la fase 3

Next.js de Cristian no se construyó y no va a Vercel. Producción sigue en el proyecto Vercel existente.

El diseño deja, sin crearlos todavía:

- un segundo servicio en el mismo Compose, o un Compose hermano, con otro contenedor y otro puerto de loopback
- un vhost y un certificado distintos para el dominio del frontend
- memoria propia, elegida con la misma medición que la API
- `CORS_ORIGIN` de la API igual al origen HTTPS de ese frontend
- las redirect URLs de Supabase Auth apuntando a ese origen, configuradas en el proyecto Test cuando exista el dominio

La fase 3 no empieza hasta tener el relevamiento del VPS, el puerto libre, el dominio y la reserva de memoria para los dos contenedores. La API demo puede instalarse antes, sola, si la capacidad alcanza y se deja el margen del frontend sin ocuparlo con otro servicio.
