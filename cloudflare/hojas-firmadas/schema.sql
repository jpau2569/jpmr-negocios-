-- ============================================================================
--  Esquema D1 de hojas-firmadas (una base de datos por inmobiliaria)
--  Se aplica con:  npx cf d1 migrations apply <ID-DE-LA-D1> --dir . --pattern schema.sql
--  Es idempotente (IF NOT EXISTS): repetirlo no borra nada.
--  OJO: CREATE TABLE IF NOT EXISTS no añade columnas a una tabla que ya
--  existe. Si probaste una versión anterior en local, borra .local/ (o
--  .wrangler/) antes de volver a probar. En Cloudflare aún no hay ninguna D1
--  publicada con la versión anterior.
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
  -- Calculados por el SERVIDOR al recibirla (no los dice el móvil): 1 si los
  -- textos legales (y su «revisados») y la marca de la hoja eran los mismos
  -- que había en Ajustes en ese momento; 0 si se firmó con otra versión
  -- (por ejemplo, sin conexión antes de un cambio de Ajustes).
  textos_al_dia INTEGER NOT NULL DEFAULT 1 CHECK (textos_al_dia IN (0, 1)),
  marca_al_dia  INTEGER NOT NULL DEFAULT 1 CHECK (marca_al_dia IN (0, 1)),
  estado      TEXT    NOT NULL DEFAULT 'firmada' CHECK (estado IN ('firmada', 'anulada')),
  anulada     TEXT,
  motivo      TEXT,
  anulada_por TEXT
);
CREATE INDEX IF NOT EXISTS hojas_por_fecha ON hojas (firmada DESC);

-- INMUTABLES: una hoja firmada no se puede cambiar. Lo único permitido es
-- pasar de 'firmada' a 'anulada' (con fecha, motivo y quién), y una vez
-- anulada ya no se toca. Lo impide la propia base de datos, no solo el código.
-- (Quien tenga acceso a la cuenta de Cloudflare podría quitar el trigger:
-- la prueba de que el PDF del cliente no ha cambiado es el SHA-256.)
CREATE TRIGGER IF NOT EXISTS hojas_inmutables
BEFORE UPDATE ON hojas
WHEN NOT (
  OLD.estado = 'firmada' AND NEW.estado = 'anulada'
  AND NEW.anulada IS NOT NULL AND NEW.motivo IS NOT NULL AND NEW.anulada_por IS NOT NULL
  AND NEW.id = OLD.id AND NEW.tipo = OLD.tipo AND NEW.referencia = OLD.referencia
  AND NEW.inmueble = OLD.inmueble AND NEW.nombre = OLD.nombre AND NEW.busqueda = OLD.busqueda
  AND NEW.agente_id = OLD.agente_id AND NEW.agente = OLD.agente AND NEW.firmada = OLD.firmada
  AND NEW.recibida = OLD.recibida AND NEW.ip = OLD.ip AND NEW.contenido = OLD.contenido
  AND NEW.hash = OLD.hash AND NEW.textos_al_dia = OLD.textos_al_dia AND NEW.marca_al_dia = OLD.marca_al_dia
)
BEGIN
  SELECT RAISE(ABORT, 'hoja firmada: no se puede modificar');
END;

-- Tampoco se puede BORRAR una hoja sin dejar constancia: solo si ya está en
-- el registro la acción 'borrada' para esa hoja (borraHoja la escribe en el
-- mismo batch, ANTES del DELETE).
CREATE TRIGGER IF NOT EXISTS hojas_sin_borrar
BEFORE DELETE ON hojas
WHEN NOT EXISTS (SELECT 1 FROM registro WHERE hoja = OLD.id AND accion = 'borrada')
BEGIN
  SELECT RAISE(ABORT, 'hoja firmada: solo se borra dejando constancia en el registro');
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

-- Versión de la sesión del titular: «Salir» la sube y así la cookie que se
-- llevara alguien deja de valer en el servidor (para los agentes se usa la
-- columna `version` de agentes). Una sola fila, id = 1.
CREATE TABLE IF NOT EXISTS sesion_titular (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  version  INTEGER NOT NULL DEFAULT 0
);

-- Límites de intentos (la clave lleva la IP resumida con HMAC, no en claro).
CREATE TABLE IF NOT EXISTS limites (
  clave    TEXT    NOT NULL,
  ventana  INTEGER NOT NULL,
  cuenta   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (clave, ventana)
);
