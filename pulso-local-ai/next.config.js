const config = {
    reactStrictMode: true,
    // Las fotos de los platos vivirán en Supabase Storage. Se declara el patrón
    // para poder usar next/image sin abrir la puerta a cualquier dominio.
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
        ],
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
                ],
            },
        ];
    },
};
export default config;
