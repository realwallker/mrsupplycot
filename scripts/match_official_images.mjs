import fs from "node:fs/promises";

const audit = JSON.parse(await fs.readFile("outputs/mr_supply_product_images/qa/image_audit.json", "utf8"));
const catalogFiles = [
  "outputs/mr_supply_product_images/qa/official_catalogs.json",
  "outputs/mr_supply_product_images/qa/supplemental_catalogs.json",
  "outputs/mr_supply_product_images/qa/nonshopify_catalogs.json",
  "outputs/mr_supply_product_images/qa/windmill_catalog.json",
];
const catalogs = (await Promise.all(catalogFiles.map(async (path) => {
  try { return JSON.parse(await fs.readFile(path, "utf8")); } catch { return []; }
}))).flat();

const normalize = (value) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\b(kevin levrone|ronnie coleman|signature series|sports nutrition|nutrition|research|supplements?|labs?|usa|nutrex|bpi|sport|dragon|pharma|raw|mutant|biotech|musclemeds|carnivor|gat|prosupps|insane|dorian|yates|muscletech|dymatize|evl|cellucor|ghost|evogen|quest|optimum|universal)\b/g, " ")
  .replace(/\bcreatina\b/g, "creatine")
  .replace(/\bglutamina\b/g, "glutamine")
  .replace(/\bcarnitina\b/g, "carnitine")
  .replace(/\bproteina\b/g, "protein")
  .replace(/\bproteinas\b/g, "protein")
  .replace(/\bvainilla\b/g, "vanilla")
  .replace(/\bfresa\b/g, "strawberry")
  .replace(/\bgalletas\b/g, "cookies")
  .replace(/\bcolageno\b/g, "collagen")
  .replace(/\b(lbs?|pounds?|kg|grams?|capsules?|caps?|tablets?|tabs?|servings?|ct|unidades?)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const trigrams = (text) => {
  const padded = `  ${text}  `;
  const result = new Set();
  for (let i = 0; i < padded.length - 2; i += 1) result.add(padded.slice(i, i + 3));
  return result;
};
const dice = (a, b) => {
  if (!a || !b) return 0;
  const aa = trigrams(a), bb = trigrams(b);
  let shared = 0;
  for (const token of aa) if (bb.has(token)) shared += 1;
  return (2 * shared) / (aa.size + bb.size);
};
const tokenScore = (a, b) => {
  const aa = new Set(a.split(" ").filter(Boolean));
  const bb = new Set(b.split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  let shared = 0;
  for (const token of aa) if (bb.has(token)) shared += 1;
  const precision = shared / bb.size;
  const recall = shared / aa.size;
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
};
const similarity = (query, title) => {
  const a = normalize(query), b = normalize(title);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const base = 0.55 * dice(a, b) + 0.45 * tokenScore(a, b);
  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const allQueryTokensPresent = [...aTokens].every((token) => bTokens.has(token));
  if (allQueryTokensPresent && aTokens.size >= 2) return Math.max(base, 0.93 - Math.min(0.12, (bTokens.size - aTokens.size) * 0.025));
  if (allQueryTokensPresent && aTokens.size === 1 && a.length >= 4) return Math.max(base, 0.82);
  if (a.length >= 4 && b.includes(a)) return Math.max(base, 0.92 - Math.min(0.12, (b.length - a.length) / 150));
  if (b.length >= 4 && a.includes(b)) return Math.max(base, 0.88 - Math.min(0.12, (a.length - b.length) / 150));
  return base;
};

const aliases = new Map([
  ["biotech", "Biotech USA"],
  ["biotech usa", "Biotech USA"],
]);
const catalogsByBrand = new Map();
for (const catalog of catalogs) {
  const key = catalog.brand.toLowerCase();
  catalogsByBrand.set(key, [...(catalogsByBrand.get(key) ?? []), ...(catalog.products ?? [])]);
}

const proposals = [];
for (const item of audit.faltantes) {
  const catalogBrand = aliases.get(String(item.marca).toLowerCase()) ?? item.marca;
  const products = catalogsByBrand.get(String(catalogBrand).toLowerCase()) ?? [];
  const ranked = products.map((product) => {
    const combined = [item.producto, item.sabor, item.presentacion].filter(Boolean).join(" ");
    const scores = [similarity(item.producto, product.title), similarity(combined, product.title)];
    return { ...product, score: Math.max(...scores) };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const margin = best ? best.score - (second?.score ?? 0) : 0;
  const queryNorm = normalize(item.producto);
  const bestNorm = normalize(best?.title ?? "");
  const strongContainment = queryNorm.length >= 4 && bestNorm.length >= 4 && (queryNorm.includes(bestNorm) || bestNorm.includes(queryNorm));
  let status = "Sin catálogo oficial disponible";
  if (best) {
    if (best.score >= 0.86 && (margin >= 0.04 || strongContainment)) status = "Alta confianza";
    else if (best.score >= 0.70 && margin >= 0.10) status = "Confianza media";
    else status = "Revisión manual";
  }
  proposals.push({
    ...item,
    catalogBrand,
    queryNormalized: queryNorm,
    status,
    best: best ? { title: best.title, imageUrl: best.imageUrl, productUrl: best.productUrl, sourceDomain: best.sourceDomain, score: Number(best.score.toFixed(4)), margin: Number(margin.toFixed(4)) } : null,
    alternatives: ranked.slice(1, 4).map((p) => ({ title: p.title, productUrl: p.productUrl, score: Number(p.score.toFixed(4)) })),
  });
}

const statusCounts = proposals.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {});
const brandCounts = new Map();
for (const proposal of proposals) {
  const key = proposal.marca;
  const stat = brandCounts.get(key) ?? {};
  stat[proposal.status] = (stat[proposal.status] ?? 0) + 1;
  brandCounts.set(key, stat);
}
await fs.writeFile("outputs/mr_supply_product_images/qa/image_match_proposals.json", JSON.stringify(proposals, null, 2), "utf8");
console.log(JSON.stringify({
  total: proposals.length,
  statusCounts,
  byBrand: [...brandCounts.entries()],
  reviewSample: proposals.filter((p) => p.status === "Revisión manual").slice(0, 30),
}, null, 2));
