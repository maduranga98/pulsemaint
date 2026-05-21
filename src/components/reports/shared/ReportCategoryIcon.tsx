import {
  Activity,
  AlertTriangle,
  BellRing,
  Boxes,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  Factory,
  FileClock,
  GraduationCap,
  HardHat,
  PackageOpen,
  Presentation,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  TimerReset,
  TrendingDown,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  Activity,
  AlertTriangle,
  BellRing,
  Boxes,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  Factory,
  FileClock,
  GraduationCap,
  HardHat,
  PackageOpen,
  Presentation,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  TimerReset,
  TrendingDown,
  UsersRound,
};

export default function ReportCategoryIcon({ icon, className = 'h-5 w-5' }: { icon: string; className?: string }) {
  const Icon = icons[icon] ?? ClipboardList;
  return <Icon className={className} />;
}
