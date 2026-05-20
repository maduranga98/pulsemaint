export function generatePartNumber(prefix: string, nextSequence: number): string {
  const padded = String(nextSequence).padStart(4, '0');
  return `${prefix}-${padded}`;
}

export function generatePONumber(prefix: string, year: number, sequence: number): string {
  const padded = String(sequence).padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
}

export function generateRequestNumber(prefix: string, year: number, sequence: number): string {
  const padded = String(sequence).padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
}
