import fs from "node:fs/promises";

const input = "outputs/mr_supply_product_images/qa/curated_missing_image_updates.json";
const output = "outputs/mr_supply_product_images/qa/curated_image_validation.json";
const candidates = JSON.parse(await fs.readFile(input, "utf8"));
const results = [];
let cursor = 0;

async function validate(candidate) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const response = await fetch(candidate.imageUrl, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 MrSupplyCatalog/2.0", Range: "bytes=0-32767" },
      signal: controller.signal,
    });
    const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      id: candidate.id,
      sku: candidate.sku,
      url: candidate.imageUrl,
      valid: response.ok && contentType.startsWith("image/") && bytes.length > 1000,
      status: response.status,
      contentType,
      bytesRead: bytes.length,
      finalUrl: response.url,
    };
  } catch (error) {
    return { id: candidate.id, sku: candidate.sku, url: candidate.imageUrl, valid: false, error: String(error?.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

async function worker() {
  while (cursor < candidates.length) {
    const candidate = candidates[cursor++];
    results.push(await validate(candidate));
  }
}

await Promise.all(Array.from({ length: 10 }, () => worker()));
results.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
await fs.writeFile(output, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ total: results.length, valid: results.filter((r) => r.valid).length, invalid: results.filter((r) => !r.valid) }, null, 2));
