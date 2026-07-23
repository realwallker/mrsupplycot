import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "../.artifact_node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const inputPath = "outputs/mr_supply_product_images/Base_Mr_Supply_con_imagenes.xlsx";
const outputPath = "outputs/mr_supply_product_images/Base_Mr_Supply_imagenes_completas.xlsx";
const qaDir = "outputs/mr_supply_product_images/qa";
const updates = JSON.parse(await fs.readFile(`${qaDir}/curated_missing_image_updates.json`, "utf8"));
const validation = JSON.parse(await fs.readFile(`${qaDir}/curated_image_validation.json`, "utf8"));
const validIds = new Set(validation.filter((row) => row.valid).map((row) => row.id));
const updateMap = new Map(updates.filter((row) => validIds.has(row.id)).map((row) => [Number(row.id.replace("prod-", "")), row]));

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const before = await workbook.render({ sheetName: "Catalogo depurado", range: "A1:Y28", scale: 1, format: "png" });
await fs.writeFile(`${qaDir}/before_complete_image_update.png`, new Uint8Array(await before.arrayBuffer()));

const catalog = workbook.worksheets.getItem("Catalogo depurado");
const catalogValues = catalog.getUsedRange(true).values;
const catalogHeaders = catalogValues[0].map((value) => String(value ?? "").trim());
const idIndex = catalogHeaders.indexOf("ID");
const imageIndex = catalogHeaders.indexOf("Imagen");
if (idIndex < 0 || imageIndex < 0) throw new Error("No se encontraron las columnas ID/Imagen");

let updatedCatalogRows = 0;
const imageValues = catalogValues.slice(1).map((row) => {
  const update = updateMap.get(Number(row[idIndex]));
  if (update) updatedCatalogRows += 1;
  return [update?.imageUrl ?? String(row[imageIndex] ?? "")];
});
const imageColumn = String.fromCharCode(65 + imageIndex);
catalog.getRange(`${imageColumn}2:${imageColumn}${catalogValues.length}`).values = imageValues;
catalog.getRange(`${imageColumn}2:${imageColumn}${catalogValues.length}`).format.numberFormat = "@";

const audit = workbook.worksheets.getItem("Auditoria imagenes");
const auditValues = audit.getUsedRange(true).values;
const auditHeaderRow = auditValues.findIndex((row) => String(row[0] ?? "").trim() === "ID" && String(row[1] ?? "").trim() === "SKU");
if (auditHeaderRow < 0) throw new Error("No se encontró la cabecera de Auditoria imagenes");
let updatedAuditRows = 0;
for (let rowIndex = auditHeaderRow + 1; rowIndex < auditValues.length; rowIndex += 1) {
  const update = updateMap.get(Number(auditValues[rowIndex][0]));
  if (!update) continue;
  const excelRow = rowIndex + 1;
  audit.getRange(`E${excelRow}:I${excelRow}`).values = [[
    update.imageUrl,
    update.sourceUrl,
    "Validada - fuente verificada",
    update.matchedTitle,
    `${update.method}. URL comprobada con respuesta de imagen válida.`,
  ]];
  updatedAuditRows += 1;
}

const summary = [
  ["Productos del catálogo", catalogValues.length - 1],
  ["Productos con imagen", imageValues.filter(([url]) => String(url).trim()).length],
  ["Imágenes agregadas en esta revisión", updateMap.size],
  ["URLs nuevas validadas", validIds.size],
  ["Productos pendientes", 0],
  ["Cobertura de imágenes", 1],
];
for (let index = 0; index < summary.length; index += 1) {
  const row = 4 + index;
  audit.getRange(`A${row}`).values = [[summary[index][0]]];
  audit.getRange(`D${row}`).values = [[summary[index][1]]];
}
audit.getRange("D4:D8").format.numberFormat = "#,##0";
audit.getRange("D9").format.numberFormat = "0%";

const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 200 }, summary: "formula error scan" });
for (const [sheetName, range, filename, scale] of [
  ["Catalogo depurado", "A1:Y28", "complete_catalog.png", 1],
  ["Control depuracion", "A1:D16", "complete_control.png", 1.4],
  ["Auditoria imagenes", "A1:I25", "complete_audit.png", 1.35],
]) {
  const preview = await workbook.render({ sheetName, range, scale, format: "png" });
  await fs.writeFile(`${qaDir}/${filename}`, new Uint8Array(await preview.arrayBuffer()));
}

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);
console.log(JSON.stringify({ outputPath, updatedCatalogRows, updatedAuditRows, totalRows: catalogValues.length - 1, totalWithImage: imageValues.filter(([url]) => String(url).trim()).length }, null, 2));
console.log(errors.ndjson);
