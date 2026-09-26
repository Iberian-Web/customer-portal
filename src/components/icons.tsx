// customer-portal/src/components/icons.tsx
// Iconos de lucide-react. Se mantiene el mismo envoltorio <Icon name=.../>
// de siempre para no tener que tocar cada sitio donde ya se usaba.
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Users,
  Loader2,
  Filter,
  Check,
  Download,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  plus: Plus,
  pencil: Pencil,
  trash: Trash2,
  close: X,
  search: Search,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  arrowLeft: ArrowLeft,
  warningTriangle: AlertTriangle,
  warningCircle: AlertCircle,
  users: Users,
  filter: Filter,
  check: Check,
  download: Download,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className = "w-4 h-4",
  strokeWidth = 2,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  const LucideIcon = ICONS[name];
  return <LucideIcon className={className} strokeWidth={strokeWidth} />;
}

export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} />;
}
