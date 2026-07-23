import fs from "node:fs/promises";

const outDir = "outputs/mr_supply_product_images/qa";
await fs.mkdir(outDir, { recursive: true });

const catalogs = [
  { brand: "Nutrex", base: "https://nutrex.com" },
  { brand: "Dragon Pharma", base: "https://dragonpharmalabs.com" },
  { brand: "Insane Labz", base: "https://insanelabz.com" },
  { brand: "Raw Nutrition", base: "https://getrawnutrition.com" },
  { brand: "Mutant", base: "https://mutantnation.com" },
  { brand: "BPI", base: "https://www.bpisports.com" },
  { brand: "Nutricost", base: "https://nutricost.com" },
  { brand: "Gat Sport", base: "https://gatsport.com" },
  { brand: "PS / ProSupps", base: "https://prosupps.com" },
  { brand: "Muscletech", base: "https://www.muscletech.com" },
  { brand: "EVL", base: "https://www.evlnutrition.com" },
  { brand: "Cellucor", base: "https://cellucor.com" },
  { brand: "Ghost", base: "https://www.ghostlifestyle.com" },
  { brand: "Quest", base: "https://www.questnutrition.com" },
  { brand: "Evogen", base: "https://www.evogennutrition.com" },
  { brand: "Universal Nutrition", base: "https://www.universalusa.com" },
  { brand: "Dymatize", base: "https://dymatize.com" },
  { brand: "Optimum Nutrition", base: "https://www.optimumnutrition.com" },
  { brand: "RC (Ronnie Coleman)", base: "https://ronniecoleman.net" },
  { brand: "Musclemeds (Carnivor)", base: "https://musclemedsrx.com" },
  { brand: "Biotech USA", base: "https://shop.biotechusa.com" },
  { brand: "Athletica", base: "https://athleticanutrition.com" },
  { brand: "FA Nutrition", base: "https://fanutrition.com" },
  { brand: "Dorian Yates (DY)", base: "https://dynutrition.com" },
  { brand: "Mrs Taste", base: "https://mrstaste.com" },
  { brand: "Terror Labz", base: "https://terrorlabz.com" },
  { brand: "Star Labs", base: "https://starlabsnutrition.com" },
];

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 MrSupplyCatalog/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
for (const site of catalogs) {
  const products = [];
  let error = null;
  for (let page = 1; page <= 4; page += 1) {
    try {
      const data = await fetchJson(`${site.base}/products.json?limit=250&page=${page}`);
      const batch = Array.isArray(data?.products) ? data.products : [];
      products.push(...batch);
      if (batch.length < 250) break;
    } catch (err) {
      error = String(err?.message ?? err);
      break;
    }
  }
  const normalized = products.map((product) => ({
    brand: site.brand,
    sourceDomain: new URL(site.base).hostname,
    title: product.title ?? "",
    handle: product.handle ?? "",
    productUrl: product.handle ? `${site.base}/products/${product.handle}` : site.base,
    imageUrl: product.images?.[0]?.src ?? product.image?.src ?? "",
    images: (product.images ?? []).map((image) => image.src).filter(Boolean),
    variants: (product.variants ?? []).map((variant) => ({
      title: variant.title ?? "",
      sku: variant.sku ?? "",
      imageId: variant.image_id ?? null,
    })),
  })).filter((product) => product.imageUrl);
  results.push({ ...site, count: normalized.length, error, products: normalized });
  console.log(`${site.brand}: ${normalized.length}${error ? ` (${error})` : ""}`);
}

await fs.writeFile(`${outDir}/official_catalogs.json`, JSON.stringify(results, null, 2), "utf8");
console.log(JSON.stringify(results.map(({ brand, base, count, error }) => ({ brand, base, count, error })), null, 2));
