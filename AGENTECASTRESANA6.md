# AGENTE CASTRESANA 6

Red de **6 agentes IA con nombre propio** para Asesoría Castresana (Oviedo, desde 1993).
Evolución de AGENTE CASTRESANA 4: se mantienen los 4 agentes originales y se incorporan
**NURIA** y **NICER** para cubrir los dos huecos que quedaban sin dueño: los alquileres
y el marketing/escaparate.

Inspiración: LetsProw ("AI employees") → versión Castresana: **"el equipo que no duerme,
sin perder el trato humano"**.

## Posicionamiento

- No vender "IA", vender experiencia desde 1993 multiplicada: responde, filtra, capta y hace seguimiento 24/7.
- Tono: profesional, cercano, asturiano. Nada de startup genérica.
- El propio sistema es la demo para venderlo a otros negocios (dentales, despachos, gestorías, farmacias).

## Los 6 agentes

### JUANJO — Captador (compradores e inquilinos)
- Leads de web, WhatsApp y portales (Idealista, Fotocasa).
- Cualifica: compra/alquiler, presupuesto, zona, urgencia.
- Detecta intención real → agenda visita (integración: Castresana Visitas v2).
- Si el lead es de **alquiler**, tras cualificarlo lo pasa a NURIA.

### JAVI — Valorador (propietarios vendedores)
- Caza propietarios vendedores.
- Recoge: dirección, m², estado, zona, motivo de venta.
- Prevaloración orientativa (lógica arras-asturias) → dispara secuencia de captación D0–D21.

### ALEJANDRO — Asesor + Documental
- Primeras dudas fiscal / laboral / contable / administración de fincas.
- Pide documentos, clasifica expediente, resume conversación.
- Deriva a humano cuando hay caso técnico. (Fusiona 2 roles del planteamiento original.)

### PAU (bot) — Seguimiento y cierre
- Reactiva leads fríos (WhatsApp, formulario, portales).
- Secuencias post-visita, postventa, petición de reseñas y recomendaciones.
- Es el agente que convierte.

### NURIA — Alquileres y gestión de inquilinos **(nueva)**
El hueco que cubre: JUANJO cualifica alquiler pero nadie lo gestionaba de principio a fin.
- Atiende la demanda de alquiler que le pasa JUANJO: filtra candidatos (situación laboral,
  ingresos orientativos, avales, mascotas, fecha de entrada) antes de que llegue a un humano.
- Prepara el expediente de alquiler: lista de documentos al candidato (DNI, nóminas/renta,
  vida laboral) y avisa cuando el expediente está completo → hot-lead a Telegram.
- Lado propietario-arrendador: explica el servicio de gestión de alquiler de Castresana,
  recoge datos del piso y expectativa de renta.
- Post-firma: canal de incidencias del inquilino (averías, recibos, dudas de contrato,
  renovaciones); clasifica la incidencia (urgente / normal / administrativa) y la deriva
  al humano o a ALEJANDRO (administración de fincas) según toque.
- Nunca aprueba ni rechaza candidatos, nunca promete rentas ni condiciones: propone y
  el equipo humano decide.

### NICER — Marketing, escaparate y el informe de cada mañana **(nuevo)**
El hueco que cubre: nadie producía el material comercial ni medía lo que hacen los otros cinco.
Es "el agente que trabaja de noche".
- Redacta fichas comerciales y anuncios para Idealista/Fotocasa a partir de los datos del
  inmueble (título, descripción larga, descripción corta, destacados), en tono Castresana.
- Genera los textos y piezas para redes (Instagram/TikTok/YouTube) de cada inmueble nuevo
  o vendido, apoyándose en las skills existentes (contenido-social-pau, infografias-castresana).
- Alimenta el **escaparate de la TV del local** (`escaparate.html`): decide qué inmuebles
  destacar y con qué reclamo.
- **Informe de las 8:00**: cada mañana resume la actividad de los otros 5 agentes — leads
  nuevos y su origen, cualificados por JUANJO, valoraciones de JAVI, expedientes de NURIA,
  reactivaciones de PAU — con 1-3 acciones recomendadas para el día. Vía Telegram.
- Nunca publica nada directamente en portales ni redes: entrega borradores; publica el humano.

## Cómo se reparten un lead (flujo)

1. Entra un contacto → **JUANJO** lo cualifica.
2. ¿Quiere **vender**? → **JAVI**. ¿Quiere **alquilar** (como inquilino o arrendador)? → **NURIA**.
3. ¿Duda fiscal/laboral/fincas o hay que montar expediente? → **ALEJANDRO**.
4. ¿Lead frío, post-visita o postventa? → **PAU (bot)**.
5. Todo lo que pasa queda registrado → **NICER** lo convierte en material comercial e informe diario.

## Arquitectura

### MVP (1.0) — ~2 semanas
- Widget CasteBot en asesoriacastresana.com con selector "¿Con quién quieres hablar?" (6 fichas).
- 6 prompts maestros sobre el mismo backend Node + Claude API (carpeta `agentes/`, un archivo por agente).
- Hot-lead → aviso Telegram (reutilizar castresana-bot). NICER usa el mismo canal para el informe de las 8:00.
- BD: PostgreSQL en VPS Hostinger.

### v2.0
- WhatsApp Business API (canal principal real en Oviedo).
- Fichas de cada agente con foto/avatar en la web.
- CRM con scoring de leads (crm-leads-engine).
- NURIA conectada al calendario de incidencias/renovaciones (avisos automáticos de vencimiento).

### Futuro
- JAVI proactivo: scraping de particulares (firecrawl-inmo-bridge) → captación automática.
- NICER proactivo: publica en escaparate sin intervención y propone calendario editorial semanal.
- Multi-tenant: mismo sistema empaquetado para clientes B2B.

## Plan paso a paso
1. ✅ Redactar los 6 prompts maestros (tono Castresana + límites de actuación por agente) → carpeta `agentes/`.
2. Desplegar widget multi-agente en la web reutilizando CasteBot (selector de 6).
3. Test 1 semana con leads reales → ajustar cualificación de JUANJO, umbrales hot-lead y filtro de candidatos de NURIA.
4. Activar el informe diario de NICER cuando los otros 5 lleven una semana registrando actividad.

## Próxima sesión (Claude Code)
- [x] Prompt maestro de JUANJO → `agentes/juanjo.md`
- [x] Prompt maestro de JAVI → `agentes/javi.md`
- [x] Prompt maestro de ALEJANDRO → `agentes/alejandro.md`
- [x] Prompt maestro de PAU → `agentes/pau-bot.md`
- [x] Prompt maestro de NURIA → `agentes/nuria.md`
- [x] Prompt maestro de NICER → `agentes/nicer.md`
- [x] Adaptar backend CasteBot a selector de 6 agentes → `api/castebot.js` + `castebot.html` (carga `_comunes.md` + `agentes/<nombre>.md`)
- [x] Definir el aviso Telegram de hot-lead con formato común para los 6 → bloque `[[HOTLEAD]]` que el backend extrae, envía a Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) y oculta al cliente
- [ ] Configurar en Vercel las variables `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` (reutilizar castresana-bot) y probar un hot-lead real
- [ ] Test 1 semana con leads reales → ajustar cualificación de JUANJO y filtro de NURIA
