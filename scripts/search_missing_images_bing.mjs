import fs from "node:fs/promises";

const products = JSON.parse(await fs.readFile("src/data/catalog.json", "utf8")).filter((product) => !product.imageUrl);
const outputPath = "outputs/mr_supply_product_images/qa/bing_missing_image_results.json";

const decode = (value) => value
  .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const clean = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const stop = new Set(["unidad", "product", "producto", "supplement", "suplemento", "caps", "serv", "servings"]);
const tokens = (value) => clean(value).split(" ").filter((token) => token.length > 1 && !stop.has(token));

const score = (product, result) => {
  const query = new Set(tokens(`${product.brand} ${product.name} ${product.presentation}`));
  const candidate = new Set(tokens(`${result.title} ${result.pageUrl} ${result.imageUrl}`));
  let shared = 0;
  for (const token of query) if (candidate.has(token)) shared += 1;
  const brandTokens = tokens(product.brand).filter((token) => token !== "varias");
  const brandMatch = brandTokens.length && brandTokens.some((token) => candidate.has(token)) ? 0.35 : 0;
  const exactProduct = clean(result.title).includes(clean(product.name)) ? 0.45 : 0;
  return Number((shared / Math.max(1, query.size) + brandMatch + exactProduct).toFixed(4));
};

async function search(product) {
  const brand = product.brand === "Varias" ? "" : product.brand;
  const query = `"${brand}" "${product.name}" ${product.presentation}`.trim();
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; MrSupplyCatalog/1.0)" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const html = await response.text();
  const results = [];
  for (const match of html.matchAll(/class="iusc"[^>]*?m="([^"]+)"/g)) {
    try {
      const metadata = JSON.parse(decode(match[1]));
      if (!metadata.murl || !/^https?:/i.test(metadata.murl)) continue;
      results.push({ title: metadata.t ?? "", pageUrl: metadata.purl ?? "", imageUrl: metadata.murl });
    } catch { /* Ignore malformed search metadata. */ }
    if (results.length >= 12) break;
  }
  return { id: product.id, sku: product.sku, brand: product.brand, name: product.name, presentation: product.presentation, query, results: results.map((result) => ({ ...result, score: score(product, result) })).sort((a, b) => b.score - a.score) };
}

const searched = [];
for (let index = 0; index < products.length; index += 5) {
  const batch = products.slice(index, index + 5);
  const settled = await Promise.all(batch.map(async (product) => {
    try { return await search(product); }
    catch (error) { return { id: product.id, sku: product.sku, brand: product.brand, name: product.name, presentation: product.presentation, error: error.message, results: [] }; }
  }));
  searched.push(...settled);
  console.log(`Buscados ${searched.length}/${products.length}`);
}

await fs.mkdir("outputs/mr_supply_product_images/qa", { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(searched, null, 2), "utf8");
console.log(JSON.stringify({ products: searched.length, withResults: searched.filter((item) => item.results.length).length, errors: searched.filter((item) => item.error).length }, null, 2));
