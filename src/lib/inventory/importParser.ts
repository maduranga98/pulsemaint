import type { ParsedImportResult, ParsedPartRow } from '@/types/inventory';
import { VALID_CATEGORIES } from '@/lib/inventory/inventoryTypes';

const PART_COLUMNS = [
  'Part Number',
  'Name *',
  'Unit *',
  'Category *',
  'Current Stock',
  'Min Stock Level',
  'Max Stock Level',
  'Unit Cost (LKR)',
  'Supplier Name',
  'Compatible Machine IDs',
  'Status',
  'Description',
  'Brand',
  'Model Ref',
  'Store Location',
  'Supplier Part Code',
  'Supplier Contact',
  'Lead Time (Days)',
  'Last Purchase Date',
  'Last Purchase Price',
  'Warranty (Months)',
  'Criticality',
  'Notes',
];

const VALID_UNITS_LIST = ['pcs','set','kg','g','L','mL','m','cm','box','roll','pair','bag','drum'];
// Standard categories offered as a reference — a part's category may also be
// a freeform, manually-created value not in this list.
const VALID_CATEGORIES_LIST: readonly string[] = VALID_CATEGORIES;

function cellStr(val: unknown): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

export async function parseInventoryExcel(file: File): Promise<ParsedImportResult> {
  const XLSX = await import('xlsx');

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], totalRows: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  // header: 1 → array of arrays
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  if (rawRows.length < 2) {
    return { rows: [], totalRows: 0 };
  }

  // First row is headers
  const headers = (rawRows[0] as unknown[]).map((h) => cellStr(h));
  const dataRows = rawRows.slice(1) as unknown[][];

  // Map header name → column index
  const idx = (name: string): number => headers.indexOf(name);

  const rows: ParsedPartRow[] = dataRows
    .filter((row) => row.some((c) => cellStr(c) !== ''))
    .map((row, i) => {
      const get = (colName: string): string => {
        const colIdx = idx(colName);
        return colIdx >= 0 ? cellStr(row[colIdx]) : '';
      };

      return {
        rowIndex: i + 2, // 1-based, accounting for header
        partNumber: get('Part Number'),
        name: get('Name *'),
        unit: get('Unit *'),
        category: get('Category *'),
        currentStock: get('Current Stock'),
        minStockLevel: get('Min Stock Level'),
        maxStockLevel: get('Max Stock Level'),
        unitCost: get('Unit Cost (LKR)'),
        supplierName: get('Supplier Name'),
        compatibleMachineIds: get('Compatible Machine IDs'),
        status: get('Status'),
        description: get('Description'),
        brand: get('Brand'),
        modelRef: get('Model Ref'),
        storeLocation: get('Store Location'),
        supplierPartCode: get('Supplier Part Code'),
        supplierContact: get('Supplier Contact'),
        leadTimeDays: get('Lead Time (Days)'),
        lastPurchaseDate: get('Last Purchase Date'),
        lastPurchasePrice: get('Last Purchase Price'),
        warrantyMonths: get('Warranty (Months)'),
        criticality: get('Criticality'),
        notes: get('Notes'),
      };
    });

  return { rows, totalRows: rows.length };
}

export async function generateImportTemplate(): Promise<Blob> {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();

  // Sheet 1: Parts Data
  const partsData = [PART_COLUMNS];
  // Add one example row
  partsData.push([
    '',                  // Part Number (leave blank to auto-generate from Category+Supplier+Location)
    'Example Bearing',   // Name *
    'pcs',               // Unit *
    'mechanical',        // Category *
    '10',                // Current Stock
    '5',                 // Min Stock Level
    '50',                // Max Stock Level
    '1500.00',           // Unit Cost (LKR)
    'Sample Supplier',   // Supplier Name
    '',                  // Compatible Machine IDs
    'active',            // Status
    'Example description',// Description
    'SKF',               // Brand
    '6205-2RS',          // Model Ref
    'Rack A - Shelf 2',  // Store Location
    '',                  // Supplier Part Code
    '+94 11 2345678',    // Supplier Contact
    '7',                 // Lead Time (Days)
    '2025-01-15',        // Last Purchase Date
    '1400.00',           // Last Purchase Price
    '12',                // Warranty (Months)
    'medium',            // Criticality
    '',                  // Notes
  ]);

  const partsSheet = XLSX.utils.aoa_to_sheet(partsData);
  XLSX.utils.book_append_sheet(wb, partsSheet, 'Parts Data');

  // Sheet 2: Valid Units
  const unitsData = [['Valid Units'], ...VALID_UNITS_LIST.map((u) => [u])];
  const unitsSheet = XLSX.utils.aoa_to_sheet(unitsData);
  XLSX.utils.book_append_sheet(wb, unitsSheet, 'Valid Units');

  // Sheet 3: Valid Categories
  const categoriesData = [['Valid Categories'], ...VALID_CATEGORIES_LIST.map((c) => [c])];
  const categoriesSheet = XLSX.utils.aoa_to_sheet(categoriesData);
  XLSX.utils.book_append_sheet(wb, categoriesSheet, 'Valid Categories');

  // Sheet 4: Instructions
  const instructions = [
    ['Instructions'],
    [''],
    ['1. Fill in the Parts Data sheet. Columns marked with * are required.'],
    ['2. Part Number is optional — leave it blank to have the system auto-generate one from Category, Supplier Name, and Store Location (e.g. E-012-RAS-0001). If provided, it must be unique (no duplicates within file, no conflicts with existing parts).'],
    ['3. If a Part Number is given and already exists in the system, the row will UPDATE that part.'],
    ['4. If a Part Number is blank, or is given but is new, a new part will be CREATED (with an auto-generated number if left blank).'],
    ['5. Unit must be one of the values in the Valid Units sheet.'],
    ['6. Category must be one of the values in the Valid Categories sheet.'],
    ['7. Status must be: active, inactive, or discontinued.'],
    ['8. Criticality must be: critical, high, medium, or low.'],
    ['9. Dates must be in YYYY-MM-DD format.'],
    ['10. Compatible Machine IDs: comma-separated machine IDs (optional).'],
    ['11. Maximum 500 rows per import.'],
    ['12. Supplier Part Code: leave blank to auto-fill with the part number.'],
    ['13. Supplier Name: any supplier not already in your Suppliers list is added automatically, with an auto-generated Supplier Code.'],
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
