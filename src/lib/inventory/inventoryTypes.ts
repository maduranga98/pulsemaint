export type {
  PartCategory,
  PartUnit,
  PartStatus,
  PartCriticality,
  StockStatus,
  CadFileType,
  MovementType,
  ReferenceType,
  RequestStatus,
  ReviewDecision,
  PurchaseOrderStatus,
  ImportSessionStatus,
  InventoryCurrency,
  ImportErrorCode,
  CadFile,
  WarrantyDocument,
  RequestItem,
  StoreKeeperReview,
  SupervisorReview,
  PurchaseOrderItem,
  ImportError,
  InventoryPart,
  PartsRequest,
  StockMovement,
  PurchaseOrder,
  InventoryImportSession,
  InventorySettings,
  CreatePartPayload,
  UpdatePartPayload,
  ParsedPartRow,
  ValidationError,
  ParsedImportResult,
  ValidationResult,
  InventoryStats,
  ReceiveItem,
  ReceiveStockPayload,
} from '@/types/inventory';

export const VALID_UNITS = [
  'pcs', 'set', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'box', 'roll', 'pair', 'bag', 'drum',
] as const;

// The six standard main categories. Parts may also carry a freeform,
// manually-created category name outside this list.
export const VALID_CATEGORIES = [
  'electrical',
  'mechanical',
  'hydraulic',
  'pneumatic',
  'automation',
  'civil',
] as const;

import type { PartUnit } from '@/types/inventory';

export const CATEGORY_LABELS: Record<(typeof VALID_CATEGORIES)[number], string> = {
  electrical: 'Electrical',
  mechanical: 'Mechanical',
  hydraulic: 'Hydraulic',
  pneumatic: 'Pneumatic',
  automation: 'Automation',
  civil: 'Civil',
};

// Returns the display label for a category — one of the six standard
// labels, or the category value itself when it's a manually-created one.
export function categoryLabel(category: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[category] ?? category;
}

// Single-letter prefix used in auto-generated part numbers (e.g. "E-012-RAS-0001"
// for Electrical). The six standard categories get a fixed letter; a
// manually-created category falls back to its own first letter so parts
// still group sensibly by category.
const CATEGORY_PREFIX_LETTERS: Record<(typeof VALID_CATEGORIES)[number], string> = {
  electrical: 'E',
  mechanical: 'M',
  hydraulic: 'H',
  pneumatic: 'P',
  automation: 'A',
  civil: 'C',
};

export function categoryPrefixLetter(category: string): string {
  const known = (CATEGORY_PREFIX_LETTERS as Record<string, string>)[category];
  if (known) return known;
  const firstLetter = category.trim().match(/[a-zA-Z]/)?.[0];
  return firstLetter ? firstLetter.toUpperCase() : 'O';
}

// Short (max 3-digit) segment identifying the supplier in a part number,
// taken from the supplier's own code (e.g. "SUP-LK-000042" -> "042").
// "000" when no supplier is set.
export function supplierPartNumberSegment(supplierCode: string): string {
  const match = supplierCode.match(/(\d+)$/);
  if (!match) return '000';
  return match[1].slice(-3).padStart(3, '0');
}

// Short (max 3 letters) segment identifying the store location in a part
// number, from the initials of each word (e.g. "Rack A - Shelf 2" -> "RAS").
// "GEN" when no location is set.
export function locationPartNumberSegment(storeLocation: string): string {
  const initials = storeLocation
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
  return initials || 'GEN';
}

export interface PartNumberFactors {
  category: string;
  supplierCode?: string | null;
  storeLocation?: string | null;
}

// "E-000-RAS-0001" — Category letter, Supplier segment, Location segment,
// and a 4-digit sequence unique within that combination, so the number
// itself reflects which category, supplier, and storage location the part
// belongs to (not just a bare running count).
export function formatCategoryPartNumber(factors: PartNumberFactors, sequence: number): string {
  const categorySeg = categoryPrefixLetter(factors.category);
  const supplierSeg = supplierPartNumberSegment(factors.supplierCode ?? '');
  const locationSeg = locationPartNumberSegment(factors.storeLocation ?? '');
  return `${categorySeg}-${supplierSeg}-${locationSeg}-${String(sequence).padStart(4, '0')}`;
}

// The combined key a part number's sequence is scoped to — same category,
// supplier, and location combination share one running counter.
export function partNumberSequenceKey(factors: PartNumberFactors): string {
  return `${categoryPrefixLetter(factors.category)}-${supplierPartNumberSegment(factors.supplierCode ?? '')}-${locationPartNumberSegment(factors.storeLocation ?? '')}`;
}

export const UNIT_LABELS: Record<PartUnit, string> = {
  pcs: 'Pieces (pcs)',
  set: 'Set',
  kg: 'Kilograms (kg)',
  g: 'Grams (g)',
  L: 'Litres (L)',
  mL: 'Millilitres (mL)',
  m: 'Metres (m)',
  cm: 'Centimetres (cm)',
  box: 'Box',
  roll: 'Roll',
  pair: 'Pair',
  bag: 'Bag',
  drum: 'Drum',
};
