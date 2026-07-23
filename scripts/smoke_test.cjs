const fs = require("node:fs/promises");
process.env.NODE_PATH = "C:/Users/Marceram03/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/node_modules";
require("node:module").Module._initPaths();
const { chromium } = require("C:/Users/Marceram03/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

(async () => {
  await fs.mkdir("outputs/mr_supply_web/qa", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await page.waitForSelector(".product-card");
  const productsLabel = await page.locator(".catalog-meta").innerText();
  await page.locator(".searchbox input").fill("ALOE VERA");
  await page.waitForTimeout(250);
  const matchingCards = await page.locator(".product-card").count();
  await page.locator(".product-card").first().locator(".product-footer button").click();
  const quoteItems = await page.locator(".quote-line").count();
  await page.locator(".client-fields input").first().fill("Cliente de prueba");
  await page.waitForTimeout(1500);
  const savedQuotes = await page.evaluate(() => JSON.parse(localStorage.getItem("mrsupply.quotes.v1") || "[]").length);
  const total = await page.locator(".quote-summary .total strong").innerText();
  await page.screenshot({ path: "outputs/mr_supply_web/qa/app_catalog.png", fullPage: true });
  await browser.close();
  if (!productsLabel.includes("443") || matchingCards < 1 || quoteItems !== 1 || savedQuotes < 1 || pageErrors.length) {
    throw new Error(JSON.stringify({ productsLabel, matchingCards, quoteItems, savedQuotes, total, pageErrors }));
  }
  console.log(JSON.stringify({ productsLabel, matchingCards, quoteItems, savedQuotes, total, pageErrors }, null, 2));
})();
