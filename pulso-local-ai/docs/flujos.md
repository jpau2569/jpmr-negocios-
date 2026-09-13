# Flujos de usuario

Los siete recorridos que tiene que resolver el producto, con lo que pasa por
dentro en cada paso.

## 1. Propietario que quiere vender

```
Ve el cartel «¿Cuánto vale tu casa?» en el escaparate
   └─ escanea → /q/castresana-valoracion
        ├─ qr_scan_events + evento qr_landing_view
        └─ redirige a /b/asesoria-castresana/valoracion?qr=castresana-valoracion
              └─ 6 pasos: tipo → objetivo → zona → tamaño → estado → contacto
                    └─ POST /api/publico/valoracion
                          ├─ cupo + Zod + honeypot + negocio activo
                          ├─ leads (tipo valuation_request, fuente qr, qr_id)
                          ├─ valuation_requests (los datos del inmueble)
                          ├─ consent_records (versión, fecha, hash de IP)
                          └─ evento valuation_submit
                    └─ «Hemos recibido tu solicitud. Un profesional revisará
                        los datos y contactará contigo.»
```

En el panel aparece en **Contactos** como nuevo, con el QR de origen. **No se le
ha dado ningún precio automático**: eso lo hace una persona.

## 2. Comprador que busca vivienda

```
/b/<slug>/inmuebles → filtra por operación, tipo y municipio
   ├─ nada encaja → /buscar-vivienda → buyer_requests + lead (buyer o tenant)
   └─ algo encaja → ficha del inmueble (evento property_view, contador +1)
         ├─ galería, datos, características, mapa de zona (no la dirección exacta)
         ├─ CTA fijo en móvil: visita · WhatsApp · llamar
         └─ «Si no encaja, cuéntanos qué buscas»
```

## 3. Persona que escanea el QR de una vivienda

```
Cartel en el balcón → /q/castresana-demo-001
   ├─ se cuenta el escaneo
   └─ /b/<slug>/inmuebles/<slug-del-piso>?qr=…
         └─ «Solicitar visita» → POST /api/publico/visita
               ├─ lead (fuente inmueble, property_id)
               ├─ visit_requests (modo, fecha y franja preferidas)
               └─ evento visit_request_submit
```

El equipo lo ve en **Visitas** como pendiente, con el inmueble asociado y el
teléfono. Confirmar cambia el estado; **no** crea ningún evento de calendario.

Si ese piso se vende, se cambia el destino del QR desde el panel y el cartel
sigue sirviendo.

## 4. Cliente que pide cita de asesoría

```
/b/<slug> → tarjeta «Asesoría fiscal, laboral y jurídica»
   └─ /contacto?tipo=tax_labor_legal_consultation
         └─ lead con ese tipo → el panel lo filtra por área
```

Si por el camino pregunta al asistente algo fiscal, el asistente **no responde**:
deriva a una persona. Esa regla está probada en `test/asistente.test.mjs`.

## 5. Usuario que deja su opinión

```
Tarjeta al salir de la oficina → /q/castresana-opinion → /b/<slug>/opinion
   ├─ 1 a 5 estrellas
   ├─ comentario privado (opcional, sin pedir datos personales)
   ├─ «quiero que me contactéis» → entonces sí: contacto + consentimiento
   └─ enlace a Google SIEMPRE visible, con cualquier nota
         └─ evento google_review_click al pulsarlo
```

Nota baja → aparece destacada en **Opiniones** para que alguien la atienda.
Nota alta → el texto invita a compartirla en Google, sin ofrecer nada a cambio.

## 6. El SaaS crea una demo de 7 días

```
/admin → «Nueva demo»
   ├─ nombre, teléfonos, ciudad, días, plantilla
   ├─ opcional: copiar servicios y FAQs de otro negocio
   │     (solo contenido editorial; nunca contactos, opiniones ni analítica)
   └─ crea: businesses (trial, trial_ends_at = ahora + N días, en UTC)
            + business_settings + trial_settings + subscriptions
            + texto legal v1
```

Desde ese momento `/b/<slug>` funciona. El panel del cliente enseña
«Demo activa: quedan X días»; **el visitante no ve ese aviso**.

Al vencer, sin que haga falta ningún proceso: las vistas públicas dejan de
devolver filas, `/b/<slug>` redirige a `/trial-expired/<slug>` y el alta de leads
responde 410. El cron de las 03:00 solo pone el estado en `expired`.

## 7. La demo se convierte en cliente

```
/admin → ficha del negocio → «Cliente activo»
   ├─ businesses.status = active, trial_ends_at = null
   └─ subscriptions.status = active, plan = basico
```

Todo el contenido sigue donde estaba. Lo único que cambia es que ya no caduca.
