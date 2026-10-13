-- ============================================================================
--  Esquema D1 de castresana-web (Asesoría Castresana)
--  Se aplica con:  cf d1 migrations apply <ID-DE-LA-D1> --dir . --pattern schema.sql
--  Es idempotente (IF NOT EXISTS): repetirlo no borra nada.
-- ============================================================================

-- «Valora tu piso»: solicitudes de valoración. No se calcula ningún precio.
CREATE TABLE IF NOT EXISTS valoraciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  creada        TEXT    NOT NULL,                 -- ISO 8601 en UTC
  nombre        TEXT    NOT NULL,
  telefono      TEXT    NOT NULL,                 -- 9 cifras, sin prefijo
  correo        TEXT    NOT NULL DEFAULT '',
  operacion     TEXT    NOT NULL CHECK (operacion IN ('vender', 'alquilar')),
  tipo          TEXT    NOT NULL,
  zona          TEXT    NOT NULL,
  metros        INTEGER,
  habitaciones  INTEGER,
  comentario    TEXT    NOT NULL DEFAULT '',
  privacidad    TEXT    NOT NULL                  -- versión del texto aceptado
);
CREATE INDEX IF NOT EXISTS valoraciones_por_fecha ON valoraciones (creada DESC);

-- Inmuebles que se pueden visitar (la lista la mantiene Pau desde el panel).
CREATE TABLE IF NOT EXISTS inmuebles (
  referencia   TEXT    PRIMARY KEY COLLATE NOCASE,
  titulo       TEXT    NOT NULL DEFAULT '',
  zona         TEXT    NOT NULL DEFAULT '',
  enlace       TEXT    NOT NULL DEFAULT '',
  activo       INTEGER NOT NULL DEFAULT 1,
  actualizado  TEXT    NOT NULL
);

-- Visitas reservadas. `fecha_hora` es la hora de Madrid ('AAAA-MM-DDTHH:MM').
CREATE TABLE IF NOT EXISTS visitas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_hora  TEXT    NOT NULL,
  inicio_utc  TEXT    NOT NULL,
  referencia  TEXT    NOT NULL,
  nombre      TEXT    NOT NULL,
  telefono    TEXT    NOT NULL,
  comentario  TEXT    NOT NULL DEFAULT '',
  estado      TEXT    NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada')),
  creada      TEXT    NOT NULL,
  cancelada   TEXT
);
-- SIN CHOQUES: solo puede haber UNA visita activa por hueco (Pau es una sola
-- persona, así que el hueco es común a todos los inmuebles). Es la base de
-- datos la que lo impide: aunque dos personas reserven en el mismo instante,
-- la segunda inserción falla. Al cancelar, el hueco vuelve a quedar libre.
CREATE UNIQUE INDEX IF NOT EXISTS visitas_sin_choques ON visitas (fecha_hora) WHERE estado = 'activa';
CREATE INDEX IF NOT EXISTS visitas_por_fecha ON visitas (fecha_hora);

-- Huecos o días bloqueados por Pau. hora = '' significa el día entero.
CREATE TABLE IF NOT EXISTS bloqueos (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha   TEXT NOT NULL,
  hora    TEXT NOT NULL DEFAULT '',
  motivo  TEXT NOT NULL DEFAULT '',
  creado  TEXT NOT NULL,
  UNIQUE (fecha, hora)
);

-- Límite de envíos por IP (la IP se guarda resumida con SHA-256, no en claro).
CREATE TABLE IF NOT EXISTS limites (
  clave    TEXT    NOT NULL,
  ventana  INTEGER NOT NULL,                      -- inicio de la ventana, en segundos
  cuenta   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (clave, ventana)
);
