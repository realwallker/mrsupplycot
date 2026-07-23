import fs from "node:fs/promises";
import { Workbook } from "@oai/artifact-tool";

const sourcePath = "C:/Users/Marceram03/Downloads/Hoja de cálculo sin título - Sheet.csv";
const qaDir = "outputs/mr_supply_catalog_cleanup/qa";

await fs.mkdir(qaDir, { recursive: true });
const csvText = await fs.readFile(sourcePath, "utf8");
const workbook = await Workbook.fromCSV(csvText, { sheetName: "Catalogo" });
const sheet = workbook.worksheets.getItem("Catalogo");
const used = sheet.getUsedRange(true);
const values = used.values;
const headers = values[0].map((value) => String(value ?? "").trim());
const brandIndex = headers.findIndex((header) => header.toUpperCase() === "MARCA");
const skuIndex = headers.findIndex((header) => header.toUpperCase() === "SKU");
const availableIndex = headers.findIndex((header) =>
  header.toUpperCase().includes("SKUS DISPONIBLES")
);

if ([brandIndex, skuIndex, availableIndex].some((index) => index < 0)) {
  throw new Error(`No se encontraron las columnas necesarias: ${JSON.stringify(headers)}`);
}

const normalize = (value) => String(value ?? "").trim().toUpperCase();
const rows = values.slice(1);
const brands = new Map();
for (const row of rows) {
  const brand = normalize(row[brandIndex]);
  brands.set(brand, (brands.get(brand) ?? 0) + 1);
}

const availableValues = rows
  .map((row) => String(row[availableIndex] ?? "").trim())
  .filter(Boolean);
const availableSkus = new Set(availableValues.map(normalize));
const targetBrand = (brand) => brand === "NUTRIFIT" || brand === "SUN VITAMINS" || brand === "SUNVITAMINS";
const targetRows = rows.filter((row) => targetBrand(normalize(row[brandIndex])));
const keptTargetRows = targetRows.filter((row) => availableSkus.has(normalize(row[skuIndex])));
const removedTargetRows = targetRows.filter((row) => !availableSkus.has(normalize(row[skuIndex])));

const preview = await workbook.render({
  sheetName: "Catalogo",
  range: `A1:Y${Math.min(values.length, 30)}`,
  scale: 1,
  format: "png",
});
await fs.writeFile(`${qaDir}/source_preview.png`, new Uint8Array(await preview.arrayBuffer()));

const inspection = await workbook.inspect({
  kind: "table",
  range: `Catalogo!A1:Y${Math.min(values.length, 12)}`,
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 25,
  maxChars: 10000,
});

console.log(JSON.stringify({
  rowCount: rows.length,
  columnCount: headers.length,
  headers,
  brands: [...brands.entries()].sort((a, b) => b[1] - a[1]),
  availableListEntries: availableValues.length,
  availableUniqueSkus: availableSkus.size,
  duplicatedAvailableEntries: availableValues.length - availableSkus.size,
  targetRows: targetRows.length,
  keptTargetRows: keptTargetRows.length,
  removedTargetRows: removedTargetRows.length,
  removedTargetSample: removedTargetRows.slice(0, 12).map((row) => ({
    id: row[0], brand: row[brandIndex], product: row[2], sku: row[skuIndex],
  })),
  nonTargetRows: rows.length - targetRows.length,
}, null, 2));
console.log(inspection.ndjson);
