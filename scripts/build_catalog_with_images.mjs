import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "outputs/mr_supply_catalog_cleanup/Base_Mr_Supply_depurada.xlsx";
const outputDir = "outputs/mr_supply_product_images";
const outputPath = `${outputDir}/Base_Mr_Supply_con_imagenes.xlsx`;
const qaDir = `${outputDir}/qa`;
await fs.mkdir(qaDir, { recursive: true });

const updates = JSON.parse(await fs.readFile(`${qaDir}/approved_image_updates.json`, "utf8"));
const validation = JSON.parse(await fs.readFile(`${qaDir}/url_validation.json`, "utf8"));
const validNewIds = new Set(validation.filter((v) => v.type === "new" && v.valid).map((v) => Number(v.id)));
const validThumbnailUpgrades = new Map(validation.filter((v) => v.type === "thumbnail_upgrade" && v.valid).map((v) => [Number(v.id), v.finalUrl || v.url]));
const updateMap = new Map(updates.filter((u) => validNewIds.has(Number(u.id))).map((u) => [Number(u.id), u]));

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const catalog = workbook.worksheets.getItem("Catalogo depurado");
const values = catalog.getUsedRange(true).values;
const headers = values[0].map((v) => String(v ?? "").trim());
const ix = Object.fromEntries(headers.map((h, i) => [h, i]));
for (const name of ["ID", "SKU", "Marca", "Producto", "Imagen"]) if (!(name in ix)) throw new Error(`Falta ${name}`);

const rows = values.slice(1);
const imageValues = [];
const auditRows = [];
let existingNutrifit = 0;
let existingOther = 0;
let officialAdded = 0;
let thumbnailUpgraded = 0;
let pending = 0;

for (const row of rows) {
  const id = Number(row[ix.ID]);
  const oldUrl = String(row[ix.Imagen] ?? "").trim();
  const update = updateMap.get(id);
  let imageUrl = oldUrl;
  let sourceUrl = "";
  let status = "";
  let match = "";
  let note = "";
  if (update) {
    imageUrl = update.imageUrl;
    sourceUrl = update.sourceUrl;
    status = "Validada - fabricante oficial";
    match = update.matchedTitle;
    note = `${update.method}. Imagen principal publicada por la marca; algunas páginas agrupan sabores o tamaños.`;
    officialAdded += 1;
  } else if (oldUrl) {
    let domain = "";
    try { domain = new URL(oldUrl).hostname.toLowerCase(); } catch { domain = "URL no válida"; }
    if (validThumbnailUpgrades.has(id)) {
      imageUrl = validThumbnailUpgrades.get(id);
      thumbnailUpgraded += 1;
      note = "Se sustituyó la miniatura por el archivo original validado.";
    }
    sourceUrl = imageUrl;
    match = "URL existente";
    if (domain === "nutrifit.com.ec") {
      status = thumbnailUpgraded && validThumbnailUpgrades.has(id) ? "Existente - Nutrifit (original)" : "Existente - catálogo Nutrifit";
      existingNutrifit += 1;
    } else {
      status = "Revisar - fuente no oficial";
      note = note || `URL existente en ${domain}; conviene sustituirla cuando haya fuente oficial.`;
      existingOther += 1;
    }
  } else {
    status = "Pendiente - coincidencia ambigua";
    note = "No se asignó imagen para evitar relacionar el producto con una presentación o marca incorrecta.";
    pending += 1;
  }
  imageValues.push([imageUrl]);
  auditRows.push([id, String(row[ix.SKU] ?? ""), row[ix.Marca], row[ix.Producto], imageUrl, sourceUrl, status, match, note]);
}

catalog.getRange(`U2:U${rows.length + 1}`).values = imageValues;
catalog.getRange(`U2:U${rows.length + 1}`).format.numberFormat = "@";

const audit = workbook.worksheets.add("Auditoria imagenes");
audit.showGridLines = false;
audit.getRange("A1:I1").merge();
audit.getRange("A1").values = [["Auditoría de imágenes de producto — Mr Supply"]];
audit.getRange("A1:I1").format = { fill: "#173B2E", font: { bold: true, color: "#FFFFFF", size: 16 }, verticalAlignment: "center" };
audit.getRange("A1:I1").format.rowHeight = 32;
audit.getRange("A3:C3").merge();
audit.getRange("A3").values = [["Indicador"]];
audit.getRange("D3").values = [["Cantidad"]];
const summaryRows = [
  ["Productos del catálogo", rows.length],
  ["Imágenes oficiales agregadas", officialAdded],
  ["URLs existentes de Nutrifit", existingNutrifit],
  ["Miniaturas mejoradas a archivo original", thumbnailUpgraded],
  ["URLs existentes de otras fuentes", existingOther],
  ["Productos pendientes de revisión", pending],
];
for (let index = 0; index < summaryRows.length; index += 1) {
  const rowNumber = 4 + index;
  audit.getRange(`A${rowNumber}:C${rowNumber}`).merge();
  audit.getRange(`A${rowNumber}`).values = [[summaryRows[index][0]]];
  audit.getRange(`D${rowNumber}`).values = [[summaryRows[index][1]]];
}
audit.getRange("A3:D3").format = { fill: "#DDEFE7", font: { bold: true, color: "#173B2E" }, borders: { preset: "outside", style: "thin", color: "#8AB9A4" } };
audit.getRange("A4:D9").format.borders = { insideHorizontal: { style: "thin", color: "#D8E2DE" }, bottom: { style: "thin", color: "#8AB9A4" } };
audit.getRange("D4:D9").format.numberFormat = "#,##0";

const tableHeaderRow = 11;
const dataStartRow = 12;
const dataEndRow = dataStartRow + auditRows.length - 1;
audit.getRange(`A${tableHeaderRow}:I${tableHeaderRow}`).values = [["ID", "SKU", "Marca", "Producto", "URL_Imagen", "Pagina_Fuente", "Estado", "Coincidencia_Oficial", "Observacion"]];
audit.getRange(`A${dataStartRow}:I${dataEndRow}`).values = auditRows;
audit.getRange(`A${tableHeaderRow}:I${dataEndRow}`).format.font = { size: 9, color: "#1F2937" };
audit.getRange(`A${dataStartRow}:B${dataEndRow}`).format.numberFormat = "@";
audit.getRange(`E${dataStartRow}:F${dataEndRow}`).format.numberFormat = "@";
audit.tables.add(`A${tableHeaderRow}:I${dataEndRow}`, true, "AuditoriaImagenes").style = "TableStyleMedium4";
audit.freezePanes.freezeRows(tableHeaderRow);
audit.getRange("A:A").format.columnWidth = 9;
audit.getRange("B:B").format.columnWidth = 18;
audit.getRange("C:C").format.columnWidth = 22;
audit.getRange("D:D").format.columnWidth = 36;
audit.getRange("E:F").format.columnWidth = 48;
audit.getRange("G:G").format.columnWidth = 29;
audit.getRange("H:H").format.columnWidth = 36;
audit.getRange("I:I").format.columnWidth = 54;
audit.getRange(`D${dataStartRow}:I${dataEndRow}`).format.wrapText = true;
audit.getRange(`G${dataStartRow}:G${dataEndRow}`).conditionalFormats.add("containsText", { text: "Validada", format: { fill: "#E8F5E9", font: { color: "#256029" } } });
audit.getRange(`G${dataStartRow}:G${dataEndRow}`).conditionalFormats.add("containsText", { text: "Pendiente", format: { fill: "#FFF3CD", font: { color: "#7A5700" } } });
audit.getRange(`G${dataStartRow}:G${dataEndRow}`).conditionalFormats.add("containsText", { text: "Revisar", format: { fill: "#FCE8E6", font: { color: "#A61B1B" } } });

const check = await workbook.inspect({ kind: "table", range: "Auditoria imagenes!A1:I25", include: "values,formulas", tableMaxRows: 25, tableMaxCols: 10, maxChars: 9000 });
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 200 }, summary: "final formula error scan" });

for (const [sheetName, range, file] of [
  ["Catalogo depurado", "A1:Y28", "final_catalog.png"],
  ["Control depuracion", "A1:D16", "final_control_depuracion.png"],
  ["Auditoria imagenes", "A1:I25", "final_auditoria_imagenes.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: sheetName === "Catalogo depurado" ? 1 : 1.4, format: "png" });
  await fs.writeFile(`${qaDir}/${file}`, new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, rows: rows.length, officialAdded, existingNutrifit, thumbnailUpgraded, existingOther, pending, totalWithImage: rows.length - pending }, null, 2));
console.log(check.ndjson);
console.log(errors.ndjson);
