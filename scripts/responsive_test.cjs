const fs = require("node:fs/promises");
process.env.NODE_PATH = "C:/Users/Marceram03/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/node_modules";
require("node:module").Module._initPaths();
const { chromium } = require("C:/Users/Marceram03/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const viewports = [
  { width: 320, height: 720, minColumns: 1 },
  { width: 375, height: 812, minColumns: 2 },
  { width: 768, height: 1024, minColumns: 3 },
  { width: 1024, height: 768, minColumns: 4 },
  { width: 1366, height: 768, minColumns: 3 },
  { width: 1920, height: 1080, minColumns: 5 },
];

(async () => {
  await fs.mkdir("outputs/mr_supply_web/qa/responsive", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".product-card");
    const metrics = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".product-card")].slice(0, 12);
      const lefts = [...new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left)))];
      const defects = cards.map((card) => {
        const imageArea = card.querySelector(".product-image").getBoundingClientRect();
        const body = card.querySelector(".product-body").getBoundingClientRect();
        const image = card.querySelector(".product-image img")?.getBoundingClientRect();
        return {
          imageBodyOverlap: imageArea.bottom > body.top + 1,
          imageOverflow: Boolean(image && (image.left < imageArea.left - 1 || image.right > imageArea.right + 1 || image.top < imageArea.top - 1 || image.bottom > imageArea.bottom + 1)),
          width: card.getBoundingClientRect().width,
        };
      });
      return {
        columns: lefts.length,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        minCardWidth: Math.min(...defects.map((item) => item.width)),
        layoutDefects: defects.filter((item) => item.imageBodyOverlap || item.imageOverflow),
      };
    });
    const trigger = page.locator(".mobile-quote-trigger");
    const triggerVisible = await trigger.isVisible();
    let panelWithinViewport = true;
    let panelBox = null;
    if (viewport.width <= 1120) {
      await trigger.click();
      await page.waitForTimeout(350);
      panelBox = await page.locator(".quote-panel").boundingBox();
      panelWithinViewport = Boolean(panelBox && panelBox.x >= -1 && panelBox.x + panelBox.width <= viewport.width + 1 && panelBox.y >= -1 && panelBox.y + panelBox.height <= viewport.height + 1);
      await page.locator(".mobile-quote-close").click();
      await page.waitForTimeout(350);
    }
    if ([320, 768, 1366, 1920].includes(viewport.width)) {
      await page.screenshot({ path: `outputs/mr_supply_web/qa/responsive/${viewport.width}x${viewport.height}.png`, fullPage: false });
    }
    const result = { viewport, ...metrics, triggerVisible, panelWithinViewport, panelBox, pageErrors };
    results.push(result);
    if (metrics.columns < viewport.minColumns || metrics.horizontalOverflow || metrics.layoutDefects.length || !panelWithinViewport || pageErrors.length || triggerVisible !== (viewport.width <= 1120)) {
      throw new Error(JSON.stringify(result));
    }
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();
