// El manifest es común a todos los negocios: quien instala la PWA instala el
// espacio del negocio que esté viendo, y el nombre real lo pone cada página.
export default function manifest() {
    return {
        name: "Pulso Local AI",
        short_name: "Pulso Local",
        description: "Carta, menú del día y reservas de tu local.",
        start_url: "/",
        display: "standalone",
        background_color: "#0e0f11",
        theme_color: "#17181b",
        lang: "es",
        icons: [
            { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
