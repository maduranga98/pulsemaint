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

// Single-letter prefix used in auto-generated part numbers (e.g. "E000001"
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

// "E000001" — letter prefix (from category) + 6-digit zero-padded sequence,
// unique per prefix letter so numbering order is grouped by category.
export function formatCategoryPartNumber(prefixLetter: string, sequence: number): string {
  return `${prefixLetter}${String(sequence).padStart(6, '0')}`;
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
