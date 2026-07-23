import fs from "node:fs/promises";

const base = "https://www.windmillvitamins.com";
const outPath = "outputs/mr_supply_product_images/qa/windmill_catalog.json";
const decode = (text) => String(text ?? "").replace(/&amp;/g, "&").replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MrSupplyCatalog/1.0" }, signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status}`);
    return await response.text();
  } finally { clearTimeout(timer); }
}

const xml = await get(`${base}/sitemap.xml`);
const rootUrls = [...xml.matchAll(/<loc>(.*?)<\/loc>/gi)].map((m) => decode(m[1]));
const sitemapUrls = rootUrls.filter((u) => /\.xml(?:\?|$)/i.test(u) && /product/i.test(u));
const productPages = new Set();
for (const url of rootUrls) if (/\/product\//i.test(url)) productPages.add(url);
for (const sitemapUrl of sitemapUrls) {
  try {
    const child = await get(sitemapUrl);
    for (const match of child.matchAll(/<loc>(.*?)<\/loc>/gi)) {
      const url = decode(match[1]);
      if (/\/product\//i.test(url)) productPages.add(url);
    }
  } catch { /* continue */ }
}

const urls = [...productPages];
const products = [];
let cursor = 0;
async function worker() {
  while (cursor < urls.length) {
    const productUrl = urls[cursor++];
    try {
      const html = await get(productUrl);
      const title = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
      const imageMatches = [...html.matchAll(/https?:[^"' ]+\.(?:png|jpe?g|webp)(?:\?[^"' ]*)?/gi)].map((m) => decode(m[0]));
      const imageUrl = imageMatches.find((url) => /\/pub\/products\//i.test(url) && !/ND\.(?:png|jpe?g|webp)/i.test(url))
        ?? imageMatches.find((url) => /\/pub\/products\//i.test(url)) ?? "";
      if (title && imageUrl) products.push({ brand: "Windmill", sourceDomain: "www.windmillvitamins.com", title, productUrl, imageUrl, images: [imageUrl], variants: [] });
    } catch { /* continue */ }
  }
}
await Promise.all(Array.from({ length: 8 }, () => worker()));
const output = [{ brand: "Windmill", base, count: products.length, products }];
await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify({ sitemapUrls: sitemapUrls.length, productPages: urls.length, products: products.length }));
