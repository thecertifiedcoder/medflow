import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  AudioLines,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock,
  FileText,
  History,
  Inbox,
  Info,
  ListOrdered,
  Loader2,
  Lock,
  Menu,
  Mic,
  MicOff,
  Minus,
  PencilLine,
  Plus,
  Quote,
  RefreshCw,
  ScanText,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Square,
  User,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "activity"
  | "alert"
  | "arrow"
  | "arrowLeft"
  | "arrowUpDown"
  | "audioLines"
  | "calculator"
  | "check"
  | "checkCircle"
  | "chevron"
  | "chevronDown"
  | "chevronLeft"
  | "circleAlert"
  | "clipboard"
  | "clock"
  | "edit"
  | "file"
  | "history"
  | "inbox"
  | "info"
  | "list"
  | "loader"
  | "lock"
  | "menu"
  | "mic"
  | "micOff"
  | "minus"
  | "plus"
  | "pulse"
  | "quote"
  | "refresh"
  | "scanText"
  | "search"
  | "send"
  | "shield"
  | "shieldCheck"
  | "square"
  | "user"
  | "userCheck"
  | "users"
  | "wifi"
  | "wifiOff"
  | "x";

export type IconSize = "sm" | "btn" | "md" | "lg" | "xl";

const ICON_MAP: Record<IconName, LucideIcon> = {
  activity: Activity,
  alert: AlertTriangle,
  arrow: ArrowRight,
  arrowLeft: ArrowLeft,
  arrowUpDown: ArrowUpDown,
  audioLines: AudioLines,
  calculator: Calculator,
  check: Check,
  checkCircle: CheckCircle2,
  chevron: ChevronRight,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  circleAlert: CircleAlert,
  clipboard: ClipboardList,
  clock: Clock,
  edit: PencilLine,
  file: FileText,
  history: History,
  inbox: Inbox,
  info: Info,
  list: ListOrdered,
  loader: Loader2,
  lock: Lock,
  menu: Menu,
  mic: Mic,
  micOff: MicOff,
  minus: Minus,
  plus: Plus,
  pulse: Activity,
  quote: Quote,
  refresh: RefreshCw,
  scanText: ScanText,
  search: Search,
  send: Send,
  shield: ShieldAlert,
  shieldCheck: ShieldCheck,
  square: Square,
  user: User,
  userCheck: UserCheck,
  users: Users,
  wifi: Wifi,
  wifiOff: WifiOff,
  x: X,
};

const SIZE_CLASSES: Record<IconSize, string> = {
  sm: "mf-icon--sm",
  btn: "mf-icon--btn",
  md: "mf-icon--md",
  lg: "mf-icon--lg",
  xl: "mf-icon--xl",
};

export interface IconProps {
  name: IconName;
  size?: IconSize;
  spin?: boolean;
  className?: string;
  title?: string;
}

export function Icon({
  name,
  size = "md",
  spin = false,
  className = "",
  title,
}: IconProps) {
  const Component = ICON_MAP[name];
  const strokeWidth = size === "xl" ? 1.75 : 2;

  return (
    <Component
      strokeWidth={strokeWidth}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      role={title ? "img" : undefined}
      className={`mf-icon ${SIZE_CLASSES[size]} ${spin ? "mf-icon--spin" : ""} ${className}`.trim()}
    />
  );
}
