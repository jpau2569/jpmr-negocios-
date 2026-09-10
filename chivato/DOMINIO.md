# Chivato AI en su propio dominio

Guía para el día que registres `chivato.ai` (o el dominio que sea). Está
escrita para hacerla de arriba abajo en una tarde.

---

## Antes de registrar: comprueba el nombre

1. **El dominio.** `chivato.ai` en cualquier registrador (`.ai` es caro, unos
   60-100 €/año; `chivatoai.com` o `chivato.app` salen por 10-15 €).
2. **Las redes.** Aunque no las vayas a usar todavía, coge el nombre en
   Instagram, TikTok y X antes de anunciarlo. Cuesta cinco minutos y evita que
   te lo pillen.
3. **Que no haya marca registrada.** Búscalo en la [OEPM](https://www.oepm.es)
   y en [EUIPO](https://euipo.europa.eu) antes de imprimir nada.

---

## Opción A — el dominio apunta al monorepo (lo más rápido)

No hay que crear ningún proyecto nuevo: se le añade el dominio al que ya
tienes desplegado.

1. Vercel → tu proyecto → **Settings → Domains → Add** → `chivato.ai`.
2. Vercel te dirá qué poner en el DNS del registrador (normalmente un
   registro `A` a `76.76.21.21` y un `CNAME` de `www`). Cópialo tal cual.
3. Espera a que el certificado se emita (unos minutos, a veces una hora).
4. En `vercel.json`, redirige la raíz del dominio nuevo a la app:

```json
{
  "redirects": [
    { "source": "/", "has": [{ "type": "host", "value": "chivato.ai" }],
      "destination": "/chivato/", "permanent": false }
  ]
}
```

**Ventaja:** cero mantenimiento, la clave `ANTHROPIC_API_KEY` ya está puesta.
**Inconveniente:** Chivato comparte proyecto con el resto del monorepo, así
que un despliegue que rompa otra cosa también afecta aquí.

---

## Opción B — proyecto propio (lo limpio si Chivato crece)

La carpeta `chivato/` es autosuficiente: lleva su `api/`, su `vercel.json` y
su `package.json`.

1. Vercel → **Add New → Project** → el mismo repositorio.
2. **Root Directory = `chivato`**. Framework: *Other*.
3. **Environment Variables** → `ANTHROPIC_API_KEY` con tu clave.
4. **Settings → Domains** → `chivato.ai`, y el DNS como te indique.
5. Deploy.

Así `chivato.ai/` es directamente la app —que es lo que quieres: alguien
parado en el arcén escribe el dominio y ve el botón de la foto sin más
pantallas por medio— y `/api/chivato` queda dentro del mismo proyecto.

La ficha de presentación (`chivato.html`) se queda en el monorepo: es la
página con texto para enseñar y compartir, y no estorba en el dominio de la
app.

---

## Después de apuntar el dominio: dos comandos

```bash
# 1. Enlace, QR y cartel, y las direcciones absolutas de las etiquetas
node chivato/herramientas/generar-enlace.mjs --dominio chivato.ai

# 2. Comprueba que todo sigue cuadrando
npm test
```

El primero escribe:

| Archivo | Para qué |
|---|---|
| `chivato/qr.svg` | El QR en vectorial: vale igual para una pegatina que para un cartel A3 |
| `chivato/comparte.html` | Cartel con el QR, el enlace, botón de WhatsApp y botón de imprimir |

Y deja `canonical`, `og:url` y `og:image` con la dirección **absoluta** del
dominio nuevo. Eso último no es un detalle: si `og:image` es relativa, al
pegar el enlace en WhatsApp sale un enlace pelado en vez de la tarjeta con el
logo, y eso se nota mucho a la hora de que alguien lo abra.

---

## Comprobaciones antes de anunciarlo

- [ ] `https://chivato.ai` abre la app y el botón de la foto funciona.
- [ ] Analiza una foto de verdad: la clave de la IA está bien puesta.
- [ ] Se instala en el móvil (Android: menú → *Instalar aplicación*;
      iPhone: compartir → *Añadir a pantalla de inicio*).
- [ ] Con el móvil en modo avión, el catálogo de símbolos sigue abriéndose.
- [ ] Pega el enlace en un chat de WhatsApp contigo mismo: tiene que salir la
      tarjeta con el logo y el texto.
- [ ] Escanea el QR de `comparte.html` con la cámara del móvil.
- [ ] Pasa el banco de calibración con tus fotos apuntando al dominio nuevo:
      `node chivato/herramientas/calibrar.mjs <carpeta> --url https://chivato.ai/api/chivato`

---

## Dónde poner el QR

- **Cartel en el escaparate del local**, junto al escaparate 3D. Imprímelo
  desde `comparte.html` con el botón de imprimir: la versión impresa sale en
  blanco y negro, con el QR grande y sin los botones.
- **Pegatina en la carpeta de las visitas**: mientras enseñas un piso también
  hablas de coches.
- **Firma del correo** y estado de WhatsApp.
- **Tarjeta**: por detrás, el QR y una línea — *«¿se te enciende una luz en el
  coche? Hazle una foto»*.

---

## Si cambias de dominio más adelante

Vuelve a lanzar `generar-enlace.mjs` con el dominio nuevo y despliega: se
regeneran el QR, el cartel y las etiquetas. El dominio viejo conviene dejarlo
redirigiendo al nuevo por lo menos un año, porque los QR impresos siguen por
ahí.
