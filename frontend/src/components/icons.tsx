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

export const IconPencil = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
    />
  </svg>
);

export const IconPlus = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.5v15m7.5-7.5h-15"
    />
  </svg>
);

export const IconInformationCircle = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
    />
  </svg>
);

export const IconTrash = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    />
  </svg>
);

export const IconClock = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export const IconEllipsisHorizontal = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
    />
  </svg>
);

export const IconChevronDown = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

export const IconCheck = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

export const IconSettings = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export const IconMapPin = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
    />
  </svg>
);

export const IconExternalLink = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 015.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
    />
  </svg>
);

export const IconUsersCircle = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
    />
  </svg>
);

// Новые осмысленные иконки для админки
export const IconEventTag = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 6h.008v.008H6V6z"
    />
  </svg>
);

export const IconGroupTag = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export const IconParticipantGroup = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
    />
  </svg>
);

export const IconSearch = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
    />
  </svg>
);

export const IconClipboardDocumentList = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
    />
  </svg>
);

export const IconDocumentText = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
    />
  </svg>
);

export const IconUserPlus = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125c-.621 0-1.125.504-1.125 1.125v9.75c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125v-9.75c0-.621-.504-1.125-1.125-1.125h-9.75zM12 12.75a.75.75 0 01-.75-.75V9a.75.75 0 011.5 0v3c0 .414-.336.75-.75.75zM12 15.75a.75.75 0 000-1.5.75.75 0 000 1.5z"
    />
  </svg>
);

export const IconClipboardDocument = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
    />
  </svg>
);

export const IconArrowDownTray = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);

export const IconEye = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

export const IconCalendarDownload = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15a1.5 1.5 0 011.5 1.5V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V8.25a1.5 1.5 0 011.5-1.5z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 12.75L12 18M12 12.75L9 15.75M12 12.75L15 15.75"
    />
  </svg>
);

export const IconCalendarSubscribe = ({ size = 20, ...props }: Props) => (
  <svg {...base} width={size} height={size} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15a1.5 1.5 0 011.5 1.5V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V8.25a1.5 1.5 0 011.5-1.5z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9.75v6m3-3H9"
    />
  </svg>
);