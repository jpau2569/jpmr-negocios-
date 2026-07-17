/* ============================================================================
   Iconos — SVG inline, sin dependencias.
   Trazo de 1.6, redondeado, coherente con la estética sobria.
   Heredan `currentColor` y aceptan props SVG estándar (size vía `width/height`
   o el prop `size`).
   ============================================================================ */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const InboxIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 12h4l2 3h6l2-3h4" />
    <path d="M4.5 6.2 3 12v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6l-1.5-5.8A2 2 0 0 0 17.6 5H6.4a2 2 0 0 0-1.9 1.2Z" />
  </Base>
);

export const ExplorerIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z" />
  </Base>
);

export const DashboardIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="7.5" height="9" rx="1.4" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.4" />
    <rect x="13.5" y="12" width="7.5" height="9" rx="1.4" />
    <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.4" />
  </Base>
);

export const PropertyIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 21V9.5L12 4l8 5.5V21" />
    <path d="M9 21v-6h6v6" />
    <path d="M3 21h18" />
  </Base>
);

export const LeadsIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
    <path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 20" />
  </Base>
);

export const SettingsIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
  </Base>
);

export const SearchIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Base>
);

export const WhatsappIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19l-4 1Z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5.8 0 1.2-1 .8-1.5l-1.2-1c-.3-.3-.8-.2-1 .1l-.3.4c-1-.4-1.8-1.2-2.2-2.2l.4-.3c.3-.2.4-.7.1-1l-1-1.2C9.5 8 8.5 8.4 8.5 9.2" />
  </Base>
);

export const MailIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Base>
);

export const PortalIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" />
  </Base>
);

export const PhoneIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.5 3h3l1.5 4-2 1.5a11 11 0 0 0 5 5L15.5 11l4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z" />
  </Base>
);

export const WebIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="M3 8h18M6.5 6.2h.01M9 6.2h.01M12 22h0M8 22h8" />
  </Base>
);

export const PinIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
    <path d="M12 17v3" />
  </Base>
);

export const SendIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12 20 4l-6 16-3-7-7-1Z" />
  </Base>
);

export const FilterIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 5h18M6 12h12M10 19h4" />
  </Base>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m9 5 7 7-7 7" />
  </Base>
);

export const PlusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const BellIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Base>
);

export const BedIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 8v11M3 12h18v7M21 19v-4a3 3 0 0 0-3-3H10v-4h6" />
    <circle cx="7" cy="10" r="1.6" />
  </Base>
);

export const BathIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12V6a2 2 0 0 1 3.4-1.4L9 6" />
    <path d="M3 12h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2Z" />
    <path d="M6 18l-1 2M18 18l1 2" />
  </Base>
);

export const AreaIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M8 4v4M4 8h4M16 20v-4M20 16h-4" />
  </Base>
);

/** Marca / logotipo — monograma geométrico de Castresana. */
export const BrandMark = ({ size = 26, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" {...p}>
    <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--c-carbon-800)" stroke="var(--border-strong)" />
    <path d="M16 6 L25 12 V22 L16 26 L7 22 V12 Z" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
    <path d="M16 6 V26 M7 12 L25 22 M25 12 L7 22" stroke="var(--accent)" strokeWidth="0.8" opacity="0.45" />
    <circle cx="16" cy="16" r="2.4" fill="var(--accent)" />
  </svg>
);
