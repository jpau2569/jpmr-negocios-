/**
 * Logo Castresana — monograma geométrico de trazo fino:
 * una «C» abierta que abraza el perfil de un tejado a dos aguas,
 * dibujada con líneas de 1.5 en cobre sobre carbón.
 */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="Castresana"
    >
      {/* C abierta */}
      <path
        d="M31 9.5A15 15 0 1 0 31 30.5"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Tejado a dos aguas + fuste */}
      <path
        d="M13.5 21.5 20 15l6.5 6.5M20 15v11.5"
        stroke="var(--text-strong)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
