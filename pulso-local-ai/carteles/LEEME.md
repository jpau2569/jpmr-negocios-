# Carteles

Generados con `NEXT_PUBLIC_SITE_URL=https://pulso-local-ai.vercel.app`, que es
la dirección **real y desplegada**. Los seis QR se han verificado uno a uno
reconstruyendo cada matriz QR por separado y comparándola con la impresa en el
SVG. La forma de regenerarlos está más abajo.

| Archivo | Tamaño | Dónde va | A dónde lleva |
|---|---|---|---|
| `taberna-A5-carta.svg` | A5 (148 × 210 mm) | Escaparate de La Taberna | `/b/thewhitebar-mieres/carta` |
| `taberna-A5-menu-del-dia.svg` | A5 | Junto a la pizarra del menú | `/b/thewhitebar-mieres/menu-del-dia` |
| `taberna-mesa.svg` | 70 × 90 mm | Pie de mesa | `/b/thewhitebar-mieres` |
| `taberna-ticket.svg` | 70 × 90 mm | Mostrador, junto al datáfono | `/b/thewhitebar-mieres/opinion` |
| `lavina-A5-grupos.svg` | A5 | Entrada de La Viña, para celebraciones | `/b/la-vina-cenera/grupos` |
| `lavina-mesa.svg` | 70 × 90 mm | Pie de mesa | `/b/la-vina-cenera` |

Cada QR lleva su `?qr=<token>` para poder medir de qué cartel viene cada visita.
Los colores salen del tema de cada negocio, así que no desentonan con el local.

## Aviso: el dominio propio

Si algún día se compra `pulsolocal.ai` y se apunta al proyecto, **estos carteles
dejan de servir** y hay que regenerarlos. Un QR impreso con la URL vieja no se
arregla. Por eso conviene decidir el dominio antes de hacer la tirada grande.

## Regenerarlos

```bash
cd pulso-local-ai
NEXT_PUBLIC_SITE_URL=https://tu-dominio npm run build && npx next start -p 3000
curl "http://localhost:3000/api/qr/twb-escap?negocio=thewhitebar-mieres&destino=menu&formato=a5" -o cartel.svg
```

Tokens disponibles: `twb-mesa`, `twb-barra`, `twb-ticket`, `twb-escap`,
`twb-redes` para La Taberna; `lv-mesa`, `lv-grupos`, `lv-ticket`, `lv-redes`
para La Viña. Destinos: `landing`, `menu`, `daily_menu`, `reservation`,
`group`, `review`. Formatos: `png`, `svg`, `a5`, `mesa`.

## Antes de imprimir

1. Ábrelo y **escanéalo con tu móvil**: tiene que abrir la página correcta.
2. Imprime **sin escalar** («tamaño real»), no «ajustar a la página».
3. Cartulina mate mejor que papel brillo: el brillo refleja y el móvil no lee.
