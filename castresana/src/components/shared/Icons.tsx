/* ============================================================================
   Iconografía — SVG inline coherente: trazo 1.6, terminaciones redondeadas.
   Heredan currentColor; tamaño vía prop `size`.
   ============================================================================ */
import type { SVGProps, ReactNode } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function I({ size = 20, children, ...props }: IconProps & { children: ReactNode }) {
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

/* ------------------------------------------------------------ Navegación */

export const InboxIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M3 12h4l2 3h6l2-3h4" />
    <path d="M4.5 6.2 3 12v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6l-1.5-5.8A2 2 0 0 0 17.6 5H6.4a2 2 0 0 0-1.9 1.2Z" />
  </I>
);

export const BuildingIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M4 21V9.5L12 4l8 5.5V21" />
    <path d="M9 21v-6h6v6" />
    <path d="M3 21h18" />
  </I>
);

export const UsersIcon = (p: IconProps) => (
  <I {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
    <path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 20" />
  </I>
);

export const ChartIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M4 4v16h16" />
    <path d="M8 15v-4M12 15V8M16 15v-6" />
  </I>
);

export const CalendarIcon = (p: IconProps) => (
  <I {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </I>
);

export const SettingsIcon = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
  </I>
);

/* ------------------------------------------------------------- Acciones */

export const SearchIcon = (p: IconProps) => (
  <I {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </I>
);

export const SendIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M4 12 20 4l-6 16-3-7-7-1Z" />
  </I>
);

export const PlusIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M12 5v14M5 12h14" />
  </I>
);

export const FilterIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M3 5h18M6 12h12M10 19h4" />
  </I>
);

export const BellIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </I>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <I {...p}>
    <path d="m15 5-7 7 7 7" />
  </I>
);

export const ChevronRightIcon = (p: IconProps) => (
  <I {...p}>
    <path d="m9 5 7 7-7 7" />
  </I>
);

export const MoreIcon = (p: IconProps) => (
  <I {...p}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </I>
);

export const PinIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
    <path d="M12 17v3" />
  </I>
);

export const PaperclipIcon = (p: IconProps) => (
  <I {...p}>
    <path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.5 17a1.7 1.7 0 0 1-2.4-2.4L15 6.7" />
  </I>
);

/* ---------------------------------------------------------------- Canales */

export const WhatsappIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19l-4 1Z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5.8 0 1.2-1 .8-1.5l-1.2-1c-.3-.3-.8-.2-1 .1l-.3.4c-1-.4-1.8-1.2-2.2-2.2l.4-.3c.3-.2.4-.7.1-1l-1-1.2C9.5 8 8.5 8.4 8.5 9.2" />
  </I>
);

export const MailIcon = (p: IconProps) => (
  <I {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </I>
);

export const GlobeIcon = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" />
  </I>
);

export const PhoneIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M6.5 3h3l1.5 4-2 1.5a11 11 0 0 0 5 5L15.5 11l4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z" />
  </I>
);

export const MonitorIcon = (p: IconProps) => (
  <I {...p}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </I>
);

/* --------------------------------------------------------------- Dominio */

export const EuroIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M17.5 5.5A7.5 7.5 0 1 0 17.5 18.5" />
    <path d="M4 10.2h9M4 13.8h9" />
  </I>
);

export const MapPinIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" />
    <circle cx="12" cy="10.3" r="2.3" />
  </I>
);

export const TagIcon = (p: IconProps) => (
  <I {...p}>
    <path d="m3.8 12.2 8-8H20v8.2l-8 8a1.8 1.8 0 0 1-2.6 0l-5.6-5.6a1.8 1.8 0 0 1 0-2.6Z" />
    <circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none" />
  </I>
);

export const CheckIcon = (p: IconProps) => (
  <I {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </I>
);

export const ClockIcon = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </I>
);

export const NoteIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M5 4h14v12l-4 4H5V4Z" />
    <path d="M15 20v-4h4M9 9h6M9 13h4" />
  </I>
);

/* --------------------------------------------------------------- Tema */

export const SunIcon = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.3 4.3l1.4 1.4M18.3 18.3l1.4 1.4M2.5 12h2M19.5 12h2M4.3 19.7l1.4-1.4M18.3 5.7l1.4-1.4" />
  </I>
);

export const MoonIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />
  </I>
);
