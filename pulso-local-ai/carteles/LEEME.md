# Carteles de muestra

Generados con `NEXT_PUBLIC_SITE_URL=https://pulsolocal.ai`, que **todavía no
existe**. Sirven para ver el diseño y el tamaño; **no imprimas la tirada hasta
tener el dominio definitivo**, porque un QR impreso con la URL vieja no se
arregla.

| Archivo | Tamaño | Dónde va |
|---|---|---|
| `taberna-A5-carta.svg` | A5 (148 × 210 mm) | Escaparate de La Taberna |
| `taberna-A5-menu-del-dia.svg` | A5 | Junto a la pizarra del menú |
| `taberna-mesa.svg` | 70 × 90 mm | Pie de mesa |
| `taberna-ticket.svg` | 70 × 90 mm | Mostrador, junto al datáfono |
| `lavina-A5-grupos.svg` | A5 | Entrada de La Viña, para celebraciones |
| `lavina-mesa.svg` | 70 × 90 mm | Pie de mesa |

Los colores salen del tema de cada negocio, así que no desentonan con el local.

## Regenerarlos con la URL definitiva

```bash
cd pulso-local-ai
NEXT_PUBLIC_SITE_URL=https://tu-dominio-real npm run build && npx next start -p 3000
# y desde /dashboard/qr, o directamente:
curl "http://localhost:3000/api/qr/twb-escap?negocio=thewhitebar-mieres&destino=menu&formato=a5" -o cartel.svg
```

## Antes de imprimir

1. Ábrelo y **escanéalo con tu móvil**: tiene que abrir la página correcta.
2. Imprime **sin escalar** («tamaño real»), no «ajustar a la página».
3. Cartulina mate mejor que papel brillo: el brillo refleja y el móvil no lee.
