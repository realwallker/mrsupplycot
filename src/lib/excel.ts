import * as XLSX from "xlsx";
import type { Product, Quote } from "../types";
import { quoteTotals } from "../types";

const normalize = (value: unknown) => String(value ?? "").trim();
const number = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(normalize(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const get = (row: Record<string, unknown>, ...keys: string[]) => {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]));
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase());
    if (value !== undefined) return value;
  }
  return "";
};

export async function importProducts(file: File): Promise<Product[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row, index) => ({
    id: normalize(get(row, "ID Interno")) || crypto.randomUUID(),
    sourceId: number(get(row, "ID", "ID Origen")) || index + 1,
    sku: normalize(get(row, "SKU")),
    ean: normalize(get(row, "EAN_UPC", "EAN", "UPC")),
    brand: normalize(get(row, "Marca")),
    name: normalize(get(row, "Producto", "Nombre")),
    searchName: normalize(get(row, "Nombre_Busqueda")),
    category: normalize(get(row, "Categoria", "Categoría")),
    subcategory: normalize(get(row, "Subcategoria", "Subcategoría")),
    presentation: normalize(get(row, "Presentacion", "Presentación")),
    content: normalize(get(row, "Contenido")), unit: normalize(get(row, "Unidad")),
    flavor: normalize(get(row, "Sabor")), format: normalize(get(row, "Formato")),
    cost: number(get(row, "Costo")), pvp: number(get(row, "Mi_PVP", "PVP", "Precio")),
    supplier: normalize(get(row, "Proveedor")), status: normalize(get(row, "Estado")) || "Activo",
    imageUrl: normalize(get(row, "Imagen", "URL Imagen")), stock: normalize(get(row, "Stock")),
    deliveryDays: number(get(row, "DiasEntrega", "Días entrega")), notes: normalize(get(row, "Notas")),
    updatedAt: new Date().toISOString(),
  })).filter((product) => product.sku || product.name);
}

export function exportProducts(products: Product[]) {
  const rows = products.map((p) => ({
    "ID Interno": p.id, "ID Origen": p.sourceId ?? "", Marca: p.brand, Producto: p.name,
    Nombre_Busqueda: p.searchName, Categoria: p.category, Subcategoria: p.subcategory,
    Presentacion: p.presentation, Contenido: p.content, Unidad: p.unit, Sabor: p.flavor,
    Formato: p.format, Costo: p.cost, Mi_PVP: p.pvp, SKU: p.sku, EAN_UPC: p.ean,
    Proveedor: p.supplier, Estado: p.status, Imagen: p.imageUrl, Stock: p.stock,
    DiasEntrega: p.deliveryDays, Notas: p.notes,
  }));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [12, 10, 18, 42, 38, 24, 22, 24, 14, 12, 16, 14, 12, 12, 16, 18, 24, 12, 48, 12, 12, 32].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Productos");
  XLSX.writeFile(workbook, `Catalogo_Mr_Supply_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportQuote(quote: Quote) {
  const totals = quoteTotals(quote);
  const header = [
    ["MR SUPPLY · COTIZACIÓN", ""], ["Número", quote.number], ["Fecha", quote.issuedAt],
    ["Válida hasta", quote.validUntil], ["Cliente", quote.clientName], ["Identificación", quote.clientId],
    ["Teléfono", quote.clientPhone], ["Correo", quote.clientEmail], [],
  ];
  const rows = quote.items.map((item) => ({
    SKU: item.sku, Producto: item.name, Presentación: item.presentation, Cantidad: item.quantity,
    "PVP unitario": item.unitPrice, "Descuento %": item.discount,
    Total: item.quantity * item.unitPrice * (1 - item.discount / 100),
  }));
  const sheet = XLSX.utils.aoa_to_sheet(header);
  XLSX.utils.sheet_add_json(sheet, rows, { origin: "A10" });
  XLSX.utils.sheet_add_aoa(sheet, [
    [], ["", "", "", "", "", "Subtotal", totals.subtotal],
    ["", "", "", "", "", "Descuento", totals.discount],
    ["", "", "", "", "", `Impuesto ${quote.taxRate}%`, totals.tax],
    ["", "", "", "", "", "TOTAL", totals.total], [], ["Notas", quote.notes],
  ], { origin: `A${12 + rows.length}` });
  sheet["!cols"] = [{ wch: 16 }, { wch: 42 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Cotización");
  XLSX.writeFile(workbook, `${quote.number}_${quote.clientName || "Cliente"}.xlsx`);
}
