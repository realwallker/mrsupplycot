import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "outputs/mr_supply_catalog_cleanup/Base_Mr_Supply_depurada.xlsx";
const qaDir = "outputs/mr_supply_product_images/qa";
await fs.mkdir(qaDir, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = workbook.worksheets.getItem("Catalogo depurado");
const values = sheet.getUsedRange(true).values;
const headers = values[0].map((v) => String(v ?? "").trim());
const ix = Object.fromEntries(headers.map((h, i) => [h, i]));
const required = ["ID", "Marca", "Producto", "SKU", "Imagen"];
for (const name of required) if (!(name in ix)) throw new Error(`Falta la columna ${name}`);

const rows = values.slice(1);
const domainCounts = new Map();
const missing = [];
const thumbnails = [];
const invalid = [];
for (const row of rows) {
  const url = String(row[ix.Imagen] ?? "").trim();
  const item = {
    id: row[ix.ID],
    marca: row[ix.Marca],
    producto: row[ix.Producto],
    nombreBusqueda: row[ix.Nombre_Busqueda] ?? "",
    presentacion: row[ix.Presentacion] ?? "",
    sabor: row[ix.Sabor] ?? "",
    formato: row[ix.Formato] ?? "",
    sku: row[ix.SKU],
    url,
  };
  if (!url) {
    missing.push(item);
    continue;
  }
  try {
    const parsed = new URL(url);
    domainCounts.set(parsed.hostname.toLowerCase(), (domainCounts.get(parsed.hostname.toLowerCase()) ?? 0) + 1);
    if (/100x100|150x150|280x280|300x300|thumbnail|thumb|small/i.test(url)) thumbnails.push(item);
  } catch {
    invalid.push(item);
  }
}

const brandStats = new Map();
for (const row of rows) {
  const brand = String(row[ix.Marca] ?? "").trim();
  const hasUrl = Boolean(String(row[ix.Imagen] ?? "").trim());
  const stat = brandStats.get(brand) ?? { total: 0, conUrl: 0, sinUrl: 0 };
  stat.total += 1;
  if (hasUrl) stat.conUrl += 1; else stat.sinUrl += 1;
  brandStats.set(brand, stat);
}

const preview = await workbook.render({
  sheetName: "Catalogo depurado",
  range: "A1:Y28",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${qaDir}/before_update.png`, new Uint8Array(await preview.arrayBuffer()));

const report = {
  total: rows.length,
  conUrl: rows.length - missing.length,
  sinUrl: missing.length,
  urlsInvalidas: invalid.length,
  posiblesMiniaturas: thumbnails.length,
  dominios: [...domainCounts.entries()].sort((a, b) => b[1] - a[1]),
  marcas: [...brandStats.entries()].sort((a, b) => b[1].sinUrl - a[1].sinUrl || b[1].total - a[1].total),
  faltantes: missing,
  miniaturas: thumbnails,
  invalidas: invalid,
};
await fs.writeFile(`${qaDir}/image_audit.json`, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({
  total: report.total,
  conUrl: report.conUrl,
  sinUrl: report.sinUrl,
  urlsInvalidas: report.urlsInvalidas,
  posiblesMiniaturas: report.posiblesMiniaturas,
  dominios: report.dominios,
  marcasConFaltantes: report.marcas.filter(([, s]) => s.sinUrl > 0),
  faltantesMuestra: report.faltantes.slice(0, 30),
}, null, 2));
