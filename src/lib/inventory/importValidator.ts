import type {
  ParsedPartRow,
  ValidationResult,
  ValidationError,
  ImportErrorCode,
} from '@/types/inventory';

const VALID_UNITS = new Set(['pcs','set','kg','g','L','mL','m','cm','box','roll','pair','bag','drum']);
const VALID_CATEGORIES = new Set(['bearings','belts_chains','bolts_fasteners','electrical','filters','gaskets_seals','gears_sprockets','hydraulic','lubricants_oils','motors_drives','pneumatic','pumps_valves','safety_equipment','sensors_instrumentation','welding_supplies','other']);
const VALID_STATUSES = new Set(['active', 'inactive', 'discontinued']);
const VALID_CRITICALITIES = new Set(['critical', 'high', 'medium', 'low']);
const MAX_ROWS = 500;

function makeError(
  row: number,
  column: string,
  errorCode: ImportErrorCode,
  message: string,
  fixHint: string
): ValidationError {
  return { row, column, errorCode, message, fixHint };
}

function parseOptionalNumber(val: string): number | null {
  if (val === '' || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export function validateImportRows(
  rows: ParsedPartRow[],
  existingPartNumbers: Set<string>
): ValidationResult {
  const errors: ValidationError[] = [];
  const validRows: ParsedPartRow[] = [];
  const seenPartNumbers = new Set<string>();

  let createCount = 0;
  let updateCount = 0;

  if (rows.length > MAX_ROWS) {
    errors.push(
      makeError(
        0,
        'File',
        'ROW_LIMIT_EXCEEDED',
        `File contains ${rows.length} rows. Maximum allowed is ${MAX_ROWS}.`,
        `Split your data into multiple files of up to ${MAX_ROWS} rows each.`
      )
    );
    return { validRows: [], errors, createCount: 0, updateCount: 0, isValid: false };
  }

  for (const row of rows) {
    const rowErrors: ValidationError[] = [];

    // Part Number
    if (!row.partNumber) {
      rowErrors.push(
        makeError(row.rowIndex, 'Part Number *', 'REQUIRED_FIELD_EMPTY', 'Part number is required.', 'Enter a unique part number.')
      );
    } else if (row.partNumber.length > 50) {
      rowErrors.push(
        makeError(row.rowIndex, 'Part Number *', 'PART_NUMBER_TOO_LONG', 'Part number exceeds 50 characters.', 'Shorten the part number.')
      );
    } else if (seenPartNumbers.has(row.partNumber.toUpperCase())) {
      rowErrors.push(
        makeError(row.rowIndex, 'Part Number *', 'DUPLICATE_PART_NUMBER', `Duplicate part number "${row.partNumber}" in file.`, 'Each part number must be unique within the import file.')
      );
    }

    if (row.partNumber) seenPartNumbers.add(row.partNumber.toUpperCase());

    // Name
    if (!row.name) {
      rowErrors.push(
        makeError(row.rowIndex, 'Name *', 'REQUIRED_FIELD_EMPTY', 'Name is required.', 'Enter a part name.')
      );
    } else if (row.name.length > 100) {
      rowErrors.push(
        makeError(row.rowIndex, 'Name *', 'NAME_TOO_LONG', 'Name exceeds 100 characters.', 'Shorten the part name.')
      );
    }

    // Unit
    if (!row.unit) {
      rowErrors.push(
        makeError(row.rowIndex, 'Unit *', 'REQUIRED_FIELD_EMPTY', 'Unit is required.', 'Enter a valid unit (e.g. pcs, kg, L).')
      );
    } else if (!VALID_UNITS.has(row.unit)) {
      rowErrors.push(
        makeError(row.rowIndex, 'Unit *', 'INVALID_UNIT', `"${row.unit}" is not a valid unit.`, 'See the Valid Units sheet for allowed values.')
      );
    }

    // Category
    if (!row.category) {
      rowErrors.push(
        makeError(row.rowIndex, 'Category *', 'REQUIRED_FIELD_EMPTY', 'Category is required.', 'Enter a valid category.')
      );
    } else if (!VALID_CATEGORIES.has(row.category)) {
      rowErrors.push(
        makeError(row.rowIndex, 'Category *', 'INVALID_CATEGORY', `"${row.category}" is not a valid category.`, 'See the Valid Categories sheet for allowed values.')
      );
    }

    // Status (optional, default active)
    if (row.status && !VALID_STATUSES.has(row.status)) {
      rowErrors.push(
        makeError(row.rowIndex, 'Status', 'INVALID_STATUS', `"${row.status}" is not a valid status.`, 'Use: active, inactive, or discontinued.')
      );
    }

    // Criticality (optional, default medium)
    if (row.criticality && !VALID_CRITICALITIES.has(row.criticality)) {
      rowErrors.push(
        makeError(row.rowIndex, 'Criticality', 'INVALID_CRITICALITY', `"${row.criticality}" is not a valid criticality.`, 'Use: critical, high, medium, or low.')
      );
    }

    // Numeric fields
    const numericFields: Array<{ col: string; val: string; allowNegative?: boolean }> = [
      { col: 'Current Stock', val: row.currentStock },
      { col: 'Min Stock Level', val: row.minStockLevel },
      { col: 'Max Stock Level', val: row.maxStockLevel },
      { col: 'Unit Cost (LKR)', val: row.unitCost },
      { col: 'Lead Time (Days)', val: row.leadTimeDays },
      { col: 'Last Purchase Price', val: row.lastPurchasePrice },
      { col: 'Warranty (Months)', val: row.warrantyMonths },
    ];

    for (const field of numericFields) {
      if (field.val !== '' && field.val !== undefined) {
        const n = parseOptionalNumber(field.val);
        if (n === null) {
          rowErrors.push(
            makeError(row.rowIndex, field.col, 'INVALID_NUMBER', `"${field.val}" is not a valid number for ${field.col}.`, 'Enter a numeric value.')
          );
        } else if (!field.allowNegative && n < 0) {
          rowErrors.push(
            makeError(row.rowIndex, field.col, 'NEGATIVE_QUANTITY', `${field.col} cannot be negative.`, 'Enter 0 or a positive number.')
          );
        }
      }
    }

    // Date format
    if (row.lastPurchaseDate && row.lastPurchaseDate !== '') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(row.lastPurchaseDate)) {
        rowErrors.push(
          makeError(row.rowIndex, 'Last Purchase Date', 'INVALID_DATE_FORMAT', `"${row.lastPurchaseDate}" is not a valid date.`, 'Use YYYY-MM-DD format (e.g. 2025-01-15).')
        );
      }
    }

    if (rowErrors.length === 0) {
      validRows.push(row);
      if (row.partNumber && existingPartNumbers.has(row.partNumber.toUpperCase())) {
        updateCount++;
      } else {
        createCount++;
      }
    } else {
      errors.push(...rowErrors);
    }
  }

  return {
    validRows,
    errors,
    createCount,
    updateCount,
    isValid: errors.length === 0,
  };
}
