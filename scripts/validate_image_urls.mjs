import fs from "node:fs/promises";

const updates = JSON.parse(await fs.readFile("outputs/mr_supply_product_images/qa/approved_image_updates.json", "utf8"));
const audit = JSON.parse(await fs.readFile("outputs/mr_supply_product_images/qa/image_audit.json", "utf8"));
const originalUrl = (url) => url.replace(/-\d+x\d+(?=\.(?:png|jpe?g|webp)(?:\?|$))/i, "");
const candidates = [
  ...updates.map((u) => ({ type: "new", id: u.id, url: u.imageUrl })),
  ...audit.miniaturas.map((u) => ({ type: "thumbnail_upgrade", id: Number(u.id), url: originalUrl(u.url), oldUrl: u.url })),
];

const results = [];
let cursor = 0;
async function validate(candidate) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    let response = await fetch(candidate.url, { method: "HEAD", redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 MrSupplyCatalog/1.0" }, signal: controller.signal });
    if (!response.ok || !String(response.headers.get("content-type") ?? "").toLowerCase().startsWith("image/")) {
      response = await fetch(candidate.url, { method: "GET", redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 MrSupplyCatalog/1.0", Range: "bytes=0-2047" }, signal: controller.signal });
    }
    const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
    return { ...candidate, valid: response.ok && contentType.startsWith("image/"), status: response.status, contentType, finalUrl: response.url };
  } catch (error) {
    return { ...candidate, valid: false, error: String(error?.message ?? error) };
  } finally { clearTimeout(timer); }
}
async function worker() {
  while (cursor < candidates.length) results.push(await validate(candidates[cursor++]));
}
await Promise.all(Array.from({ length: 12 }, () => worker()));
await fs.writeFile("outputs/mr_supply_product_images/qa/url_validation.json", JSON.stringify(results, null, 2), "utf8");
console.log(JSON.stringify({ total: results.length, valid: results.filter((r) => r.valid).length, invalid: results.filter((r) => !r.valid).length, invalidItems: results.filter((r) => !r.valid) }, null, 2));
