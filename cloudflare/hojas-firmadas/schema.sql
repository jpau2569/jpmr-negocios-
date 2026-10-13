-- ============================================================================
--  Esquema D1 de hojas-firmadas (una base de datos por inmobiliaria)
--  Se aplica con:  npx cf d1 migrations apply <ID-DE-LA-D1> --dir . --pattern schema.sql
--  Es idempotente (IF NOT EXISTS): repetirlo no borra nada.
-- ============================================================================

-- Hojas firmadas. `contenido` es el JSON canónico de lo que se firmó (datos,
-- textos legales, marca, agente y las dos firmas en JPEG base64) y `hash` su
-- SHA-256: si alguien cambiara una coma, el código ya no coincidiría.
-- El `id` lo genera el móvil al firmar (UUID): así la misma hoja subida dos
-- veces desde la cola sin conexión no se duplica.
CREATE TABLE IF NOT EXISTS hojas (
  id          TEXT    PRIMARY KEY,
  tipo        TEXT    NOT NULL CHECK (tipo IN ('visita', 'captacion')),
  referencia  TEXT    NOT NULL DEFAULT '',
  inmueble    TEXT    NOT NULL DEFAULT '',
  nombre      TEXT    NOT NULL DEFAULT '',          -- visitante o propietario
  busqueda    TEXT    NOT NULL DEFAULT '',          -- nombre + ref. + dirección, sin tildes
  agente_id   INTEGER NOT NULL DEFAULT 0,           -- 0 = titular
  agente      TEXT    NOT NULL,
  firmada     TEXT    NOT NULL,                     -- ISO UTC del móvil
  recibida    TEXT    NOT NULL,                     -- ISO UTC del servidor (sello de tiempo)
  ip          TEXT    NOT NULL,                     -- HMAC-SHA256 de la IP, nunca en claro
  contenido   TEXT    NOT NULL,
  hash        TEXT    NOT NULL,
  estado      TEXT    NOT NULL DEFAULT 'firmada' CHECK (estado IN ('firmada', 'anulada')),
  anulada     TEXT,
  motivo      TEXT,
  anulada_por TEXT
);
CREATE INDEX IF NOT EXISTS hojas_por_fecha ON hojas (firmada DESC);

-- INMUTABLES: una hoja firmada no se puede cambiar. Lo único permitido es
-- pasar de 'firmada' a 'anulada' (con fecha, motivo y quién), y una vez
-- anulada ya no se toca. Lo impide la propia base de datos, no solo el código.
CREATE TRIGGER IF NOT EXISTS hojas_inmutables
BEFORE UPDATE ON hojas
WHEN NOT (
  OLD.estado = 'firmada' AND NEW.estado = 'anulada'
  AND NEW.anulada IS NOT NULL AND NEW.motivo IS NOT NULL AND NEW.anulada_por IS NOT NULL
  AND NEW.id = OLD.id AND NEW.tipo = OLD.tipo AND NEW.referencia = OLD.referencia
  AND NEW.inmueble = OLD.inmueble AND NEW.nombre = OLD.nombre AND NEW.busqueda = OLD.busqueda
  AND NEW.agente_id = OLD.agente_id AND NEW.agente = OLD.agente AND NEW.firmada = OLD.firmada
  AND NEW.recibida = OLD.recibida AND NEW.ip = OLD.ip AND NEW.contenido = OLD.contenido
  AND NEW.hash = OLD.hash
)
BEGIN
  SELECT RAISE(ABORT, 'hoja firmada: no se puede modificar');
END;

-- Constancia de lo que se hace con las hojas: anulaciones y borrados por
-- supresión (RGPD). Del borrado solo queda qué hoja era, de qué tipo, cuándo
-- y quién: ningún dato de la persona.
CREATE TABLE IF NOT EXISTS registro (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  cuando  TEXT    NOT NULL,
  quien   TEXT    NOT NULL,
  accion  TEXT    NOT NULL CHECK (accion IN ('anulada', 'borrada')),
  hoja    TEXT    NOT NULL,
  tipo    TEXT    NOT NULL DEFAULT '',
  detalle TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS registro_por_hoja ON registro (hoja, accion);

-- Ajustes de la inmobiliaria (marca, textos legales y logo), clave → JSON.
CREATE TABLE IF NOT EXISTS ajustes (
  clave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  actualizado TEXT NOT NULL
);

-- Agentes además del titular (opcional). Clave en PBKDF2-SHA256 con sal.
-- `version` sube al cambiar la clave o dar de baja: cierra sus sesiones.
CREATE TABLE IF NOT EXISTS agentes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT    NOT NULL,
  usuario     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  sal         TEXT    NOT NULL,
  hash        TEXT    NOT NULL,
  iteraciones INTEGER NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  activo      INTEGER NOT NULL DEFAULT 1,
  creado      TEXT    NOT NULL
);

-- Límites de intentos (la clave lleva la IP resumida con HMAC, no en claro).
CREATE TABLE IF NOT EXISTS limites (
  clave    TEXT    NOT NULL,
  ventana  INTEGER NOT NULL,
  cuenta   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (clave, ventana)
);
