import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "outputs/mr_supply_product_images/Base_Mr_Supply_con_imagenes.xlsx";
const outputPath = "src/data/catalog.json";
const qaPath = "outputs/mr_supply_web/qa/catalog_preview.png";

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Catalogo depurado");
const used = sheet.getUsedRange(true);
const values = used.values;
const headers = values[0].map((value) => String(value ?? "").trim());
const index = Object.fromEntries(headers.map((header, i) => [header, i]));

const read = (row, header) => row[index[header]] ?? "";
const text = (value) => String(value ?? "").trim();
const number = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const products = values.slice(1)
  .filter((row) => text(read(row, "Producto")))
  .map((row, rowIndex) => ({
    id: `prod-${text(read(row, "ID")) || rowIndex + 1}`,
    sourceId: number(read(row, "ID")) || rowIndex + 1,
    sku: text(read(row, "SKU")),
    ean: text(read(row, "EAN_UPC")),
    brand: text(read(row, "Marca")),
    name: text(read(row, "Producto")),
    searchName: text(read(row, "Nombre_Busqueda")),
    category: text(read(row, "Categoria")),
    subcategory: text(read(row, "Subcategoria")),
    presentation: text(read(row, "Presentacion")),
    content: text(read(row, "Contenido")),
    unit: text(read(row, "Unidad")),
    flavor: text(read(row, "Sabor")),
    format: text(read(row, "Formato")),
    cost: number(read(row, "Costo")),
    pvp: number(read(row, "Mi_PVP")),
    supplier: text(read(row, "Proveedor")),
    status: text(read(row, "Estado")) || "Activo",
    imageUrl: text(read(row, "Imagen")),
    stock: text(read(row, "Stock")),
    deliveryDays: number(read(row, "DiasEntrega")),
    notes: text(read(row, "Notas")),
    updatedAt: new Date(0).toISOString(),
  }));

await fs.mkdir("src/data", { recursive: true });
await fs.mkdir("outputs/mr_supply_web/qa", { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(products, null, 2), "utf8");

const preview = await workbook.render({
  sheetName: "Catalogo depurado",
  range: "A1:Y18",
  scale: 1,
  format: "png",
});
await fs.writeFile(qaPath, new Uint8Array(await preview.arrayBuffer()));

const inspection = await workbook.inspect({
  kind: "table",
  range: "'Catalogo depurado'!A1:Y8",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 25,
  maxChars: 8000,
});

console.log(JSON.stringify({
  products: products.length,
  withPvp: products.filter((product) => product.pvp > 0).length,
  withImages: products.filter((product) => product.imageUrl).length,
  brands: new Set(products.map((product) => product.brand)).size,
}, null, 2));
console.log(inspection.ndjson);
