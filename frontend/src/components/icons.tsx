import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

const base = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  viewBox: "0 0 24 24",
  strokeWidth: 1.5,
  stroke: "currentColor",
} as const;

export const IconHome = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 12l8.954-8.955a1.125 1.125 0 011.592 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
    />
  </svg>
);

export const IconCalendar = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15a1.5 1.5 0 011.5 1.5V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V8.25a1.5 1.5 0 011.5-1.5z"
    />
  </svg>
);

export const IconUsers = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 19.128a3.375 3.375 0 00-6 0M4.5 8.25a3.75 3.75 0 107.5 0 3.75 3.75 0 00-7.5 0zM18.75 8.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM18 19.128a2.625 2.625 0 00-3.113-2.574"
    />
  </svg>
);

export const IconTag = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 9V6a1.5 1.5 0 011.5-1.5h3l8.25 8.25a1.5 1.5 0 010 2.121l-5.379 5.379a1.5 1.5 0 01-2.121 0L3.75 12v-3A1.5 1.5 0 015.25 7.5H6z"
    />
    <path d="M9.75 6.75h.008v.008H9.75V6.75z" />
  </svg>
);

export const IconTags = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 9V6a1.5 1.5 0 011.5-1.5h3l8.25 8.25a1.5 1.5 0 010 2.121l-5.379 5.379a1.5 1.5 0 01-2.121 0L3.75 12v-3A1.5 1.5 0 015.25 7.5H6z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.25 6.75V6a1.5 1.5 0 011.5-1.5h.75"
    />
  </svg>
);

export const IconGrid = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h4.5v4.5h-4.5v-4.5zM3.75 12.75h4.5v4.5h-4.5v-4.5zM9.75 6.75h4.5v4.5h-4.5v-4.5zM9.75 12.75h4.5v4.5h-4.5v-4.5zM15.75 6.75h4.5v10.5h-4.5V6.75z"
    />
  </svg>
);

export const IconChevronLeft = ({ size = 18, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 19.5L7.5 12l6.75-7.5" />
  </svg>
);

export const IconChevronRight = ({ size = 18, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 4.5L16.5 12l-6.75 7.5" />
  </svg>
);

export const IconBars3 = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

export const IconX = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const IconUser = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
    />
  </svg>
);

export const IconLogout = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
    />
  </svg>
);

