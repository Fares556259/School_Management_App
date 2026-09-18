import { Workbook, Worksheet } from "exceljs";
import { Readable } from "stream";

// ── In-Memory Cache for uploaded spreadsheets per Telegram Chat ──
interface CachedExcel {
  buffer: Buffer;
  fileName: string;
  timestamp: number;
}

const excelBufferCache = new Map<string, CachedExcel>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function storeUserExcelBuffer(chatId: string | number, buffer: Buffer, fileName: string): void {
  excelBufferCache.set(chatId.toString(), {
    buffer,
    fileName,
    timestamp: Date.now(),
  });
}

export function getUserExcelBuffer(chatId: string | number): CachedExcel | null {
  const entry = excelBufferCache.get(chatId.toString());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    excelBufferCache.delete(chatId.toString());
    return null;
  }
  return entry;
}

export function clearUserExcelBuffer(chatId: string | number): void {
  excelBufferCache.delete(chatId.toString());
}

// ── Types for Excel Inspection & Transformation ──

export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  sampleRows: Record<string, any>[];
  numericColumns: string[];
}

export interface ExcelInspectionResult {
  success: boolean;
  fileName: string;
  sheetCount: number;
  sheets: ExcelSheetInfo[];
  summaryText: string;
  error?: string;
}

export interface ExcelColumnTransformation {
  header: string;
  afterColumn?: string;
  defaultValue?: any;
  formula?: string;
  sourceColumn?: string;
  operation?: "multiply" | "add" | "subtract" | "discount_percent" | "markup_percent" | "copy";
  factor?: number;
  values?: any[];
}

export interface ExcelModifyColumn {
  header: string;
  operation: "multiply" | "add" | "subtract" | "discount_percent" | "markup_percent" | "set_value" | "uppercase" | "lowercase";
  factor?: number;
  value?: any;
}

export interface ExcelCellUpdate {
  row: number;
  col: number | string;
  value: any;
}

export interface ExcelTransformOptions {
  sheetNameOrIndex?: string | number;
  addColumns?: ExcelColumnTransformation[];
  modifyColumns?: ExcelModifyColumn[];
  updateCells?: ExcelCellUpdate[];
  renameColumns?: Array<{ oldName: string; newName: string }>;
  deleteColumns?: string[];
  addTotalRow?: boolean | { columnsToSum?: string[]; labelColumn?: string; totalLabel?: string };
  applyProfessionalStyle?: boolean;
}

/**
 * Load buffer into an ExcelJS Workbook, supporting .xlsx, .xls, and .csv.
 */
export async function loadWorkbookFromBuffer(buffer: Buffer, fileName: string): Promise<Workbook> {
  const wb = new Workbook();
  const isCsv = fileName.toLowerCase().endsWith(".csv") || (!buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && buffer.toString("utf8", 0, 100).includes(","));

  if (isCsv) {
    const stream = Readable.from([buffer]);
    await wb.csv.read(stream);
  } else {
    await wb.xlsx.load(buffer as any);
  }
  return wb;
}

/**
 * Inspect an uploaded Excel or CSV buffer to extract metadata, columns, row count and samples.
 */
export async function inspectExcelBuffer(buffer: Buffer, fileName: string): Promise<ExcelInspectionResult> {
  try {
    const wb = await loadWorkbookFromBuffer(buffer, fileName);
    const sheets: ExcelSheetInfo[] = [];

    wb.eachSheet((ws) => {
      // Find header row (first non-empty row)
      let headerRowIndex = 1;
      let headers: string[] = [];

      for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
        const row = ws.getRow(r);
        const rowValues = (row.values as any[]) || [];
        const nonNulls = rowValues.filter((v) => v !== undefined && v !== null && String(v).trim() !== "");
        if (nonNulls.length >= 2) {
          headerRowIndex = r;
          headers = rowValues
            .slice(1)
            .map((v, idx) => (v !== undefined && v !== null ? String(v).trim() : `Col_${idx + 1}`));
          break;
        }
      }

      if (headers.length === 0 && ws.rowCount > 0) {
        const row = ws.getRow(1);
        const rowValues = (row.values as any[]) || [];
        headers = rowValues
          .slice(1)
          .map((v, idx) => (v !== undefined && v !== null ? String(v).trim() : `Col_${idx + 1}`));
      }

      const sampleRows: Record<string, any>[] = [];
      const colIsNumeric: boolean[] = new Array(headers.length).fill(true);

      const maxSamples = Math.min(headerRowIndex + 5, ws.rowCount);
      for (let r = headerRowIndex + 1; r <= maxSamples; r++) {
        const row = ws.getRow(r);
        const rowObj: Record<string, any> = {};
        for (let c = 0; c < headers.length; c++) {
          const cellVal = row.getCell(c + 1).value;
          const cleanVal = typeof cellVal === "object" && cellVal !== null && "result" in cellVal
            ? (cellVal as any).result
            : cellVal;
          rowObj[headers[c]] = cleanVal;

          if (cleanVal !== null && cleanVal !== undefined && cleanVal !== "") {
            const num = Number(cleanVal);
            if (isNaN(num)) {
              colIsNumeric[c] = false;
            }
          }
        }
        sampleRows.push(rowObj);
      }

      const numericColumns = headers.filter((_, idx) => colIsNumeric[idx]);
      const dataRowCount = Math.max(0, ws.rowCount - headerRowIndex);

      sheets.push({
        name: ws.name,
        rowCount: dataRowCount,
        columnCount: headers.length,
        headers,
        sampleRows,
        numericColumns,
      });
    });

    const summaryParts = sheets.map((s) => {
      return `Feuille "${s.name}" : ${s.rowCount} lignes de données, ${s.columnCount} colonnes (${s.headers.join(", ")}). Colonnes numériques détectées : ${s.numericColumns.join(", ") || "aucune"}.`;
    });

    return {
      success: true,
      fileName,
      sheetCount: sheets.length,
      sheets,
      summaryText: summaryParts.join("\n"),
    };
  } catch (err: any) {
    console.error("[inspectExcelBuffer] Error:", err);
    return {
      success: false,
      fileName,
      sheetCount: 0,
      sheets: [],
      summaryText: `Erreur d'analyse du fichier Excel : ${err.message || String(err)}`,
      error: err.message || String(err),
    };
  }
}

/**
 * Transform an existing Excel workbook based on instructions and apply professional styling.
 */
export async function transformExcelWorkbook(
  buffer: Buffer,
  fileName: string,
  options: ExcelTransformOptions
): Promise<{ buffer: Buffer; summary: string }> {
  const wb = await loadWorkbookFromBuffer(buffer, fileName);
  const ws = options.sheetNameOrIndex
    ? wb.getWorksheet(options.sheetNameOrIndex) || wb.getWorksheet(1)
    : wb.getWorksheet(1);

  if (!ws) {
    throw new Error("Feuille de calcul introuvable dans le fichier.");
  }

  // 1. Identify header row and map columns
  let headerRowIndex = 1;
  let headers: string[] = [];

  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const row = ws.getRow(r);
    const rowValues = (row.values as any[]) || [];
    const nonNulls = rowValues.filter((v) => v !== undefined && v !== null && String(v).trim() !== "");
    if (nonNulls.length >= 2) {
      headerRowIndex = r;
      headers = rowValues
        .slice(1)
        .map((v, idx) => (v !== undefined && v !== null ? String(v).trim() : `Col_${idx + 1}`));
      break;
    }
  }

  if (headers.length === 0) {
    const row = ws.getRow(1);
    const rowValues = (row.values as any[]) || [];
    headers = rowValues
      .slice(1)
      .map((v, idx) => (v !== undefined && v !== null ? String(v).trim() : `Col_${idx + 1}`));
  }

  const getColIndexByName = (name: string): number => {
    const target = name.trim().toLowerCase();
    const idx = headers.findIndex((h) => h.toLowerCase() === target || h.toLowerCase().includes(target));
    return idx >= 0 ? idx + 1 : -1;
  };

  const changesApplied: string[] = [];

  // 2. Rename columns
  if (options.renameColumns && options.renameColumns.length > 0) {
    for (const ren of options.renameColumns) {
      const colIdx = getColIndexByName(ren.oldName);
      if (colIdx > 0) {
        ws.getRow(headerRowIndex).getCell(colIdx).value = ren.newName;
        headers[colIdx - 1] = ren.newName;
        changesApplied.push(`Colonne "${ren.oldName}" renommée en "${ren.newName}"`);
      }
    }
  }

  // 3. Modify existing columns
  if (options.modifyColumns && options.modifyColumns.length > 0) {
    for (const mod of options.modifyColumns) {
      const colIdx = getColIndexByName(mod.header);
      if (colIdx > 0) {
        let modifiedCount = 0;
        for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
          const cell = ws.getRow(r).getCell(colIdx);
          const val = cell.value;
          if (val === null || val === undefined || val === "") continue;

          if (mod.operation === "uppercase") {
            cell.value = String(val).toUpperCase();
          } else if (mod.operation === "lowercase") {
            cell.value = String(val).toLowerCase();
          } else if (mod.operation === "set_value") {
            cell.value = mod.value;
          } else {
            const num = Number(val);
            if (!isNaN(num)) {
              if (mod.operation === "multiply") {
                cell.value = num * (mod.factor ?? 1);
              } else if (mod.operation === "add") {
                cell.value = num + (mod.factor ?? 0);
              } else if (mod.operation === "subtract") {
                cell.value = num - (mod.factor ?? 0);
              } else if (mod.operation === "discount_percent") {
                const discount = (mod.factor ?? 0) / 100;
                cell.value = Math.round(num * (1 - discount) * 100) / 100;
              } else if (mod.operation === "markup_percent") {
                const markup = (mod.factor ?? 0) / 100;
                cell.value = Math.round(num * (1 + markup) * 100) / 100;
              }
            }
          }
          modifiedCount++;
        }
        changesApplied.push(`Colonne "${mod.header}" modifiée (${mod.operation} sur ${modifiedCount} lignes)`);
      }
    }
  }

  // 4. Add new columns
  if (options.addColumns && options.addColumns.length > 0) {
    for (const colDef of options.addColumns) {
      const newColIdx = ws.columnCount + 1;
      ws.getRow(headerRowIndex).getCell(newColIdx).value = colDef.header;
      headers.push(colDef.header);

      let sourceColIdx = -1;
      if (colDef.sourceColumn) {
        sourceColIdx = getColIndexByName(colDef.sourceColumn);
      }

      for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
        const targetCell = ws.getRow(r).getCell(newColIdx);

        if (colDef.values && Array.isArray(colDef.values)) {
          const valIndex = r - headerRowIndex - 1;
          if (valIndex < colDef.values.length) {
            targetCell.value = colDef.values[valIndex];
          }
        } else if (sourceColIdx > 0 && colDef.operation) {
          const srcVal = ws.getRow(r).getCell(sourceColIdx).value;
          const num = Number(srcVal);
          if (!isNaN(num)) {
            if (colDef.operation === "discount_percent") {
              const discount = (colDef.factor ?? 0) / 100;
              targetCell.value = Math.round(num * (1 - discount) * 100) / 100;
            } else if (colDef.operation === "markup_percent") {
              const markup = (colDef.factor ?? 0) / 100;
              targetCell.value = Math.round(num * (1 + markup) * 100) / 100;
            } else if (colDef.operation === "multiply") {
              targetCell.value = num * (colDef.factor ?? 1);
            } else if (colDef.operation === "add") {
              targetCell.value = num + (colDef.factor ?? 0);
            } else if (colDef.operation === "subtract") {
              targetCell.value = num - (colDef.factor ?? 0);
            } else if (colDef.operation === "copy") {
              targetCell.value = srcVal;
            }
          }
        } else if (colDef.formula) {
          const formulaStr = colDef.formula.replace(/\{row\}/g, String(r));
          targetCell.value = { formula: formulaStr.startsWith("=") ? formulaStr.slice(1) : formulaStr };
        } else if (colDef.defaultValue !== undefined) {
          targetCell.value = colDef.defaultValue;
        }
      }
      changesApplied.push(`Nouvelle colonne ajoutée : "${colDef.header}"`);
    }
  }

  // 5. Update specific cells
  if (options.updateCells && options.updateCells.length > 0) {
    for (const update of options.updateCells) {
      const colIdx = typeof update.col === "string" ? getColIndexByName(update.col) : update.col;
      if (colIdx > 0 && update.row >= 1) {
        ws.getRow(update.row).getCell(colIdx).value = update.value;
      }
    }
    changesApplied.push(`${options.updateCells.length} cellule(s) mise(s) à jour`);
  }

  // 6. Delete columns
  if (options.deleteColumns && options.deleteColumns.length > 0) {
    for (const colName of options.deleteColumns) {
      const colIdx = getColIndexByName(colName);
      if (colIdx > 0) {
        ws.spliceColumns(colIdx, 1);
        headers.splice(colIdx - 1, 1);
        changesApplied.push(`Colonne supprimée : "${colName}"`);
      }
    }
  }

  // 7. Add Total / Summary Row
  if (options.addTotalRow) {
    const totalRowIndex = ws.rowCount + 1;
    const totalRow = ws.getRow(totalRowIndex);
    const labelCol = typeof options.addTotalRow === "object" && options.addTotalRow.labelColumn
      ? getColIndexByName(options.addTotalRow.labelColumn)
      : 1;
    const totalLabel = typeof options.addTotalRow === "object" && options.addTotalRow.totalLabel
      ? options.addTotalRow.totalLabel
      : "TOTAL";

    totalRow.getCell(Math.max(1, labelCol)).value = totalLabel;
    totalRow.font = { name: "Segoe UI", bold: true, size: 11, color: { argb: "FF0F172A" } };

    // Columns to sum
    let targetCols: number[] = [];
    if (typeof options.addTotalRow === "object" && options.addTotalRow.columnsToSum) {
      targetCols = options.addTotalRow.columnsToSum
        .map((c) => getColIndexByName(c))
        .filter((c) => c > 0);
    } else {
      // Auto-detect numeric columns
      for (let c = 1; c <= ws.columnCount; c++) {
        let isNum = true;
        let count = 0;
        for (let r = headerRowIndex + 1; r < totalRowIndex; r++) {
          const val = ws.getRow(r).getCell(c).value;
          if (val !== null && val !== undefined && val !== "") {
            count++;
            if (isNaN(Number(val))) {
              isNum = false;
              break;
            }
          }
        }
        if (isNum && count > 0) {
          targetCols.push(c);
        }
      }
    }

    for (const c of targetCols) {
      let sum = 0;
      for (let r = headerRowIndex + 1; r < totalRowIndex; r++) {
        const val = Number(ws.getRow(r).getCell(c).value) || 0;
        sum += val;
      }
      const cell = totalRow.getCell(c);
      cell.value = Math.round(sum * 100) / 100;
      cell.font = { name: "Segoe UI", bold: true, size: 11 };
      cell.numFmt = '#,##0.00 "DT"';
      cell.border = {
        top: { style: "thin", color: { argb: "FF0F172A" } },
        bottom: { style: "double", color: { argb: "FF0F172A" } },
      };
    }
    changesApplied.push(`Ligne de totaux ajoutée au bas du tableau`);
  }

  // 8. Apply Professional Styling if enabled (default true)
  if (options.applyProfessionalStyle !== false) {
    applyExecutiveThemeToWorksheet(ws, headerRowIndex);
  }

  const outputBuffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer: outputBuffer,
    summary: changesApplied.join(" • ") || "Tableau mis à jour et restylé avec succès.",
  };
}

/**
 * Applies dark-navy executive styling, clean borders, zebra striping, currency formats, and auto-column widths.
 */
function applyExecutiveThemeToWorksheet(ws: Worksheet, headerRowIndex: number): void {
  const headerRow = ws.getRow(headerRowIndex);
  headerRow.height = 28;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Slate 900 / Navy
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0F172A" } },
      bottom: { style: "medium", color: { argb: "FF38BDF8" } }, // Sky blue accent bottom
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  const currencyRegex = /montant|prix|total|solde|tarif|payé|paye|reste|salaire|impayé|impaye|frais|remise|dû|du/i;
  const colIsCurrency: boolean[] = [];

  for (let c = 1; c <= ws.columnCount; c++) {
    const headerText = String(headerRow.getCell(c).value || "");
    colIsCurrency[c] = currencyRegex.test(headerText);
  }

  for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const isEven = (r - headerRowIndex) % 2 === 0;
    const isTotalRow = String(row.getCell(1).value || "").toUpperCase().includes("TOTAL");

    if (!isTotalRow) {
      row.height = 22;
    }

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (!isTotalRow) {
        cell.font = { name: "Segoe UI", size: 10, color: { argb: "FF1E293B" } };
        if (isEven) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" }, // Slate 50
          };
        }
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      }

      if (colIsCurrency[colNumber]) {
        const numVal = Number(cell.value);
        if (!isNaN(numVal) && cell.value !== "" && cell.value !== null) {
          cell.numFmt = '#,##0.00 "DT"';
          cell.alignment = { vertical: "middle", horizontal: "right" };
        }
      } else if (typeof cell.value === "number") {
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  }

  // Auto-fit column widths with safety margin
  ws.columns.forEach((column) => {
    let maxLength = 10;
    if (column && column.eachCell) {
      column.eachCell({ includeEmpty: true }, (cell) => {
        const valStr = cell.value ? String(cell.value) : "";
        if (valStr.length > maxLength) {
          maxLength = valStr.length;
        }
      });
    }
    column.width = Math.max(14, Math.min(maxLength + 4, 45));
  });
}

// ── Built-in School Excel Reports Generator ──

export type SchoolExcelReportType =
  | "UNPAID_STUDENTS"
  | "STUDENTS_LIST"
  | "DAILY_CASH"
  | "TEACHERS_SALARIES"
  | "FINANCE_SUMMARY"
  | "ATTENDANCE_REPORT";

export interface GenerateReportParams {
  type: SchoolExcelReportType;
  schoolName: string;
  data: any;
  options?: {
    month?: number;
    year?: number;
    className?: string;
    dateStr?: string;
  };
}

/**
 * Generates an executive, branded Excel spreadsheet for SnapSchool admin requests.
 */
export async function generateSchoolExcelReport(
  params: GenerateReportParams
): Promise<{ buffer: Buffer; filename: string; rowCount: number }> {
  const wb = new Workbook();
  wb.creator = "SnapSchool AI (Hnia)";
  wb.created = new Date();

  let filename = `SnapSchool_Export_${Date.now()}.xlsx`;
  let rowCount = 0;

  switch (params.type) {
    case "UNPAID_STUDENTS": {
      const month = params.options?.month || new Date().getMonth() + 1;
      const year = params.options?.year || new Date().getFullYear();
      filename = `Impayes_${month}_${year}_${params.schoolName.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`;

      const ws = wb.addWorksheet("Impayés", { views: [{ showGridLines: true }] });

      // Title Banner
      ws.mergeCells("A1:I1");
      const titleCell = ws.getCell("A1");
      titleCell.value = `🎓 ${params.schoolName.toUpperCase()} — ÉTAT DES IMPAYÉS & RETARDS`;
      titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(1).height = 36;

      // Subtitle / Date
      ws.mergeCells("A2:I2");
      const subCell = ws.getCell("A2");
      subCell.value = `Période : Mois ${month}/${year} • Édité le ${new Date().toLocaleDateString("fr-FR")} par Hnia`;
      subCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FF64748B" } };
      subCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(2).height = 20;

      // Headers
      const headers = [
        "N°",
        "Élève (Nom & Prénom)",
        "Classe",
        "Parent / Tuteur",
        "Téléphone Parent",
        "Frais Scolarité",
        "Déjà Payé",
        "Reste Dû",
        "Statut",
      ];
      const headerRow = ws.getRow(4);
      headerRow.values = headers;
      headerRow.height = 26;

      const unpaidList = params.data as Array<{
        studentName: string;
        className: string;
        parentName: string;
        parentPhone: string;
        tuitionFee: number;
        amountPaid: number;
        remainingDue: number;
        status: string;
      }>;

      rowCount = unpaidList.length;
      let totalDue = 0;
      let totalPaid = 0;

      unpaidList.forEach((item, idx) => {
        const row = ws.addRow([
          idx + 1,
          item.studentName,
          item.className,
          item.parentName,
          item.parentPhone,
          item.tuitionFee,
          item.amountPaid,
          item.remainingDue,
          item.status,
        ]);

        totalDue += item.remainingDue;
        totalPaid += item.amountPaid;

        // Status pill styling
        const statusCell = row.getCell(9);
        if (item.status.toLowerCase().includes("non payé") || item.status.toLowerCase().includes("retard")) {
          statusCell.font = { color: { argb: "FFDC2626" }, bold: true }; // Red
        } else if (item.status.toLowerCase().includes("partiel")) {
          statusCell.font = { color: { argb: "FFD97706" }, bold: true }; // Orange
        }
      });

      // Total Row
      const totRow = ws.addRow([
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        totalPaid,
        totalDue,
        `${rowCount} élève(s)`,
      ]);
      totRow.font = { name: "Segoe UI", bold: true, size: 11, color: { argb: "FF0F172A" } };
      totRow.getCell(7).numFmt = '#,##0.00 "DT"';
      totRow.getCell(8).numFmt = '#,##0.00 "DT"';
      totRow.getCell(8).font = { name: "Segoe UI", bold: true, color: { argb: "FFDC2626" } };
      totRow.border = {
        top: { style: "thin", color: { argb: "FF0F172A" } },
        bottom: { style: "double", color: { argb: "FF0F172A" } },
      };

      applyExecutiveThemeToWorksheet(ws, 4);
      break;
    }

    case "STUDENTS_LIST": {
      const cls = params.options?.className ? `_${params.options.className}` : "";
      filename = `Effectif_Eleves${cls}_${new Date().getFullYear()}.xlsx`;

      const ws = wb.addWorksheet("Élèves", { views: [{ showGridLines: true }] });

      ws.mergeCells("A1:H1");
      const titleCell = ws.getCell("A1");
      titleCell.value = `🎓 ${params.schoolName.toUpperCase()} — EFFECTIF DES ÉLÈVES ${params.options?.className ? `(${params.options.className})` : ""}`;
      titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(1).height = 36;

      const headers = [
        "N°",
        "Matricule / ID",
        "Nom & Prénom",
        "Classe",
        "Parent",
        "Téléphone Parent",
        "Date de Naissance",
        "Frais Mensuels",
      ];
      const headerRow = ws.getRow(3);
      headerRow.values = headers;
      headerRow.height = 26;

      const students = params.data as Array<{
        id: string;
        fullName: string;
        className: string;
        parentName: string;
        parentPhone: string;
        birthday: string;
        tuitionFee: number;
      }>;

      rowCount = students.length;
      students.forEach((st, idx) => {
        ws.addRow([
          idx + 1,
          st.id,
          st.fullName,
          st.className,
          st.parentName,
          st.parentPhone,
          st.birthday,
          st.tuitionFee,
        ]);
      });

      applyExecutiveThemeToWorksheet(ws, 3);
      break;
    }

    case "DAILY_CASH": {
      const dateStr = params.options?.dateStr || new Date().toISOString().split("T")[0];
      filename = `Caisse_du_Jour_${dateStr}.xlsx`;

      const ws = wb.addWorksheet("Caisse du Jour", { views: [{ showGridLines: true }] });

      ws.mergeCells("A1:F1");
      const titleCell = ws.getCell("A1");
      titleCell.value = `💰 ${params.schoolName.toUpperCase()} — CAISSE DU JOUR (${dateStr})`;
      titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(1).height = 36;

      const headers = ["Heure", "Type", "Libellé / Titre", "Bénéficiaire / Émetteur", "Mode de Paiement", "Montant (DT)"];
      const headerRow = ws.getRow(3);
      headerRow.values = headers;
      headerRow.height = 26;

      const transactions = params.data as Array<{
        time: string;
        type: "RECETTE" | "DÉPENSE";
        title: string;
        party: string;
        method: string;
        amount: number;
      }>;

      rowCount = transactions.length;
      let totalRecettes = 0;
      let totalDepenses = 0;

      transactions.forEach((tx) => {
        const row = ws.addRow([
          tx.time,
          tx.type,
          tx.title,
          tx.party,
          tx.method,
          tx.type === "DÉPENSE" ? -Math.abs(tx.amount) : tx.amount,
        ]);

        if (tx.type === "RECETTE") {
          totalRecettes += tx.amount;
          row.getCell(2).font = { color: { argb: "FF16A34A" }, bold: true };
        } else {
          totalDepenses += tx.amount;
          row.getCell(2).font = { color: { argb: "FFDC2626" }, bold: true };
        }
      });

      // Total Row
      const soldeNet = totalRecettes - totalDepenses;
      const totRow = ws.addRow([
        "SOLDE NET",
        "",
        `Recettes: ${totalRecettes.toFixed(2)} DT | Dépenses: ${totalDepenses.toFixed(2)} DT`,
        "",
        "",
        soldeNet,
      ]);
      totRow.font = { name: "Segoe UI", bold: true, size: 11 };
      totRow.getCell(6).numFmt = '#,##0.00 "DT"';
      totRow.getCell(6).font = {
        name: "Segoe UI",
        bold: true,
        size: 12,
        color: { argb: soldeNet >= 0 ? "FF16A34A" : "FFDC2626" },
      };

      applyExecutiveThemeToWorksheet(ws, 3);
      break;
    }

    default: {
      const ws = wb.addWorksheet("Données");
      ws.addRow(["Export SnapSchool"]);
      break;
    }
  }

  const outputBuffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer: outputBuffer,
    filename,
    rowCount,
  };
}
