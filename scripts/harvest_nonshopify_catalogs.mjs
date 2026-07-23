import fs from "node:fs/promises";

const outPath = "outputs/mr_supply_product_images/qa/nonshopify_catalogs.json";
const sites = [
  { brand: "Saxofit", base: "https://saxofit.com" },
  { brand: "Windmill", base: "https://www.windmillvitamins.com" },
  { brand: "Kevin Levrone", base: "https://levrosupplements.com" },
  { brand: "Integralmedica", base: "https://www.integralmedica.com.br" },
  { brand: "Athletica", base: "https://www.atlheticanutrition.com.br" },
  { brand: "FA Nutrition", base: "https://fa-nutrition.com" },
  { brand: "Mrs Taste", base: "https://mrstaste.com.br" },
  { brand: "Dymatize", base: "https://dymatize.com" },
  { brand: "Universal Nutrition", base: "https://www.universalnutrition.com" },
  { brand: "Hochsport", base: "https://hochsport.com" },
  { brand: "Vitamin Life", base: "https://vitaminlifeusa.com" },
];

const decode = (text) => String(text ?? "")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function get(url, timeout = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MrSupplyCatalog/1.0)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return { text: await response.text(), headers: response.headers, url: response.url };
  } finally { clearTimeout(timer); }
}

function locs(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => decode(m[1].trim()));
}

function meta(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decode(match[1]);
  }
  return "";
}

async function wooProducts(site) {
  const products = [];
  for (let page = 1; page <= 5; page += 1) {
    try {
      const { text } = await get(`${site.base}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, 25000);
      const batch = JSON.parse(text);
      if (!Array.isArray(batch) || !batch.length) break;
      products.push(...batch.map((p) => ({
        brand: site.brand,
        sourceDomain: new URL(site.base).hostname,
        title: decode(p.name ?? ""),
        productUrl: p.permalink ?? site.base,
        imageUrl: p.images?.[0]?.src ?? "",
        images: (p.images ?? []).map((image) => image.src).filter(Boolean),
        variants: [],
      })).filter((p) => p.imageUrl));
      if (batch.length < 100) break;
    } catch { break; }
  }
  return products;
}

async function sitemapPages(site) {
  const seeds = [
    `${site.base}/sitemap_products_1.xml`,
    `${site.base}/product-sitemap.xml`,
    `${site.base}/wp-sitemap-posts-product-1.xml`,
    `${site.base}/sitemap.xml`,
    `${site.base}/wp-sitemap.xml`,
  ];
  const visited = new Set();
  const queue = [...seeds];
  const pages = new Set();
  while (queue.length && visited.size < 80 && pages.size < 1200) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const { text } = await get(url);
      for (const loc of locs(text)) {
        if (/\.xml(?:\?|$)/i.test(loc)) {
          if (/product|produto|post|page|sitemap/i.test(loc)) queue.push(loc);
        } else if (/\/product|\/products|\/producto|\/produto|\.html(?:\?|$)/i.test(loc)) {
          pages.add(loc);
        }
      }
    } catch { /* Try the next conventional sitemap path. */ }
  }
  return [...pages];
}

async function scrapePages(site, urls) {
  const products = [];
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      try {
        const { text, url: finalUrl } = await get(url);
        const title = meta(text, "og:title") || meta(text, "twitter:title");
        const imageUrl = meta(text, "og:image") || meta(text, "twitter:image");
        if (title && imageUrl && !/logo|home|category|collection/i.test(title)) {
          products.push({ brand: site.brand, sourceDomain: new URL(site.base).hostname, title, productUrl: finalUrl, imageUrl, images: [imageUrl], variants: [] });
        }
      } catch { /* Keep harvesting other pages. */ }
    }
  }
  await Promise.all(Array.from({ length: 7 }, () => worker()));
  return products;
}

const output = [];
for (const site of sites) {
  const woo = await wooProducts(site);
  let products = woo;
  let pageCount = 0;
  if (!products.length) {
    const pages = await sitemapPages(site);
    pageCount = pages.length;
    products = await scrapePages(site, pages);
  }
  const deduped = [...new Map(products.map((p) => [p.productUrl, p])).values()];
  output.push({ ...site, count: deduped.length, pageCount, products: deduped });
  console.log(`${site.brand}: ${deduped.length} products (${pageCount} sitemap pages)`);
}
await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf8");
