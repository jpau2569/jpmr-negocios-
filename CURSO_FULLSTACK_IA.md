# 🎓 Curso Full Stack con IA — Asesoría Castresana

> Curso personal de Pau Moralejo, con Clara como profesora. Objetivo: que Pau entienda y domine **todo lo que ya tiene construido** (Clara, LimpiaFotos, el embudo del ebook, el escaparate) y sea capaz de **crear sus propias apps de principio a fin usando la IA como copiloto**.
>
> Método: cada módulo tiene ① explicación clara y simple, ② práctica sobre TUS proyectos reales, ③ cómo hacerlo con IA (Claude) para ir 10× más rápido. Nada de teoría vacía.
>
> Ritmo sugerido: 1 módulo por semana (30-60 min al día). Se avanza diciendo: **"Clara, dame la lección X.Y"**.

---

## Mapa del curso (9 módulos)

### Módulo 0 — El mapa del territorio 🗺️ (1 sesión)
Qué es "full stack": frontend (lo que se ve), backend (lo que piensa), base de datos (lo que se recuerda) y despliegue (lo que lo pone en Internet). Dónde encaja cada pieza de TUS proyectos en ese mapa.
- **Práctica:** dibujar el mapa de Clara: `clara.html` (frontend) → `api/clara.js` (backend) → Supabase (datos) → Vercel (despliegue).
- **Con IA:** cómo pedirle a Claude que te explique cualquier archivo de tu repo.

### Módulo 1 — HTML y CSS: lo que se ve 🎨 (1-2 semanas)
Etiquetas, estructura, estilos, flexbox/grid, diseño responsive (móvil primero), fuentes y colores de marca.
- **Práctica:** leer `ebook.html` por bloques y hacer TÚ una landing sencilla para un inmueble real de tu cartera (sin IA primero; luego mejorarla con IA).
- **Con IA:** el prompt perfecto para pedir páginas ("estructura + estilo + marca Castresana").

### Módulo 2 — JavaScript: lo que se mueve ⚡ (2 semanas)
Variables, funciones, eventos (clic, teclado), modificar la página (DOM), `fetch` para hablar con servidores, JSON.
- **Práctica:** entender el chat de `clara.html`: qué pasa cuando pulsas "Enviar" (evento → fetch → respuesta → pintar burbuja). Añadir tú un botón nuevo pequeño.
- **Con IA:** depurar errores de consola pegándoselos a Claude.

### Módulo 3 — Backend: lo que piensa 🧠 (2 semanas)
Qué es un servidor, qué es una API, funciones serverless de Vercel, peticiones GET/POST, variables de entorno (por qué las claves NUNCA van en el navegador).
- **Práctica:** leer `api/lead.js` (el más corto) línea a línea; luego `api/clara.js` por secciones. Crear tu primera función propia: `api/hola.js` que devuelva un saludo con tu nombre.
- **Con IA:** pedir endpoints seguros ("valida la entrada, clave en variable de entorno, mensajes de error claros").

### Módulo 4 — Bases de datos: lo que se recuerda 🗄️ (1-2 semanas)
Tablas, filas y columnas. SQL básico (select, insert, where, order by). Supabase: qué es, RLS y por qué tus funciones RPC validan la clave.
- **Práctica:** en TU Supabase real: ver la tabla `clara_leads`, hacer un select, entender `lead_guarda` y `leads_lista` (¡las que ya usamos juntos!).
- **Con IA:** pedir consultas SQL en lenguaje natural y entenderlas antes de ejecutarlas.

### Módulo 5 — APIs de IA: el superpoder 🤖 (2 semanas)
Cómo se habla con Claude por API (mensajes, system prompt, herramientas/tools), qué son los tokens y cuánto cuesta, streaming, y cómo Clara usa Perplexity para buscar.
- **Práctica:** leer el system prompt de Clara en `api/clara.js` y modificar UNA cosa pequeña de su personalidad. Entender el bucle de herramientas (buscar_web → resultado → respuesta).
- **Con IA:** diseñar tu propio mini-asistente para un caso Castresana (p. ej. "respondedor de dudas de arras").

### Módulo 6 — Git y GitHub: la máquina del tiempo ⏳ (1 semana)
Qué es un repositorio, commit, rama, pull request, merge. Por qué nunca se pierde nada. GitHub como centro de todo.
- **Práctica:** mirar el historial real de tu repo (todo lo que hemos hecho juntos está ahí); hacer tu primer commit propio (retocar un texto de `CLARA.md`).
- **Con IA:** dejar que Claude haga los commits pero entendiendo qué está pasando.

### Módulo 7 — Despliegue: ponerlo en el mundo 🚀 (1 semana)
Vercel: proyectos, despliegues automáticos al hacer push, variables de entorno, dominios, crons. Costes reales.
- **Práctica:** LA GRANDE — desplegar Clara de verdad (el paso que tenemos pendiente) entendiendo cada clic. Al terminar este módulo, Clara estará viva y sabrás exactamente por qué funciona.
- **Con IA:** leer logs de errores de despliegue y arreglarlos.

### Módulo 8 — Proyecto final: tu app de cero 🏆 (2-3 semanas)
Con todo lo aprendido: construir TÚ (con Clara de copilota, no de piloto) una app nueva completa para el negocio. Ideas: calculadora de gastos de compraventa para clientes, agenda de visitas, valorador orientativo con captura de leads.
- **Entrega:** app desplegada en Vercel, con su repositorio, su base de datos si la necesita, y funcionando en tu móvil.

---

## Reglas del curso (las de Clara)
1. **Nunca copiar sin entender.** La IA escribe rápido; tú decides y compruebas. Cada lección termina con 2-3 preguntas de comprobación.
2. **Errores = oro.** Cada error real de tus proyectos es una lección gratis.
3. **Proyectos reales siempre.** Nada de "todo lists" de juguete: todo se practica sobre Castresana.
4. **Ritmo honesto.** Si una semana no puedes, el curso te espera. Se retoma con "Clara, ¿por dónde íbamos del curso?".

## Progreso
- [ ] Módulo 0 — El mapa del territorio
- [ ] Módulo 1 — HTML y CSS
- [ ] Módulo 2 — JavaScript
- [ ] Módulo 3 — Backend
- [ ] Módulo 4 — Bases de datos
- [ ] Módulo 5 — APIs de IA
- [ ] Módulo 6 — Git y GitHub
- [ ] Módulo 7 — Despliegue
- [ ] Módulo 8 — Proyecto final

*Última actualización: al crear el curso. Clara marca las casillas según avanzas.*
