// ============================================================================
//  Esquema de la base de datos, por versiones. NUNCA se edita una migración
//  ya publicada: los cambios van en una versión nueva (la Fase 2 añadirá
//  visitas, ofertas, operaciones y documentos como migraciones 2, 3…).
//  PRAGMA user_version guarda la versión aplicada.
// ============================================================================

export const MIGRACIONES = [
  {
    version: 1,
    nombre: "núcleo: contactos, oportunidades, inmuebles, demandas, tareas",
    sql: `
CREATE TABLE contadores (clave TEXT PRIMARY KEY, valor INTEGER NOT NULL);
CREATE TABLE configuracion (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);

CREATE TABLE catalogo (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,
  valor TEXT NOT NULL,
  etiqueta TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  orden INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tipo, valor)
);

-- Una persona, una ficha: los roles son banderas (puede ser propietario y comprador).
CREATE TABLE contactos (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellidos TEXT,
  empresa TEXT,
  telefono TEXT,
  telefono_norm TEXT,
  email TEXT,
  email_norm TEXT,
  canal_preferido TEXT,
  es_propietario INTEGER NOT NULL DEFAULT 0 CHECK (es_propietario IN (0,1)),
  es_comprador INTEGER NOT NULL DEFAULT 0 CHECK (es_comprador IN (0,1)),
  procedencia TEXT,
  procedencia_detalle TEXT,
  motivo_venta TEXT,
  plazo_venta TEXT,
  notas TEXT,
  no_contactar INTEGER NOT NULL DEFAULT 0 CHECK (no_contactar IN (0,1)),
  no_contactar_motivo TEXT,
  no_contactar_fecha TEXT,
  anonimizado_en TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);
CREATE INDEX idx_contactos_tel ON contactos(telefono_norm);
CREATE INDEX idx_contactos_email ON contactos(email_norm);

-- Habilitación de comunicaciones POR CANAL (registro interno, no asesoramiento jurídico).
CREATE TABLE contacto_comunicaciones (
  id INTEGER PRIMARY KEY,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,
  canal TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'sin_revisar',
  base TEXT,
  evidencia TEXT,
  fecha_autorizacion TEXT,
  fecha_baja TEXT,
  fecha_robinson TEXT,
  revisado_en TEXT,
  UNIQUE (contacto_id, canal)
);

CREATE TABLE inmuebles (
  id INTEGER PRIMARY KEY,
  referencia TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  operacion TEXT NOT NULL DEFAULT 'venta',
  municipio TEXT NOT NULL,
  zona TEXT,
  direccion_interna TEXT,
  ubicacion_publica TEXT,
  superficie_m2 REAL,
  tipo_superficie TEXT NOT NULL DEFAULT 'desconocida',
  habitaciones INTEGER,
  banos INTEGER,
  planta TEXT,
  ascensor INTEGER CHECK (ascensor IN (0,1)),
  garaje INTEGER CHECK (garaje IN (0,1)),
  terraza INTEGER CHECK (terraza IN (0,1)),
  estado_conservacion TEXT,
  caracteristicas TEXT,
  precio_actual REAL,
  descripcion_comercial TEXT,
  notas_internas TEXT,
  estado_comercial TEXT NOT NULL DEFAULT 'en_preparacion',
  datos_pendientes TEXT,
  oportunidad_origen_id INTEGER REFERENCES oportunidades(id) ON DELETE SET NULL,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);
CREATE INDEX idx_inmuebles_estado ON inmuebles(estado_comercial);
CREATE INDEX idx_inmuebles_municipio ON inmuebles(municipio);

CREATE TABLE inmueble_propietarios (
  inmueble_id INTEGER NOT NULL REFERENCES inmuebles(id) ON DELETE CASCADE,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id) ON DELETE RESTRICT,
  porcentaje REAL,
  principal INTEGER NOT NULL DEFAULT 0 CHECK (principal IN (0,1)),
  creado_en TEXT NOT NULL,
  PRIMARY KEY (inmueble_id, contacto_id)
);
CREATE INDEX idx_prop_contacto ON inmueble_propietarios(contacto_id);

CREATE TABLE inmueble_precios (
  id INTEGER PRIMARY KEY,
  inmueble_id INTEGER NOT NULL REFERENCES inmuebles(id) ON DELETE CASCADE,
  precio REAL NOT NULL,
  fecha TEXT NOT NULL,
  motivo TEXT,
  creado_en TEXT NOT NULL
);
CREATE INDEX idx_precios_inmueble ON inmueble_precios(inmueble_id);

CREATE TABLE oportunidades (
  id INTEGER PRIMARY KEY,
  identificador TEXT NOT NULL UNIQUE,
  fuente TEXT NOT NULL,
  fuente_detalle TEXT,
  enlace TEXT,
  enlace_norm TEXT,
  fecha_deteccion TEXT NOT NULL,
  tipo_inmueble TEXT NOT NULL,
  municipio TEXT NOT NULL,
  zona TEXT,
  titulo TEXT,
  precio_anunciado REAL,
  superficie_m2 REAL,
  habitaciones INTEGER,
  banos INTEGER,
  caracteristicas TEXT,
  clasificacion_anunciante TEXT NOT NULL DEFAULT 'sin_verificar',
  evidencia_clasificacion TEXT,
  contacto_id INTEGER REFERENCES contactos(id) ON DELETE RESTRICT,
  responsable TEXT,
  proxima_accion TEXT,
  proxima_accion_fecha TEXT,
  estado TEXT NOT NULL DEFAULT 'detectada',
  estado_desde TEXT NOT NULL,
  verificacion_contacto TEXT NOT NULL DEFAULT 'sin_verificar',
  verificacion_evidencia TEXT,
  verificacion_fecha TEXT,
  motivo_descarte TEXT,
  notas TEXT,
  inmueble_id INTEGER REFERENCES inmuebles(id) ON DELETE SET NULL,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);
CREATE INDEX idx_op_estado ON oportunidades(estado);
CREATE INDEX idx_op_contacto ON oportunidades(contacto_id);
CREATE INDEX idx_op_enlace ON oportunidades(enlace_norm);
CREATE INDEX idx_op_municipio ON oportunidades(municipio);
CREATE INDEX idx_op_fuente ON oportunidades(fuente);

CREATE TABLE encargos (
  id INTEGER PRIMARY KEY,
  inmueble_id INTEGER NOT NULL REFERENCES inmuebles(id) ON DELETE CASCADE,
  oportunidad_id INTEGER REFERENCES oportunidades(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'venta',
  exclusividad INTEGER NOT NULL DEFAULT 0 CHECK (exclusividad IN (0,1)),
  fecha_encargo TEXT NOT NULL,
  vigencia_hasta TEXT,
  honorarios_tipo TEXT NOT NULL DEFAULT 'sin_definir',
  honorarios_valor REAL,
  honorarios_notas TEXT,
  estado TEXT NOT NULL DEFAULT 'vigente',
  notas TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);
CREATE INDEX idx_encargos_inmueble ON encargos(inmueble_id);

CREATE TABLE demandas (
  id INTEGER PRIMARY KEY,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id) ON DELETE RESTRICT,
  nombre TEXT,
  operacion TEXT NOT NULL DEFAULT 'compra',
  municipios TEXT,
  zonas TEXT,
  presupuesto_min REAL,
  presupuesto_max REAL,
  tipos TEXT,
  superficie_min REAL,
  habitaciones_min INTEGER,
  banos_min INTEGER,
  ascensor TEXT NOT NULL DEFAULT 'indiferente',
  garaje TEXT NOT NULL DEFAULT 'indiferente',
  terraza TEXT NOT NULL DEFAULT 'indiferente',
  estados_aceptables TEXT,
  requisitos_imprescindibles TEXT,
  preferencias TEXT,
  plazo_compra TEXT NOT NULL DEFAULT 'desconocido',
  financiacion TEXT NOT NULL DEFAULT 'no_indicada',
  financiacion_evidencia TEXT,
  estado TEXT NOT NULL DEFAULT 'activa',
  motivo_cierre TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);
CREATE INDEX idx_demandas_contacto ON demandas(contacto_id);
CREATE INDEX idx_demandas_estado ON demandas(estado);

CREATE TABLE actividades (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,
  direccion TEXT NOT NULL DEFAULT 'saliente',
  fecha TEXT NOT NULL,
  hora TEXT,
  resumen TEXT NOT NULL,
  resultado TEXT,
  contacto_id INTEGER REFERENCES contactos(id) ON DELETE SET NULL,
  oportunidad_id INTEGER REFERENCES oportunidades(id) ON DELETE SET NULL,
  inmueble_id INTEGER REFERENCES inmuebles(id) ON DELETE SET NULL,
  demanda_id INTEGER REFERENCES demandas(id) ON DELETE SET NULL,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);
CREATE INDEX idx_act_contacto ON actividades(contacto_id);
CREATE INDEX idx_act_oportunidad ON actividades(oportunidad_id);
CREATE INDEX idx_act_inmueble ON actividades(inmueble_id);
CREATE INDEX idx_act_demanda ON actividades(demanda_id);
CREATE INDEX idx_act_fecha ON actividades(fecha);

CREATE TABLE tareas (
  id INTEGER PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'otro',
  fecha TEXT NOT NULL,
  hora TEXT,
  prioridad TEXT NOT NULL DEFAULT 'media',
  responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  notas TEXT,
  contacto_id INTEGER REFERENCES contactos(id) ON DELETE SET NULL,
  oportunidad_id INTEGER REFERENCES oportunidades(id) ON DELETE SET NULL,
  inmueble_id INTEGER REFERENCES inmuebles(id) ON DELETE SET NULL,
  demanda_id INTEGER REFERENCES demandas(id) ON DELETE SET NULL,
  encargo_id INTEGER REFERENCES encargos(id) ON DELETE CASCADE,
  aviso_min INTEGER,
  aviso_visto_en TEXT,
  completada_en TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);
CREATE INDEX idx_tareas_fecha ON tareas(fecha);
CREATE INDEX idx_tareas_estado ON tareas(estado);
CREATE INDEX idx_tareas_contacto ON tareas(contacto_id);
CREATE INDEX idx_tareas_oportunidad ON tareas(oportunidad_id);
CREATE INDEX idx_tareas_inmueble ON tareas(inmueble_id);

-- Registro de cambios. Los datos personales y los textos libres NO guardan su
-- valor aquí (solo que cambiaron): el historial no debe ser una segunda copia.
CREATE TABLE historial_cambios (
  id INTEGER PRIMARY KEY,
  entidad TEXT NOT NULL,
  entidad_id INTEGER NOT NULL,
  accion TEXT NOT NULL,
  campo TEXT,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  resumen TEXT,
  usuario TEXT,
  fecha TEXT NOT NULL
);
CREATE INDEX idx_hist_entidad ON historial_cambios(entidad, entidad_id);
CREATE INDEX idx_hist_fecha ON historial_cambios(fecha);
`,
  },
];
