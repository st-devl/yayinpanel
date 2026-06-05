import { cn } from "@/lib/utils";
import {
  Archive,
  ArrowRight,
  BadgeCheck,
  BadgeInfo,
  Ban,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  CircleX,
  Clock,
  Cloud,
  CloudOff,
  CloudUpload,
  DatabaseBackup,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileCheck,
  FilePenLine,
  FileText,
  FilterX,
  Globe,
  Grid3X3,
  History,
  Hourglass,
  Image,
  ImageOff,
  ImagePlus,
  KeyRound,
  LayoutDashboard,
  Link as LinkIcon,
  Link2,
  List,
  LoaderCircle,
  Lock,
  Mail,
  Network,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Send,
  Settings,
  Share2,
  Sparkles,
  Tag,
  Trash2,
  Unlink,
  Upload,
  UserCircle
} from "lucide-react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

type MaterialIconProps = {
  name: string;
  className?: string;
  fill?: boolean;
  size?: number;
};

export function MaterialIcon({
  name,
  className,
  fill = false,
  size
}: MaterialIconProps) {
  const Icon = iconMap[name] ?? CircleHelp;
  const iconSize = size ?? 24;
  const style = {
    "--icon-size": `${iconSize}px`
  } as CSSProperties;

  return (
    <span
      className={cn(
        "inline-flex h-[var(--icon-size)] w-[var(--icon-size)] shrink-0 items-center justify-center align-middle leading-none",
        name === "progress_activity" && "animate-spin",
        className
      )}
      style={style}
      aria-hidden="true"
    >
      <Icon
        aria-hidden="true"
        className={fill ? "fill-current" : undefined}
        size={iconSize}
        strokeWidth={2}
      />
    </span>
  );
}

const iconMap: Record<string, LucideIcon> = {
  account_circle: UserCircle,
  add: Plus,
  add_a_photo: ImagePlus,
  add_link: Link2,
  add_photo_alternate: ImagePlus,
  arrow_forward: ArrowRight,
  article: FileText,
  auto_awesome: Sparkles,
  backup: DatabaseBackup,
  block: Ban,
  calendar_month: CalendarDays,
  calendar_today: CalendarDays,
  cancel: CircleX,
  check_circle: CheckCircle,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: CircleX,
  cloud: Cloud,
  cloud_off: CloudOff,
  cloud_upload: CloudUpload,
  dashboard: LayoutDashboard,
  delete: Trash2,
  download: Download,
  draft: FilePenLine,
  edit: FilePenLine,
  error: CircleAlert,
  fact_check: FileCheck,
  filter_alt_off: FilterX,
  grid_view: Grid3X3,
  history: History,
  hourglass_top: Hourglass,
  hub: Network,
  image_not_supported: ImageOff,
  info: BadgeInfo,
  inventory_2: Archive,
  key: KeyRound,
  link: LinkIcon,
  link_off: Unlink,
  list: List,
  lock: Lock,
  mail: Mail,
  notifications: Bell,
  open_in_new: ExternalLink,
  pending_actions: Clock,
  perm_media: Image,
  photo_camera: Camera,
  play_arrow: Play,
  progress_activity: LoaderCircle,
  refresh: RefreshCw,
  rocket_launch: Rocket,
  save: Save,
  schedule: Clock,
  schedule_send: Send,
  send: Send,
  settings: Settings,
  share: Share2,
  tag: Tag,
  task_alt: CheckCircle,
  timer: Clock,
  upload: Upload,
  verified: BadgeCheck,
  videocam_off: ImageOff,
  visibility: Eye,
  visibility_off: EyeOff,
  warning: CircleAlert,
  web: Globe
};
