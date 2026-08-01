import {
  Battery,
  ClipboardList,
  Compass,
  Droplet,
  Factory,
  FileStack,
  FileText,
  Film,
  FireExtinguisher,
  Flame,
  FlaskConical,
  FolderClosed,
  Hammer,
  HardHat,
  Image,
  PlayCircle,
  Recycle,
  Search,
  Settings,
  Siren,
  Thermometer,
  Toolbox,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

// Category icons are stored as emoji strings in Firestore (see
// ContentBuilder's TRIAGE_ICON_OPTIONS / seed.ts) so every existing document
// keeps working — this just maps each known emoji to a matching lucide icon
// for display, instead of rendering the raw emoji glyph.
export const TRIAGE_ICON_MAP: Record<string, LucideIcon> = {
  '🔧': Wrench,
  '⚙️': Settings,
  '🛠️': Hammer,
  '⚡': Zap,
  '🔥': Flame,
  '🚨': Siren,
  '🦺': HardHat,
  '🧯': FireExtinguisher,
  '💧': Droplet,
  '🌡️': Thermometer,
  '🔋': Battery,
  '🧰': Toolbox,
  '📋': ClipboardList,
  '🏭': Factory,
  '🚜': Truck,
  '🧪': FlaskConical,
  '🔍': Search,
  '♻️': Recycle,
};

export const TRIAGE_ICON_OPTIONS: { emoji: string; Icon: LucideIcon }[] = [
  '🔧', '⚙️', '🛠️', '⚡', '🔥', '🚨', '🦺', '🧯',
  '💧', '🌡️', '🔋', '🧰', '📋', '🏭', '🚜', '🧪',
].map((emoji) => ({ emoji, Icon: TRIAGE_ICON_MAP[emoji] ?? FolderClosed }));

export function TriageCategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = TRIAGE_ICON_MAP[icon] ?? FolderClosed;
  return <Icon className={className ?? 'w-4 h-4'} />;
}

// Content-item type icons (ContentList) — same emoji-key/lucide-icon approach.
export const TRIAGE_CONTENT_TYPE_ICON: Record<string, LucideIcon> = {
  procedure: Compass,
  guide: FileText,
  video: PlayCircle,
  pdf: FileStack,
  image: Image,
  media: Film,
};

export function TriageContentTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = TRIAGE_CONTENT_TYPE_ICON[type] ?? FileText;
  return <Icon className={className ?? 'w-4 h-4'} />;
}
