import fs from "node:fs/promises";

const outPath = "outputs/mr_supply_product_images/qa/supplemental_catalogs.json";
const sites = [
  { brand: "Saxofit", base: "https://saxofit.com" },
  { brand: "Integralmedica", base: "https://www.integralmedica.com.br" },
  { brand: "Integralmedica", base: "https://checkout.integralmedica.com.br" },
  { brand: "Athletica", base: "https://www.atlheticanutrition.com.br" },
  { brand: "FA Nutrition", base: "https://fa-nutrition.com" },
  { brand: "Mrs Taste", base: "https://mrstaste.com.br" },
  { brand: "Sascha Fitness", base: "https://saschafitness.com" },
  { brand: "Kevin Levrone", base: "https://levrosupplements.com" },
  { brand: "Dymatize", base: "https://shop.dymatize.com" },
  { brand: "Universal Nutrition", base: "https://www.universalnutrition.com" },
  { brand: "Hochsport", base: "https://hochsport.com" },
  { brand: "Vitamin Life", base: "https://vitaminlifeusa.com" },
  { brand: "Star Labs", base: "https://starlabsnutrition.net" },
  { brand: "Natures World", base: "https://naturesworldllc.com" },
  { brand: "Golden", base: "https://goldennutrition.com" },
  { brand: "Rosenbaum", base: "https://rosenbaumnutrition.com" },
];

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MrSupplyCatalog/1.0" }, signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

const output = [];
for (const site of sites) {
  let products = [];
  let error = null;
  try {
    const data = await fetchJson(`${site.base}/products.json?limit=250&page=1`);
    products = (data?.products ?? []).map((product) => ({
      brand: site.brand,
      sourceDomain: new URL(site.base).hostname,
      title: product.title ?? "",
      productUrl: product.handle ? `${site.base}/products/${product.handle}` : site.base,
      imageUrl: product.images?.[0]?.src ?? product.image?.src ?? "",
      images: (product.images ?? []).map((image) => image.src).filter(Boolean),
      variants: (product.variants ?? []).map((variant) => ({ title: variant.title ?? "", sku: variant.sku ?? "" })),
    })).filter((p) => p.imageUrl);
  } catch (err) { error = String(err?.message ?? err); }
  output.push({ ...site, count: products.length, error, products });
  console.log(`${site.brand}: ${products.length}${error ? ` (${error})` : ""}`);
}
await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf8");
