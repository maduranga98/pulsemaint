import * as XLSX from 'xlsx';
import type { ExcelExportConfig } from '../../../types/reports.types';

export function exportToExcel(config: ExcelExportConfig): void {
  const wb = XLSX.utils.book_new();

  config.sheets.forEach((sheet) => {
    const ws = XLSX.utils.json_to_sheet(sheet.data, { header: sheet.headers });
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');

    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellRef]) continue;
      ws[cellRef].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '0A1628' } },
        alignment: { horizontal: 'left' },
      };
    }

    ws['!cols'] = sheet.headers.map((header) => ({ wch: Math.max(header.length + 2, 12) }));
    (ws as XLSX.WorkSheet & { '!freeze'?: { xSplit: number; ySplit: number } })['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  });

  const filename = `PulseMaint_${config.reportName}_${config.dateRange}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  XLSX.writeFile(wb, filename);
}
