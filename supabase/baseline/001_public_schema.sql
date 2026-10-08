--
-- PostgreSQL database dump
--

\restrict 8DSnDENIzsoAMzVzk5HRxucX6dxbSRWjFGuRLtScY4XafZeRLg0606iSZi2XYrH

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: auditoria_checklist_desactivar_otras(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auditoria_checklist_desactivar_otras() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.activa then
    update auditoria_checklist_plantillas
    set activa = false
    where id <> new.id and activa;
  end if;
  return new;
end;
$$;


--
-- Name: buscar_articulos_similares(uuid, text, integer, real); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buscar_articulos_similares(p_proveedor_id uuid, p_nombre text, p_limite integer DEFAULT 3, p_umbral real DEFAULT 0.35) RETURNS TABLE(articulo_id uuid, codigo_interno text, nombre text, similitud real)
    LANGUAGE sql STABLE
    AS $$
  select a.id, a.codigo_interno, a.nombre,
         similarity(lower(ap.nombre_proveedor), lower(p_nombre)) as similitud
  from articulos_proveedor ap
  join articulos a on a.id = ap.articulo_id
  where ap.proveedor_id = p_proveedor_id
    and ap.nombre_proveedor is not null
    and similarity(lower(ap.nombre_proveedor), lower(p_nombre)) >= p_umbral
  order by similitud desc
  limit p_limite;
$$;


--
-- Name: crm_actualizar_proxima_fecha(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_actualizar_proxima_fecha() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.proxima_fecha_seguimiento is not null then
    update crm_oportunidades
    set proxima_fecha_seguimiento = new.proxima_fecha_seguimiento
    where id = new.oportunidad_id;
  end if;
  return new;
end;
$$;


--
-- Name: crm_set_fecha_cierre(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_set_fecha_cierre() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if TG_OP = 'INSERT' then
    if new.estado in ('aceptado', 'rechazado', 'en_espera') and new.fecha_cierre is null then
      new.fecha_cierre := current_date;
    end if;
  elsif new.estado is distinct from old.estado then
    if new.estado in ('aceptado', 'rechazado', 'en_espera') then
      new.fecha_cierre := current_date;
    else
      new.fecha_cierre := null;
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.perfiles (id, nombre_completo, rol)
  values (new.id, new.raw_user_meta_data->>'nombre_completo', 'supervisor');
  return new;
end;
$$;


--
-- Name: set_numero_orden_compra(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_numero_orden_compra() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.numero_oc is null or new.numero_oc = '' then
    new.numero_oc := 'OC-' || lpad(nextval('ordenes_compra_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;


--
-- Name: set_numero_pedido_compra(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_numero_pedido_compra() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.numero_pedido is null or new.numero_pedido = '' then
    new.numero_pedido := 'PED-' || lpad(nextval('pedidos_compra_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;


--
-- Name: set_numero_pedido_deposito(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_numero_pedido_deposito() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.numero_pedido_deposito is null or new.numero_pedido_deposito = '' then
    new.numero_pedido_deposito := 'DEP-' || lpad(nextval('pedidos_deposito_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: articulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_interno text NOT NULL,
    nombre text NOT NULL,
    categoria text,
    unidad text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    proveedor_habitual_id uuid
);


--
-- Name: articulos_proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articulos_proveedor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    articulo_id uuid NOT NULL,
    proveedor_id uuid NOT NULL,
    codigo_proveedor text,
    nombre_proveedor text,
    precio numeric NOT NULL,
    fecha_actualizacion timestamp with time zone DEFAULT now() NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: articulos_proveedor_pendientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articulos_proveedor_pendientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proveedor_id uuid NOT NULL,
    codigo_proveedor text,
    nombre_proveedor text,
    precio numeric,
    archivo_origen text,
    resuelto boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    motivo text,
    sugerencias jsonb
);


--
-- Name: asignaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asignaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empleado_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    fecha_desde date NOT NULL,
    fecha_hasta date,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: asistencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asistencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empleado_id uuid NOT NULL,
    fecha date NOT NULL,
    codigo text NOT NULL,
    horas_extras numeric DEFAULT 0 NOT NULL,
    cargado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    observaciones text,
    archivo_url text,
    cliente_destino_id uuid,
    cliente_horas_extra_id uuid
);


--
-- Name: auditoria_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plantilla_id uuid NOT NULL,
    orden integer NOT NULL,
    texto text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_checklist_plantillas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_checklist_plantillas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_formulario text NOT NULL,
    version text NOT NULL,
    vigencia_desde date NOT NULL,
    activa boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_plan_accion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_plan_accion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auditoria_id uuid NOT NULL,
    respuesta_id uuid,
    descripcion text NOT NULL,
    responsable_id uuid,
    fecha_limite date,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    fecha_resolucion date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT auditoria_plan_accion_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'en_curso'::text, 'resuelto'::text])))
);


--
-- Name: auditoria_planificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_planificaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alias_id uuid NOT NULL,
    fecha_propuesta date NOT NULL,
    supervisor_id uuid NOT NULL,
    estado text DEFAULT 'planificada'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    observaciones text,
    horario_desde time without time zone,
    horario_hasta time without time zone,
    CONSTRAINT auditoria_planificaciones_estado_check CHECK ((estado = ANY (ARRAY['planificada'::text, 'realizada'::text, 'vencida'::text, 'cancelada'::text])))
);


--
-- Name: auditoria_respuestas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_respuestas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auditoria_id uuid NOT NULL,
    item_id uuid NOT NULL,
    resultado text NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auditoria_respuestas_resultado_check CHECK ((resultado = ANY (ARRAY['conforme'::text, 'no_conforme'::text, 'no_aplica'::text])))
);


--
-- Name: auditorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditorias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    planificacion_id uuid,
    alias_id uuid NOT NULL,
    plantilla_id uuid NOT NULL,
    fecha_realizada date NOT NULL,
    supervisor_id uuid NOT NULL,
    evaluacion_general text,
    proxima_supervision_fecha date,
    quejas_comentarios_cliente text,
    otros text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ausencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ausencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empleado_id uuid NOT NULL,
    fecha date NOT NULL,
    justificada boolean DEFAULT false NOT NULL,
    archivo_url text,
    observaciones text,
    informado_por uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cliente_domicilios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_domicilios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    alias text NOT NULL,
    direccion text,
    es_principal boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    horario_atencion text,
    supervisor_id uuid
);


--
-- Name: cliente_presupuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_presupuestos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    storage_path text NOT NULL,
    nombre_archivo text NOT NULL,
    subido_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    presupuesto_4hs integer DEFAULT 0 NOT NULL,
    presupuesto_8hs integer DEFAULT 0 NOT NULL,
    lleva_insumos boolean,
    domicilio text,
    codigo_costos text,
    cuit text,
    persona_contacto text,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: codigos_novedad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codigos_novedad (
    codigo text NOT NULL,
    descripcion text NOT NULL,
    codigo_bejerman text,
    cuenta_como_ausencia boolean DEFAULT true NOT NULL
);


--
-- Name: crm_oportunidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_oportunidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospecto_id uuid NOT NULL,
    numero_referencia text,
    fecha_ingreso date DEFAULT CURRENT_DATE NOT NULL,
    tipo_servicio_id uuid,
    cantidad_personal numeric,
    monto_estimado numeric,
    estado text DEFAULT 'en_seguimiento'::text NOT NULL,
    fecha_envio date,
    fecha_cierre date,
    comision_monto numeric,
    comision_liquidada boolean DEFAULT false NOT NULL,
    comentarios text,
    responsable_id uuid,
    proxima_fecha_seguimiento date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    responsable_nombre_libre text,
    fecha_facturacion date,
    CONSTRAINT crm_oportunidades_estado_check CHECK ((estado = ANY (ARRAY['en_seguimiento'::text, 'aceptado'::text, 'rechazado'::text, 'en_espera'::text]))),
    CONSTRAINT crm_oportunidades_responsable_check CHECK (((responsable_id IS NOT NULL) OR (responsable_nombre_libre IS NOT NULL)))
);


--
-- Name: crm_prospectos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_prospectos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    tipo_cliente_id uuid,
    contacto_nombre text,
    telefono text,
    email text,
    referido_por_id uuid,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: crm_referidores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_referidores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: crm_seguimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_seguimientos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    oportunidad_id uuid NOT NULL,
    fecha_contacto date DEFAULT CURRENT_DATE NOT NULL,
    tipo_contacto text,
    nota text,
    proxima_fecha_seguimiento date,
    usuario_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    usuario_nombre_libre text,
    CONSTRAINT crm_seguimientos_usuario_check CHECK (((usuario_id IS NOT NULL) OR (usuario_nombre_libre IS NOT NULL)))
);


--
-- Name: crm_tipos_cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_tipos_cliente (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: crm_tipos_servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_tipos_servicio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: crm_vistas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_vistas (
    oportunidad_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    last_viewed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: empleados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empleados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre_apellido text NOT NULL,
    cuil text NOT NULL,
    fecha_ingreso date,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    horas_contrato integer DEFAULT 8 NOT NULL,
    empresa text,
    legajo text,
    CONSTRAINT empleados_empresa_check CHECK ((empresa = ANY (ARRAY['DINAMIC'::text, 'MORAL'::text]))),
    CONSTRAINT empleados_horas_contrato_check CHECK ((horas_contrato = ANY (ARRAY[4, 8])))
);


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    cuit text,
    domicilio text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ordenes_compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_compra (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_oc text NOT NULL,
    empresa_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    proveedor_id uuid NOT NULL,
    pedido_id uuid,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    observaciones_generales text,
    estado text DEFAULT 'borrador'::text NOT NULL,
    creado_por uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lugar_envio_texto text,
    lugar_envio_alias text,
    condicion_pago text,
    horario_atencion_texto text,
    CONSTRAINT ordenes_compra_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'enviada'::text, 'recepcionada'::text])))
);


--
-- Name: ordenes_compra_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_compra_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    oc_id uuid NOT NULL,
    articulo_id uuid NOT NULL,
    pedido_compra_item_id uuid,
    cantidad numeric NOT NULL,
    precio_unitario numeric NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ordenes_compra_items_cantidad_check CHECK ((cantidad > (0)::numeric))
);


--
-- Name: ordenes_compra_numero_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordenes_compra_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedidos_compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos_compra (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_pedido text NOT NULL,
    empresa_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    observaciones_generales text,
    estado text DEFAULT 'borrador'::text NOT NULL,
    creado_por uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lugar_envio_domicilio_id uuid,
    lugar_envio_empresa boolean DEFAULT false NOT NULL,
    lugar_envio_texto text,
    lugar_envio_alias text,
    CONSTRAINT pedidos_compra_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'enviada'::text, 'recepcionada'::text])))
);


--
-- Name: pedidos_compra_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos_compra_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pedido_id uuid NOT NULL,
    articulo_id uuid NOT NULL,
    cantidad numeric NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    descartada boolean DEFAULT false NOT NULL,
    motivo_descarte text,
    CONSTRAINT pedidos_compra_items_cantidad_check CHECK ((cantidad > (0)::numeric))
);


--
-- Name: pedidos_compra_numero_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedidos_compra_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedidos_deposito; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos_deposito (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_pedido_deposito text NOT NULL,
    empresa_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    pedido_id uuid,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    observaciones_generales text,
    estado text DEFAULT 'borrador'::text NOT NULL,
    creado_por uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lugar_envio_texto text,
    lugar_envio_alias text,
    CONSTRAINT pedidos_deposito_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'enviada'::text, 'recepcionada'::text])))
);


--
-- Name: pedidos_deposito_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos_deposito_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pedido_deposito_id uuid NOT NULL,
    articulo_id uuid NOT NULL,
    pedido_compra_item_id uuid,
    cantidad numeric NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pedidos_deposito_items_cantidad_check CHECK ((cantidad > (0)::numeric))
);


--
-- Name: pedidos_deposito_numero_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedidos_deposito_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: perfiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfiles (
    id uuid NOT NULL,
    nombre_completo text,
    rol text DEFAULT 'supervisor'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT perfiles_rol_check CHECK ((rol = ANY (ARRAY['admin'::text, 'gerente'::text, 'compras'::text, 'supervisor'::text, 'auditoria'::text])))
);


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    razon_social text NOT NULL,
    cuit text NOT NULL,
    domicilio text,
    telefono text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provincia text,
    condicion_pago_default text
);


--
-- Name: resultados_mensuales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resultados_mensuales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anio integer NOT NULL,
    mes integer NOT NULL,
    ventas_dinamic numeric,
    ventas_moral numeric,
    total_ventas numeric,
    total_costos_directos numeric,
    resultado_bruto numeric,
    total_rrhh numeric,
    total_estructura_servicios numeric,
    total_honorarios_abonos numeric,
    total_gastos_financieros numeric,
    total_gastos_comerciales numeric,
    total_otros_gastos numeric,
    total_impuestos numeric,
    resultado_periodo numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resultados_mensuales_mes_check CHECK (((mes >= 1) AND (mes <= 12)))
);


--
-- Name: resultados_mensuales_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resultados_mensuales_detalle (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anio integer NOT NULL,
    mes integer NOT NULL,
    rubro text NOT NULL,
    concepto text NOT NULL,
    monto numeric,
    CONSTRAINT resultados_mensuales_detalle_mes_check CHECK (((mes >= 1) AND (mes <= 12)))
);


--
-- Name: supervisores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervisores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: articulos articulos_codigo_interno_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articulos
    ADD CONSTRAINT articulos_codigo_interno_key UNIQUE (codigo_interno);


--
-- Name: articulos articulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articulos
    ADD CONSTRAINT articulos_pkey PRIMARY KEY (id);


--
-- Name: articulos_proveedor_pendientes articulos_proveedor_pendientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articulos_proveedor_pendientes
    ADD CONSTRAINT articulos_proveedor_pendientes_pkey PRIMARY KEY (id);


--
-- Name: articulos_proveedor articulos_proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articulos_proveedor
    ADD CONSTRAINT articulos_proveedor_pkey PRIMARY KEY (id);


--
-- Name: asignaciones asignaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignaciones
    ADD CONSTRAINT asignaciones_pkey PRIMARY KEY (id);


--
-- Name: asistencias asistencias_empleado_id_fecha_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_empleado_id_fecha_key UNIQUE (empleado_id, fecha);


--
-- Name: asistencias asistencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_pkey PRIMARY KEY (id);


--
-- Name: auditoria_checklist_items auditoria_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_checklist_items
    ADD CONSTRAINT auditoria_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: auditoria_checklist_plantillas auditoria_checklist_plantillas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_checklist_plantillas
    ADD CONSTRAINT auditoria_checklist_plantillas_pkey PRIMARY KEY (id);


--
-- Name: auditoria_plan_accion auditoria_plan_accion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_plan_accion
    ADD CONSTRAINT auditoria_plan_accion_pkey PRIMARY KEY (id);


--
-- Name: auditoria_planificaciones auditoria_planificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_planificaciones
    ADD CONSTRAINT auditoria_planificaciones_pkey PRIMARY KEY (id);


--
-- Name: auditoria_respuestas auditoria_respuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_respuestas
    ADD CONSTRAINT auditoria_respuestas_pkey PRIMARY KEY (id);


--
-- Name: auditorias auditorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias
    ADD CONSTRAINT auditorias_pkey PRIMARY KEY (id);


--
-- Name: ausencias ausencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ausencias
    ADD CONSTRAINT ausencias_pkey PRIMARY KEY (id);


--
-- Name: cliente_domicilios cliente_domicilios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_domicilios
    ADD CONSTRAINT cliente_domicilios_pkey PRIMARY KEY (id);


--
-- Name: cliente_presupuestos cliente_presupuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_presupuestos
    ADD CONSTRAINT cliente_presupuestos_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: codigos_novedad codigos_novedad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_novedad
    ADD CONSTRAINT codigos_novedad_pkey PRIMARY KEY (codigo);


--
-- Name: crm_oportunidades crm_oportunidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_oportunidades
    ADD CONSTRAINT crm_oportunidades_pkey PRIMARY KEY (id);


--
-- Name: crm_prospectos crm_prospectos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_prospectos
    ADD CONSTRAINT crm_prospectos_pkey PRIMARY KEY (id);


--
-- Name: crm_referidores crm_referidores_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_referidores
    ADD CONSTRAINT crm_referidores_nombre_key UNIQUE (nombre);


--
-- Name: crm_referidores crm_referidores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_referidores
    ADD CONSTRAINT crm_referidores_pkey PRIMARY KEY (id);


--
-- Name: crm_seguimientos crm_seguimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_seguimientos
    ADD CONSTRAINT crm_seguimientos_pkey PRIMARY KEY (id);


--
-- Name: crm_tipos_cliente crm_tipos_cliente_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tipos_cliente
    ADD CONSTRAINT crm_tipos_cliente_nombre_key UNIQUE (nombre);


--
-- Name: crm_tipos_cliente crm_tipos_cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tipos_cliente
    ADD CONSTRAINT crm_tipos_cliente_pkey PRIMARY KEY (id);


--
-- Name: crm_tipos_servicio crm_tipos_servicio_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tipos_servicio
    ADD CONSTRAINT crm_tipos_servicio_nombre_key UNIQUE (nombre);


--
-- Name: crm_tipos_servicio crm_tipos_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tipos_servicio
    ADD CONSTRAINT crm_tipos_servicio_pkey PRIMARY KEY (id);


--
-- Name: crm_vistas crm_vistas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_vistas
    ADD CONSTRAINT crm_vistas_pkey PRIMARY KEY (oportunidad_id, usuario_id);


--
-- Name: empleados empleados_cuil_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_cuil_key UNIQUE (cuil);


--
-- Name: empleados empleados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: ordenes_compra_items ordenes_compra_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items
    ADD CONSTRAINT ordenes_compra_items_pkey PRIMARY KEY (id);


--
-- Name: ordenes_compra ordenes_compra_numero_oc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_numero_oc_key UNIQUE (numero_oc);


--
-- Name: ordenes_compra ordenes_compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_pkey PRIMARY KEY (id);


--
-- Name: pedidos_compra_items pedidos_compra_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_compra_items
    ADD CONSTRAINT pedidos_compra_items_pkey PRIMARY KEY (id);


--
-- Name: pedidos_compra pedidos_compra_numero_pedido_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_compra
    ADD CONSTRAINT pedidos_compra_numero_pedido_key UNIQUE (numero_pedido);


--
-- Name: pedidos_compra pedidos_compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_compra
    ADD CONSTRAINT pedidos_compra_pkey PRIMARY KEY (id);


--
-- Name: pedidos_deposito_items pedidos_deposito_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_deposito_items
    ADD CONSTRAINT pedidos_deposito_items_pkey PRIMARY KEY (id);


--
-- Name: pedidos_deposito pedidos_deposito_numero_pedido_deposito_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_deposito
    ADD CONSTRAINT pedidos_deposito_numero_pedido_deposito_key UNIQUE (numero_pedido_deposito);


--
-- Name: pedidos_deposito pedidos_deposito_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_deposito
    ADD CONSTRAINT pedidos_deposito_pkey PRIMARY KEY (id);


--
-- Name: perfiles perfiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_cuit_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_cuit_key UNIQUE (cuit);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: resultados_mensuales resultados_mensuales_anio_mes_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultados_mensuales
    ADD CONSTRAINT resultados_mensuales_anio_mes_key UNIQUE (anio, mes);


--
-- Name: resultados_mensuales_detalle resultados_mensuales_detalle_anio_mes_rubro_concepto_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultados_mensuales_detalle
    ADD CONSTRAINT resultados_mensuales_detalle_anio_mes_rubro_concepto_key UNIQUE (anio, mes, rubro, concepto);


--
-- Name: resultados_mensuales_detalle resultados_mensuales_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultados_mensuales_detalle
    ADD CONSTRAINT resultados_mensuales_detalle_pkey PRIMARY KEY (id);


--
-- Name: resultados_mensuales resultados_mensuales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultados_mensuales
    ADD CONSTRAINT resultados_mensuales_pkey PRIMARY KEY (id);


--
-- Name: supervisores supervisores_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisores
    ADD CONSTRAINT supervisores_nombre_key UNIQUE (nombre);


--
-- Name: supervisores supervisores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisores
    ADD CONSTRAINT supervisores_pkey PRIMARY KEY (id);


--
-- Name: articulos_proveedor_nombre_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX articulos_proveedor_nombre_trgm_idx ON public.articulos_proveedor USING gin (nombre_proveedor public.gin_trgm_ops);


--
-- Name: articulos_proveedor_proveedor_codigo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX articulos_proveedor_proveedor_codigo_idx ON public.articulos_proveedor USING btree (proveedor_id, codigo_proveedor) WHERE ((codigo_proveedor IS NOT NULL) AND (codigo_proveedor <> ''::text));


--
-- Name: auditoria_checklist_una_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auditoria_checklist_una_activa ON public.auditoria_checklist_plantillas USING btree ((true)) WHERE activa;


--
-- Name: cliente_domicilios_un_principal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cliente_domicilios_un_principal ON public.cliente_domicilios USING btree (cliente_id) WHERE es_principal;


--
-- Name: idx_asistencias_cliente_destino_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asistencias_cliente_destino_id ON public.asistencias USING btree (cliente_destino_id);


--
-- Name: idx_asistencias_cliente_horas_extra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asistencias_cliente_horas_extra_id ON public.asistencias USING btree (cliente_horas_extra_id);


--
-- Name: idx_ordenes_compra_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_compra_estado ON public.ordenes_compra USING btree (estado);


--
-- Name: idx_ordenes_compra_items_pedido_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_compra_items_pedido_item ON public.ordenes_compra_items USING btree (pedido_compra_item_id);


--
-- Name: idx_ordenes_compra_pedido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_compra_pedido ON public.ordenes_compra USING btree (pedido_id);


--
-- Name: idx_ordenes_compra_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_compra_proveedor ON public.ordenes_compra USING btree (proveedor_id);


--
-- Name: idx_pedidos_compra_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_compra_cliente ON public.pedidos_compra USING btree (cliente_id);


--
-- Name: idx_pedidos_compra_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_compra_empresa ON public.pedidos_compra USING btree (empresa_id);


--
-- Name: idx_pedidos_compra_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_compra_estado ON public.pedidos_compra USING btree (estado);


--
-- Name: idx_pedidos_deposito_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_deposito_estado ON public.pedidos_deposito USING btree (estado);


--
-- Name: idx_pedidos_deposito_items_pedido_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_deposito_items_pedido_item ON public.pedidos_deposito_items USING btree (pedido_compra_item_id);


--
-- Name: idx_pedidos_deposito_pedido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_deposito_pedido ON public.pedidos_deposito USING btree (pedido_id);


--
-- Name: auditoria_checklist_plantillas trg_auditoria_checklist_desactivar_otras; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditoria_checklist_desactivar_otras AFTER INSERT OR UPDATE OF activa ON public.auditoria_checklist_plantillas FOR EACH ROW EXECUTE FUNCTION public.auditoria_checklist_desactivar_otras();


--
-- Name: auditoria_plan_accion trg_auditoria_plan_accion_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditoria_plan_accion_updated_at BEFORE UPDATE ON public.auditoria_plan_accion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: auditoria_planificaciones trg_auditoria_planificaciones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditoria_planificaciones_updated_at BEFORE UPDATE ON public.auditoria_planificaciones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: crm_oportunidades trg_crm_oportunidades_fecha_cierre; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_crm_oportunidades_fecha_cierre BEFORE INSERT OR UPDATE ON public.crm_oportunidades FOR EACH ROW EXECUTE FUNCTION public.crm_set_fecha_cierre();


--
-- Name: crm_oportunidades trg_crm_oportunidades_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_crm_oportunidades_updated_at BEFORE UPDATE ON public.crm_oportunidades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: crm_prospectos trg_crm_prospectos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_crm_prospectos_updated_at BEFORE UPDATE ON public.crm_prospectos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: crm_seguimientos trg_crm_seguimientos_actualizar_proxima_fecha; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_crm_seguimientos_actualizar_proxima_fecha AFTER INSERT ON public.crm_seguimientos FOR EACH ROW EXECUTE FUNCTION public.crm_actualizar_proxima_fecha();


--
-- Name: ordenes_compra trg_ordenes_compra_set_numero; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ordenes_compra_set_numero BEFORE INSERT ON public.ordenes_compra FOR EACH ROW EXECUTE FUNCTION public.set_numero_orden_compra();


--
-- Name: ordenes_compra trg_ordenes_compra_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ordenes_compra_updated_at BEFORE UPDATE ON public.ordenes_compra FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pedidos_compra trg_pedidos_compra_set_numero; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pedidos_compra_set_numero BEFORE INSERT ON public.pedidos_compra FOR EACH ROW EXECUTE FUNCTION public.set_numero_pedido_compra();


--
-- Name: pedidos_compra trg_pedidos_compra_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pedidos_compra_updated_at BEFORE UPDATE ON public.pedidos_compra FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pedidos_deposito trg_pedidos_deposito_set_numero; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pedidos_deposito_set_numero BEFORE INSERT ON public.pedidos_deposito FOR EACH ROW EXECUTE FUNCTION public.set_numero_pedido_deposito();


--
-- Name: pedidos_deposito trg_pedidos_deposito_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pedidos_deposito_updated_at BEFORE UPDATE ON public.pedidos_deposito FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: resultados_mensuales trg_resultados_mensuales_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_resultados_mensuales_updated_at BEFORE UPDATE ON public.resultados_mensuales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: articulos_proveedor articulos_proveedor_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articulos_proveedor
    ADD CONSTRAINT articulos_proveedor_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id);


--
-- Name: articulos articulos_proveedor_habitual_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articulos
    ADD CONSTRAINT articulos_proveedor_habitual_id_fkey FOREIGN KEY (proveedor_habitual_id) REFERENCES public.proveedores(id) ON DELETE SET NULL;


--
-- Name: articulos_proveedor_pendientes articulos_proveedor_pendientes_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articulos_proveedor_pendientes
    ADD CONSTRAINT articulos_proveedor_pendientes_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: articulos_proveedor articulos_proveedor_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articulos_proveedor
    ADD CONSTRAINT articulos_proveedor_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: asignaciones asignaciones_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignaciones
    ADD CONSTRAINT asignaciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: asignaciones asignaciones_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignaciones
    ADD CONSTRAINT asignaciones_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE CASCADE;


--
-- Name: asistencias asistencias_cargado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_cargado_por_fkey FOREIGN KEY (cargado_por) REFERENCES auth.users(id);


--
-- Name: asistencias asistencias_cliente_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_cliente_destino_id_fkey FOREIGN KEY (cliente_destino_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: asistencias asistencias_cliente_horas_extra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_cliente_horas_extra_id_fkey FOREIGN KEY (cliente_horas_extra_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: asistencias asistencias_codigo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_codigo_fkey FOREIGN KEY (codigo) REFERENCES public.codigos_novedad(codigo);


--
-- Name: asistencias asistencias_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id);


--
-- Name: auditoria_checklist_items auditoria_checklist_items_plantilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_checklist_items
    ADD CONSTRAINT auditoria_checklist_items_plantilla_id_fkey FOREIGN KEY (plantilla_id) REFERENCES public.auditoria_checklist_plantillas(id) ON DELETE CASCADE;


--
-- Name: auditoria_plan_accion auditoria_plan_accion_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_plan_accion
    ADD CONSTRAINT auditoria_plan_accion_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias(id) ON DELETE CASCADE;


--
-- Name: auditoria_plan_accion auditoria_plan_accion_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_plan_accion
    ADD CONSTRAINT auditoria_plan_accion_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.perfiles(id);


--
-- Name: auditoria_plan_accion auditoria_plan_accion_respuesta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_plan_accion
    ADD CONSTRAINT auditoria_plan_accion_respuesta_id_fkey FOREIGN KEY (respuesta_id) REFERENCES public.auditoria_respuestas(id) ON DELETE SET NULL;


--
-- Name: auditoria_planificaciones auditoria_planificaciones_alias_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_planificaciones
    ADD CONSTRAINT auditoria_planificaciones_alias_id_fkey FOREIGN KEY (alias_id) REFERENCES public.cliente_domicilios(id) ON DELETE CASCADE;


--
-- Name: auditoria_planificaciones auditoria_planificaciones_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_planificaciones
    ADD CONSTRAINT auditoria_planificaciones_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.perfiles(id);


--
-- Name: auditoria_respuestas auditoria_respuestas_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_respuestas
    ADD CONSTRAINT auditoria_respuestas_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias(id) ON DELETE CASCADE;


--
-- Name: auditoria_respuestas auditoria_respuestas_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_respuestas
    ADD CONSTRAINT auditoria_respuestas_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.auditoria_checklist_items(id);


--
-- Name: auditorias auditorias_alias_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias
    ADD CONSTRAINT auditorias_alias_id_fkey FOREIGN KEY (alias_id) REFERENCES public.cliente_domicilios(id) ON DELETE CASCADE;


--
-- Name: auditorias auditorias_planificacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias
    ADD CONSTRAINT auditorias_planificacion_id_fkey FOREIGN KEY (planificacion_id) REFERENCES public.auditoria_planificaciones(id) ON DELETE SET NULL;


--
-- Name: auditorias auditorias_plantilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias
    ADD CONSTRAINT auditorias_plantilla_id_fkey FOREIGN KEY (plantilla_id) REFERENCES public.auditoria_checklist_plantillas(id);


--
-- Name: auditorias auditorias_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias
    ADD CONSTRAINT auditorias_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.perfiles(id);


--
-- Name: ausencias ausencias_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ausencias
    ADD CONSTRAINT ausencias_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE CASCADE;


--
-- Name: ausencias ausencias_informado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ausencias
    ADD CONSTRAINT ausencias_informado_por_fkey FOREIGN KEY (informado_por) REFERENCES public.perfiles(id);


--
-- Name: cliente_domicilios cliente_domicilios_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_domicilios
    ADD CONSTRAINT cliente_domicilios_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: cliente_domicilios cliente_domicilios_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_domicilios
    ADD CONSTRAINT cliente_domicilios_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.supervisores(id) ON DELETE SET NULL;


--
-- Name: cliente_presupuestos cliente_presupuestos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_presupuestos
    ADD CONSTRAINT cliente_presupuestos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: cliente_presupuestos cliente_presupuestos_subido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_presupuestos
    ADD CONSTRAINT cliente_presupuestos_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.perfiles(id);


--
-- Name: crm_oportunidades crm_oportunidades_prospecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_oportunidades
    ADD CONSTRAINT crm_oportunidades_prospecto_id_fkey FOREIGN KEY (prospecto_id) REFERENCES public.crm_prospectos(id) ON DELETE CASCADE;


--
-- Name: crm_oportunidades crm_oportunidades_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_oportunidades
    ADD CONSTRAINT crm_oportunidades_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.perfiles(id);


--
-- Name: crm_oportunidades crm_oportunidades_tipo_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_oportunidades
    ADD CONSTRAINT crm_oportunidades_tipo_servicio_id_fkey FOREIGN KEY (tipo_servicio_id) REFERENCES public.crm_tipos_servicio(id);


--
-- Name: crm_prospectos crm_prospectos_referido_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_prospectos
    ADD CONSTRAINT crm_prospectos_referido_por_id_fkey FOREIGN KEY (referido_por_id) REFERENCES public.crm_referidores(id);


--
-- Name: crm_prospectos crm_prospectos_tipo_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_prospectos
    ADD CONSTRAINT crm_prospectos_tipo_cliente_id_fkey FOREIGN KEY (tipo_cliente_id) REFERENCES public.crm_tipos_cliente(id);


--
-- Name: crm_seguimientos crm_seguimientos_oportunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_seguimientos
    ADD CONSTRAINT crm_seguimientos_oportunidad_id_fkey FOREIGN KEY (oportunidad_id) REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE;


--
-- Name: crm_seguimientos crm_seguimientos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_seguimientos
    ADD CONSTRAINT crm_seguimientos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles(id);


--
-- Name: crm_vistas crm_vistas_oportunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_vistas
    ADD CONSTRAINT crm_vistas_oportunidad_id_fkey FOREIGN KEY (oportunidad_id) REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE;


--
-- Name: ordenes_compra ordenes_compra_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: ordenes_compra ordenes_compra_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.perfiles(id);


--
-- Name: ordenes_compra ordenes_compra_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: ordenes_compra_items ordenes_compra_items_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items
    ADD CONSTRAINT ordenes_compra_items_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id);


--
-- Name: ordenes_compra_items ordenes_compra_items_oc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items
    ADD CONSTRAINT ordenes_compra_items_oc_id_fkey FOREIGN KEY (oc_id) REFERENCES public.ordenes_compra(id) ON DELETE CASCADE;


--
-- Name: ordenes_compra_items ordenes_compra_items_pedido_compra_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items
    ADD CONSTRAINT ordenes_compra_items_pedido_compra_item_id_fkey FOREIGN KEY (pedido_compra_item_id) REFERENCES public.pedidos_compra_items(id);


--
-- Name: ordenes_compra ordenes_compra_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos_compra(id);


--
-- Name: ordenes_compra ordenes_compra_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: pedidos_compra pedidos_compra_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_compra
    ADD CONSTRAINT pedidos_compra_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: pedidos_compra pedidos_compra_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_compra
    ADD CONSTRAINT pedidos_compra_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.perfiles(id);


--
-- Name: pedidos_compra pedidos_compra_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_compra
    ADD CONSTRAINT pedidos_compra_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: pedidos_compra_items pedidos_compra_items_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_compra_items
    ADD CONSTRAINT pedidos_compra_items_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id);


--
-- Name: pedidos_compra_items pedidos_compra_items_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_compra_items
    ADD CONSTRAINT pedidos_compra_items_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos_compra(id) ON DELETE CASCADE;


--
-- Name: pedidos_compra pedidos_compra_lugar_envio_domicilio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_compra
    ADD CONSTRAINT pedidos_compra_lugar_envio_domicilio_id_fkey FOREIGN KEY (lugar_envio_domicilio_id) REFERENCES public.cliente_domicilios(id) ON DELETE SET NULL;


--
-- Name: pedidos_deposito pedidos_deposito_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_deposito
    ADD CONSTRAINT pedidos_deposito_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: pedidos_deposito pedidos_deposito_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_deposito
    ADD CONSTRAINT pedidos_deposito_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.perfiles(id);


--
-- Name: pedidos_deposito pedidos_deposito_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_deposito
    ADD CONSTRAINT pedidos_deposito_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: pedidos_deposito_items pedidos_deposito_items_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_deposito_items
    ADD CONSTRAINT pedidos_deposito_items_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id);


--
-- Name: pedidos_deposito_items pedidos_deposito_items_pedido_compra_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_deposito_items
    ADD CONSTRAINT pedidos_deposito_items_pedido_compra_item_id_fkey FOREIGN KEY (pedido_compra_item_id) REFERENCES public.pedidos_compra_items(id);


--
-- Name: pedidos_deposito_items pedidos_deposito_items_pedido_deposito_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_deposito_items
    ADD CONSTRAINT pedidos_deposito_items_pedido_deposito_id_fkey FOREIGN KEY (pedido_deposito_id) REFERENCES public.pedidos_deposito(id) ON DELETE CASCADE;


--
-- Name: pedidos_deposito pedidos_deposito_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_deposito
    ADD CONSTRAINT pedidos_deposito_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos_compra(id);


--
-- Name: perfiles perfiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: asistencias Cualquier usuario logueado puede cargar asistencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cualquier usuario logueado puede cargar asistencias" ON public.asistencias FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: asistencias Cualquier usuario logueado puede editar asistencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cualquier usuario logueado puede editar asistencias" ON public.asistencias FOR UPDATE TO authenticated USING (true);


--
-- Name: asistencias Cualquier usuario logueado puede ver asistencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cualquier usuario logueado puede ver asistencias" ON public.asistencias FOR SELECT TO authenticated USING (true);


--
-- Name: codigos_novedad Cualquier usuario logueado puede ver los codigos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cualquier usuario logueado puede ver los codigos" ON public.codigos_novedad FOR SELECT TO authenticated USING (true);


--
-- Name: asignaciones admin_borra_asignaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_borra_asignaciones ON public.asignaciones FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: clientes admin_borra_clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_borra_clientes ON public.clientes FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: empleados admin_borra_empleados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_borra_empleados ON public.empleados FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: asignaciones admin_crea_asignaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_crea_asignaciones ON public.asignaciones FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: clientes admin_crea_clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_crea_clientes ON public.clientes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: empleados admin_crea_empleados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_crea_empleados ON public.empleados FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: asignaciones admin_edita_asignaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_edita_asignaciones ON public.asignaciones FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: clientes admin_edita_clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_edita_clientes ON public.clientes FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: empleados admin_edita_empleados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_edita_empleados ON public.empleados FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: articulos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;

--
-- Name: articulos articulos_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY articulos_insert_admin ON public.articulos FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: articulos_proveedor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.articulos_proveedor ENABLE ROW LEVEL SECURITY;

--
-- Name: articulos_proveedor articulos_proveedor_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY articulos_proveedor_insert_admin ON public.articulos_proveedor FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: articulos_proveedor_pendientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.articulos_proveedor_pendientes ENABLE ROW LEVEL SECURITY;

--
-- Name: articulos_proveedor articulos_proveedor_select_all_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY articulos_proveedor_select_all_logged ON public.articulos_proveedor FOR SELECT TO authenticated USING (true);


--
-- Name: articulos_proveedor articulos_proveedor_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY articulos_proveedor_update_admin ON public.articulos_proveedor FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: articulos articulos_select_all_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY articulos_select_all_logged ON public.articulos FOR SELECT TO authenticated USING (true);


--
-- Name: articulos articulos_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY articulos_update_admin ON public.articulos FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: asignaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: asistencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_checklist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditoria_checklist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_checklist_items auditoria_checklist_items_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auditoria_checklist_items_authenticated_all ON public.auditoria_checklist_items TO authenticated USING (true) WITH CHECK (true);


--
-- Name: auditoria_checklist_plantillas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditoria_checklist_plantillas ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_checklist_plantillas auditoria_checklist_plantillas_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auditoria_checklist_plantillas_authenticated_all ON public.auditoria_checklist_plantillas TO authenticated USING (true) WITH CHECK (true);


--
-- Name: auditoria_plan_accion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditoria_plan_accion ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_plan_accion auditoria_plan_accion_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auditoria_plan_accion_authenticated_all ON public.auditoria_plan_accion TO authenticated USING (true) WITH CHECK (true);


--
-- Name: auditoria_planificaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditoria_planificaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_planificaciones auditoria_planificaciones_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auditoria_planificaciones_authenticated_all ON public.auditoria_planificaciones TO authenticated USING (true) WITH CHECK (true);


--
-- Name: auditoria_respuestas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditoria_respuestas ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_respuestas auditoria_respuestas_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auditoria_respuestas_authenticated_all ON public.auditoria_respuestas TO authenticated USING (true) WITH CHECK (true);


--
-- Name: auditorias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;

--
-- Name: auditorias auditorias_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auditorias_authenticated_all ON public.auditorias TO authenticated USING (true) WITH CHECK (true);


--
-- Name: ausencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ausencias ENABLE ROW LEVEL SECURITY;

--
-- Name: cliente_domicilios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cliente_domicilios ENABLE ROW LEVEL SECURITY;

--
-- Name: cliente_domicilios cliente_domicilios_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cliente_domicilios_authenticated_all ON public.cliente_domicilios TO authenticated USING (true) WITH CHECK (true);


--
-- Name: cliente_presupuestos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cliente_presupuestos ENABLE ROW LEVEL SECURITY;

--
-- Name: cliente_presupuestos cliente_presupuestos_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cliente_presupuestos_authenticated_all ON public.cliente_presupuestos TO authenticated USING (true) WITH CHECK (true);


--
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--
-- Name: codigos_novedad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.codigos_novedad ENABLE ROW LEVEL SECURITY;

--
-- Name: ausencias crear_ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crear_ausencias ON public.ausencias FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: crm_oportunidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_oportunidades crm_oportunidades_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_oportunidades_authenticated_all ON public.crm_oportunidades TO authenticated USING (true) WITH CHECK (true);


--
-- Name: crm_prospectos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_prospectos ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_prospectos crm_prospectos_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_prospectos_authenticated_all ON public.crm_prospectos TO authenticated USING (true) WITH CHECK (true);


--
-- Name: crm_referidores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_referidores ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_referidores crm_referidores_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_referidores_authenticated_all ON public.crm_referidores TO authenticated USING (true) WITH CHECK (true);


--
-- Name: crm_seguimientos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_seguimientos ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_seguimientos crm_seguimientos_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_seguimientos_authenticated_all ON public.crm_seguimientos TO authenticated USING (true) WITH CHECK (true);


--
-- Name: crm_tipos_cliente; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_tipos_cliente ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_tipos_cliente crm_tipos_cliente_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_tipos_cliente_authenticated_all ON public.crm_tipos_cliente TO authenticated USING (true) WITH CHECK (true);


--
-- Name: crm_tipos_servicio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_tipos_servicio ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_tipos_servicio crm_tipos_servicio_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_tipos_servicio_authenticated_all ON public.crm_tipos_servicio TO authenticated USING (true) WITH CHECK (true);


--
-- Name: crm_vistas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_vistas ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_vistas crm_vistas_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_vistas_authenticated_all ON public.crm_vistas TO authenticated USING (true) WITH CHECK (true);


--
-- Name: ausencias editar_ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY editar_ausencias ON public.ausencias FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: empleados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

--
-- Name: empresas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

--
-- Name: empresas empresas_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY empresas_insert_admin ON public.empresas FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: empresas empresas_select_all_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY empresas_select_all_logged ON public.empresas FOR SELECT TO authenticated USING (true);


--
-- Name: empresas empresas_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY empresas_update_admin ON public.empresas FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: ordenes_compra; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;

--
-- Name: ordenes_compra ordenes_compra_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ordenes_compra_insert_admin ON public.ordenes_compra FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: ordenes_compra_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ordenes_compra_items ENABLE ROW LEVEL SECURITY;

--
-- Name: ordenes_compra_items ordenes_compra_items_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ordenes_compra_items_insert_admin ON public.ordenes_compra_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: ordenes_compra_items ordenes_compra_items_select_all_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ordenes_compra_items_select_all_logged ON public.ordenes_compra_items FOR SELECT TO authenticated USING (true);


--
-- Name: ordenes_compra_items ordenes_compra_items_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ordenes_compra_items_update_admin ON public.ordenes_compra_items FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: ordenes_compra ordenes_compra_select_all_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ordenes_compra_select_all_logged ON public.ordenes_compra FOR SELECT TO authenticated USING (true);


--
-- Name: ordenes_compra ordenes_compra_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ordenes_compra_update_admin ON public.ordenes_compra FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: pedidos_compra; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos_compra pedidos_compra_insert_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_compra_insert_logged ON public.pedidos_compra FOR INSERT TO authenticated WITH CHECK ((auth.uid() = creado_por));


--
-- Name: pedidos_compra_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos_compra_items ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos_compra_items pedidos_compra_items_insert_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_compra_items_insert_logged ON public.pedidos_compra_items FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: pedidos_compra_items pedidos_compra_items_select_all_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_compra_items_select_all_logged ON public.pedidos_compra_items FOR SELECT TO authenticated USING (true);


--
-- Name: pedidos_compra_items pedidos_compra_items_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_compra_items_update_admin ON public.pedidos_compra_items FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: pedidos_compra_items pedidos_compra_items_update_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_compra_items_update_authenticated ON public.pedidos_compra_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: pedidos_compra pedidos_compra_select_all_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_compra_select_all_logged ON public.pedidos_compra FOR SELECT TO authenticated USING (true);


--
-- Name: pedidos_compra pedidos_compra_update_admin_or_creador; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_compra_update_admin_or_creador ON public.pedidos_compra FOR UPDATE TO authenticated USING (((auth.uid() = creado_por) OR (EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text))))));


--
-- Name: pedidos_deposito; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos_deposito ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos_deposito pedidos_deposito_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_deposito_insert_admin ON public.pedidos_deposito FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: pedidos_deposito_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos_deposito_items ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos_deposito_items pedidos_deposito_items_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_deposito_items_insert_admin ON public.pedidos_deposito_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: pedidos_deposito_items pedidos_deposito_items_select_all_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_deposito_items_select_all_logged ON public.pedidos_deposito_items FOR SELECT TO authenticated USING (true);


--
-- Name: pedidos_deposito_items pedidos_deposito_items_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_deposito_items_update_admin ON public.pedidos_deposito_items FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: pedidos_deposito pedidos_deposito_select_all_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_deposito_select_all_logged ON public.pedidos_deposito FOR SELECT TO authenticated USING (true);


--
-- Name: pedidos_deposito pedidos_deposito_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_deposito_update_admin ON public.pedidos_deposito FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: articulos_proveedor_pendientes pendientes_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pendientes_insert_admin ON public.articulos_proveedor_pendientes FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: articulos_proveedor_pendientes pendientes_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pendientes_select_admin ON public.articulos_proveedor_pendientes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: articulos_proveedor_pendientes pendientes_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pendientes_update_admin ON public.articulos_proveedor_pendientes FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: perfiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles perfiles_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perfiles_select_authenticated ON public.perfiles FOR SELECT TO authenticated USING (true);


--
-- Name: proveedores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

--
-- Name: proveedores proveedores_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proveedores_insert_admin ON public.proveedores FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: proveedores proveedores_select_all_logged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proveedores_select_all_logged ON public.proveedores FOR SELECT TO authenticated USING (true);


--
-- Name: proveedores proveedores_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proveedores_update_admin ON public.proveedores FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: resultados_mensuales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resultados_mensuales ENABLE ROW LEVEL SECURITY;

--
-- Name: resultados_mensuales_detalle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resultados_mensuales_detalle ENABLE ROW LEVEL SECURITY;

--
-- Name: resultados_mensuales_detalle resultados_mensuales_detalle_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resultados_mensuales_detalle_delete_admin ON public.resultados_mensuales_detalle FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: resultados_mensuales_detalle resultados_mensuales_detalle_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resultados_mensuales_detalle_insert_admin ON public.resultados_mensuales_detalle FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: resultados_mensuales_detalle resultados_mensuales_detalle_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resultados_mensuales_detalle_select_authenticated ON public.resultados_mensuales_detalle FOR SELECT TO authenticated USING (true);


--
-- Name: resultados_mensuales_detalle resultados_mensuales_detalle_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resultados_mensuales_detalle_update_admin ON public.resultados_mensuales_detalle FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: resultados_mensuales resultados_mensuales_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resultados_mensuales_insert_admin ON public.resultados_mensuales FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: resultados_mensuales resultados_mensuales_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resultados_mensuales_select_authenticated ON public.resultados_mensuales FOR SELECT TO authenticated USING (true);


--
-- Name: resultados_mensuales resultados_mensuales_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resultados_mensuales_update_admin ON public.resultados_mensuales FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = 'admin'::text)))));


--
-- Name: supervisores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supervisores ENABLE ROW LEVEL SECURITY;

--
-- Name: supervisores supervisores_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY supervisores_authenticated_all ON public.supervisores TO authenticated USING (true) WITH CHECK (true);


--
-- Name: asignaciones ver_asignaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ver_asignaciones ON public.asignaciones FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: ausencias ver_ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ver_ausencias ON public.ausencias FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: clientes ver_clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ver_clientes ON public.clientes FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: empleados ver_empleados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ver_empleados ON public.empleados FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: perfiles ver_propio_perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ver_propio_perfil ON public.perfiles FOR SELECT USING ((auth.uid() = id));


--
-- PostgreSQL database dump complete
--

\unrestrict 8DSnDENIzsoAMzVzk5HRxucX6dxbSRWjFGuRLtScY4XafZeRLg0606iSZi2XYrH

