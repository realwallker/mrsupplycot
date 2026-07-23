import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const sourcePath = "C:/Users/Marceram03/Downloads/Hoja de cálculo sin título - Sheet.csv";
const outputDir = "outputs/mr_supply_catalog_cleanup";
const outputPath = `${outputDir}/Base_Mr_Supply_depurada.xlsx`;
const qaDir = `${outputDir}/qa`;

const normalize = (value) => String(value ?? "").trim().toUpperCase();
const toNumberOrOriginal = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : value;
};
const colName = (index) => {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
};

await fs.mkdir(qaDir, { recursive: true });
const csvText = await fs.readFile(sourcePath, "utf8");
const imported = await Workbook.fromCSV(csvText, { sheetName: "Catalogo depurado" });
const sourceSheet = imported.worksheets.getItem("Catalogo depurado");
const sourceValues = sourceSheet.getUsedRange(true).values;
const headers = sourceValues[0].map((value) => String(value ?? "").trim());
const brandIndex = headers.findIndex((header) => normalize(header) === "MARCA");
const skuIndex = headers.findIndex((header) => normalize(header) === "SKU");
const availableIndex = headers.findIndex((header) => normalize(header).includes("SKUS DISPONIBLES"));
if ([brandIndex, skuIndex, availableIndex].some((index) => index < 0)) {
  throw new Error("No se encontraron Marca, SKU o la lista de SKUs disponibles.");
}

const sourceRows = sourceValues.slice(1);
const availableValues = sourceRows.map((row) => row[availableIndex]).filter((value) => String(value ?? "").trim());
const availableSkus = new Set(availableValues.map(normalize));
const isTargetBrand = (brand) => ["NUTRIFIT", "SUN VITAMINS", "SUNVITAMINS"].includes(normalize(brand));
const keptRows = [];
const removedRows = [];
for (const row of sourceRows) {
  if (isTargetBrand(row[brandIndex]) && !availableSkus.has(normalize(row[skuIndex]))) removedRows.push(row);
  else keptRows.push(row);
}

// Preserve identifiers as text; convert only clearly numeric operational columns.
const numericHeaders = new Set(["ID", "COSTO", "MI_PVP", "DIASENTREGA"]);
const cleanedRows = keptRows.map((row) => row.map((value, index) =>
  numericHeaders.has(normalize(headers[index])) ? toNumberOrOriginal(value) : (value ?? "")
));

const workbook = Workbook.create();
const catalog = workbook.worksheets.add("Catalogo depurado");
const allValues = [headers, ...cleanedRows];
const lastCol = colName(headers.length - 1);
const lastRow = allValues.length;
catalog.getRange(`A1:${lastCol}${lastRow}`).values = allValues;
catalog.freezePanes.freezeRows(1);
catalog.showGridLines = false;

const headerRange = catalog.getRange(`A1:${lastCol}1`);
headerRange.format = {
  fill: "#173B2E",
  font: { bold: true, color: "#FFFFFF", size: 10 },
  verticalAlignment: "center",
  horizontalAlignment: "center",
  wrapText: true,
  borders: { preset: "outside", style: "thin", color: "#173B2E" },
};
headerRange.format.rowHeight = 34;
catalog.getRange(`A2:${lastCol}${lastRow}`).format.font = { size: 9, color: "#1F2937" };
catalog.getRange(`A2:${lastCol}${lastRow}`).format.verticalAlignment = "center";
catalog.getRange(`L2:M${lastRow}`).format.numberFormat = "$#,##0.00";
catalog.getRange(`A2:A${lastRow}`).format.numberFormat = "0";
catalog.getRange(`W2:W${lastRow}`).format.numberFormat = "0";
catalog.getRange(`N2:O${lastRow}`).format.numberFormat = "@";
catalog.getRange(`Y2:Y${lastRow}`).format.numberFormat = "@";

const widths = {
  A: 8, B: 20, C: 34, D: 38, E: 27, F: 22, G: 25, H: 12, I: 14, J: 18,
  K: 16, L: 12, M: 12, N: 13, O: 16, P: 20, Q: 12, R: 18, S: 16, T: 28,
  U: 42, V: 12, W: 13, X: 28, Y: 24,
};
for (const [column, width] of Object.entries(widths)) catalog.getRange(`${column}:${column}`).format.columnWidth = width;
catalog.getRange(`C2:K${lastRow}`).format.wrapText = true;
catalog.getRange(`P2:T${lastRow}`).format.wrapText = true;
catalog.getRange(`X2:Y${lastRow}`).format.wrapText = true;
catalog.tables.add(`A1:${lastCol}${lastRow}`, true, "CatalogoMrSupply").style = "TableStyleMedium4";

const control = workbook.worksheets.add("Control depuracion");
control.showGridLines = false;
control.getRange("A1:D1").merge();
control.getRange("A1").values = [["Control de disponibilidad — Mr Supply"]];
control.getRange("A1:D1").format = {
  fill: "#173B2E",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  verticalAlignment: "center",
};
control.getRange("A1:D1").format.rowHeight = 32;
control.getRange("A3:B3").values = [["Indicador", "Resultado"]];
const sunRows = sourceRows.filter((row) => normalize(row[brandIndex]) === "SUN VITAMINS").length;
const nutrifitRows = sourceRows.filter((row) => normalize(row[brandIndex]) === "NUTRIFIT").length;
control.getRange("A4:B11").values = [
  ["Filas originales", sourceRows.length],
  ["SKUs únicos en lista de disponibilidad", availableSkus.size],
  ["Filas SUN VITAMINS evaluadas", sunRows],
  ["Filas NUTRIFIT evaluadas", nutrifitRows],
  ["Filas objetivo conservadas", sunRows + nutrifitRows - removedRows.length],
  ["Filas objetivo eliminadas", removedRows.length],
  ["Filas de otras marcas sin cambios", sourceRows.length - sunRows - nutrifitRows],
  ["Filas finales", keptRows.length],
];
control.getRange("A3:B3").format = {
  fill: "#DDEFE7",
  font: { bold: true, color: "#173B2E" },
  borders: { preset: "outside", style: "thin", color: "#8AB9A4" },
};
control.getRange("A4:B11").format.borders = {
  insideHorizontal: { style: "thin", color: "#D8E2DE" },
  bottom: { style: "thin", color: "#8AB9A4" },
};
control.getRange("B4:B11").format.numberFormat = "#,##0";
control.getRange("A13:D13").merge();
control.getRange("A13").values = [[
  removedRows.length === 0
    ? "Resultado: todos los SKUs de SUN VITAMINS y NUTRIFIT están incluidos en la lista de disponibilidad; no fue necesario borrar filas."
    : `Resultado: se eliminaron ${removedRows.length} filas de las marcas objetivo por no constar en la lista de disponibilidad.`
]];
control.getRange("A13:D13").format = {
  fill: removedRows.length === 0 ? "#E8F5E9" : "#FFF3CD",
  font: { bold: true, color: removedRows.length === 0 ? "#256029" : "#7A5700" },
  wrapText: true,
  verticalAlignment: "center",
  borders: { preset: "outside", style: "thin", color: removedRows.length === 0 ? "#A5D6A7" : "#E6C768" },
};
control.getRange("A13:D13").format.rowHeight = 46;
control.getRange("A15:D15").values = [["Regla aplicada", "Marcas afectadas", "Campo comparado", "Alcance"]];
control.getRange("A16:D16").values = [[
  "Eliminar si el SKU no aparece en la lista disponible",
  "SUN VITAMINS y NUTRIFIT",
  "SKU",
  "Las demás marcas no se modifican",
]];
control.getRange("A15:D15").format = { fill: "#DDEFE7", font: { bold: true, color: "#173B2E" }, wrapText: true };
control.getRange("A16:D16").format = { wrapText: true, verticalAlignment: "top" };
control.getRange("A:D").format.columnWidth = 28;
control.getRange("A:A").format.columnWidth = 48;
control.getRange("D:D").format.columnWidth = 34;
control.freezePanes.freezeRows(1);

const catalogCheck = await workbook.inspect({
  kind: "table",
  range: `Catalogo depurado!A1:Y${Math.min(lastRow, 12)}`,
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 25,
  maxChars: 9000,
});
const controlCheck = await workbook.inspect({
  kind: "table",
  range: "Control depuracion!A1:D16",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 6,
  maxChars: 5000,
});
const errorCheck = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});

const catalogPreview = await workbook.render({
  sheetName: "Catalogo depurado",
  range: `A1:Y${Math.min(lastRow, 28)}`,
  scale: 1,
  format: "png",
});
await fs.writeFile(`${qaDir}/catalogo_depurado.png`, new Uint8Array(await catalogPreview.arrayBuffer()));
const controlPreview = await workbook.render({
  sheetName: "Control depuracion",
  range: "A1:D16",
  scale: 1.5,
  format: "png",
});
await fs.writeFile(`${qaDir}/control_depuracion.png`, new Uint8Array(await controlPreview.arrayBuffer()));

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(JSON.stringify({
  outputPath,
  sourceRows: sourceRows.length,
  availableUniqueSkus: availableSkus.size,
  sunRows,
  nutrifitRows,
  removedRows: removedRows.length,
  finalRows: keptRows.length,
}, null, 2));
console.log(catalogCheck.ndjson);
console.log(controlCheck.ndjson);
console.log(errorCheck.ndjson);
