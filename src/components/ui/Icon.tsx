import type { SVGProps } from "react";

export type IconName =
  | "pulse"
  | "mic"
  | "stop"
  | "keyboard"
  | "check"
  | "chevron"
  | "shield"
  | "clock"
  | "users"
  | "file"
  | "search"
  | "clipboard"
  | "activity"
  | "alert"
  | "info"
  | "refresh"
  | "send"
  | "menu"
  | "x"
  | "lock"
  | "arrow"
  | "eye"
  | "edit";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<IconProps["size"]>, string> = {
  sm: "h-[15px] w-[15px]",
  md: "h-[18px] w-[18px]",
  lg: "h-[22px] w-[22px]",
};

function renderPaths(name: IconName) {
  switch (name) {
    case "pulse":
      return <path d="M3 12h4l2.4-7 4.2 14 2.2-7H21" />;
    case "mic":
      return (
        <>
          <rect x="9" y="2.5" width="6" height="12" rx="3" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" />
        </>
      );
    case "stop":
      return <rect x="6" y="6" width="12" height="12" rx="2" />;
    case "keyboard":
      return (
        <>
          <rect x="2.5" y="5" width="19" height="14" rx="2" />
          <path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01M8 15h8" />
        </>
      );
    case "check":
      return <path d="m5 12 4 4L19 6" />;
    case "chevron":
      return <path d="m9 18 6-6-6-6" />;
    case "shield":
      return (
        <>
          <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      );
    case "users":
      return (
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      );
    case "file":
      return (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M8 13h8M8 17h8" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </>
      );
    case "clipboard":
      return (
        <>
          <rect x="5" y="4" width="14" height="18" rx="2" />
          <path d="M9 4.5h6a1.5 1.5 0 0 0-3-3 1.5 1.5 0 0 0-3 3ZM9 11h6M9 15h6" />
        </>
      );
    case "activity":
      return <path d="M3 12h4l2-6 4 12 2-6h6" />;
    case "alert":
      return (
        <>
          <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </>
      );
    case "info":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </>
      );
    case "refresh":
      return (
        <>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" />
        </>
      );
    case "send":
      return (
        <>
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </>
      );
    case "menu":
      return <path d="M4 6h16M4 12h16M4 18h16" />;
    case "x":
      return <path d="m18 6-12 12M6 6l12 12" />;
    case "lock":
      return (
        <>
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 1 1 8 0v3" />
        </>
      );
    case "arrow":
      return <path d="M5 12h14M13 6l6 6-6 6" />;
    case "eye":
      return (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
    case "edit":
      return (
        <path d="m16 4 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15l-.8 5Z" />
      );
  }
}

export function Icon({
  name,
  size = "md",
  className = "",
  "aria-hidden": ariaHidden = true,
  ...rest
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      className={`inline-block shrink-0 ${SIZE_CLASSES[size]} ${className}`.trim()}
      {...rest}
    >
      {renderPaths(name)}
    </svg>
  );
}
