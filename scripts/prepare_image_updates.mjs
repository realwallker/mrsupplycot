import fs from "node:fs/promises";

const proposals = JSON.parse(await fs.readFile("outputs/mr_supply_product_images/qa/image_match_proposals.json", "utf8"));
const catalogFiles = [
  "official_catalogs.json", "supplemental_catalogs.json", "nonshopify_catalogs.json", "windmill_catalog.json",
].map((name) => `outputs/mr_supply_product_images/qa/${name}`);
const catalogs = (await Promise.all(catalogFiles.map(async (path) => { try { return JSON.parse(await fs.readFile(path, "utf8")); } catch { return []; } }))).flat();
const byBrand = new Map();
for (const catalog of catalogs) {
  const key = catalog.brand.toLowerCase();
  byBrand.set(key, [...(byBrand.get(key) ?? []), ...(catalog.products ?? [])]);
}
const brandAlias = (brand) => ({ "biotech": "biotech usa" }[String(brand).toLowerCase()] ?? String(brand).toLowerCase());

const normalized = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/\b(creatina)\b/g, "creatine").replace(/\b(glutamina)\b/g, "glutamine")
  .replace(/\b(carnitina)\b/g, "carnitine").replace(/\b(citrulina)\b/g, "citrulline")
  .replace(/\b(arginina)\b/g, "arginine").replace(/\b(proteinas?)\b/g, "protein")
  .replace(/\b(vainilla)\b/g, "vanilla").replace(/\b(aislada|isolatada)\b/g, "isolate")
  .replace(/\b(multivitaminico)\b/g, "multivitamin").replace(/\b(probioticos)\b/g, "probiotic")
  .replace(/\b(kevin|levrone|ronnie|coleman|nutrex|bpi|sport|dragon|pharma|raw|mutant|biotech|usa|musclemeds|carnivor|gat|prosupps|insane|labz|dorian|yates|muscletech|dymatize|evl|cellucor|ghost|evogen|quest|optimum|universal|windmill|sax|integral|medica|rc)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const stop = new Set(["unit", "unidad", "supplement", "powder", "caps", "capsules", "tablets", "serv", "servings", "protein", "100"]);
const tokens = (value) => normalized(value).split(" ").filter((t) => t && !stop.has(t) && !/^\d+$/.test(t));

const manual = new Map();
const set = (ids, pattern) => ids.forEach((id) => manual.set(id, pattern));
set([152], /^Caffeine 200$/i); set([153,154], /^CLA 1000$/i);
set([162,163,164,165,166], /^Creatine Monohydrate$/i); set([170], /^Lipo-6 Hers UC$/i);
set([172], /^Lipo-6 Intense UC$/i); set([173], /^Lipo-6 Stim-Free$/i); set([177], /^TRIBULUS 1400$/i);
set([201], /^Protein Crisp Bar Unidade -/i); set([206], /^Protein Crisp Bar 12 und/i); set([202,205], /^Barra de Proteína Dark Bar 8/i);
set([204], /^Beta Alanina em Pó 123g$/i); set([208], /^Creamass Hipercalórico/i);
set([209], /^Creatina 100% Pura 150g Hardcore$/i); set([210,211,212,213], /^Nutri Whey Protein Pote 900g$/i);
set([216], /^Best BCAA™ - Branched-Chain Amino Acids$/i); set([217], /^CLA \+ Carnitine - Non/i);
set([218,219,220,221,224], /^ISO HD™ - Isolate Protein$/i); set([223,225,226], /^Whey HD - Whey Protein$/i);
set([228,229], /^Micronized Creatine/i); set([233], /^Carnivor Lean Meal -/i);
set([234,235], /^Carnivor - 100% Beef Protein Isolate/i); set([236], /^Carnivor 8 lb  Bag/i);
set([237,238,239], /^Carnivor Mass - 100%/i); set([240], /Protein Hydration RTD 2 Pack/i);
set([241], /^CARNIVOR PROTEIN HYDRATION RTD - 12 Pack/i); set([242,243], /^Carnivor Shred - 100%/i);
set([249], /^Creatina Micronizada 400g$/i); set([250], /^Glucosamina$/i); set([251], /^HMB\+ZMA/i);
set([253], /^Magnesio Polvo 200gr$/i); set([255], /^Omega 3$/i); set([256], /^Resveratrol$/i); set([257], /^Zinc$/i);
set([258], /^Alpha Lipoic Acid 300 mg$/i); set([261], /^Calcium, Magnesium & Zinc$/i);
set([262], /^Magnesium Citrate 400mg$/i); set([263], /^B Complex with Choline/i); set([264], /^K2 & D3$/i);
set([266], /^Magnesium Glycinate 200 mg$/i); set([268], /^Chromium Picolinate/i); set([272], /^Apple Cider Vinegar$/i); set([273], /^Co-Q10 100 mg$/i);
set([282], /^100% Pure Whey - 900 g$/i); set([283], /^100% Pure Whey - 2000 g$/i);
set([287], /^GEAAR/i); set([297], /^CREATINE MONOHYDRATE$/i); set([302,303], /^ISOPHORM/i);
set([304], /^MASSPHORM/i); set([305,306], /^WHEYPHORM/i); set([311,312,313,314,315], /^BUM Energy Drink$/i);
set([309,310], /^Isolate Protein$/i); set([323,324], /^Creatine XS$/i); set([325], /^Tribulus-XS$/i);
set([327], /^L-Arginine XS$/i); set([328], /^King Whey Sport$/i); set([329,334], /L-Citrulline Capsules/i);
set([330], /Magnesium Glycinate/i); set([331], /L-Arginine Tablets/i); set([334], /^Nutricost Probiotic Complex Capsules$/i);
set([338], /Micronised Creatine Powder/i); set([340,341], /^Serious Mass/i); set([347], /^FLEXX EAAs$/i);
set([348], /^Testrol Gold/i); set([349], /^MENS MULTI/i); set([353], /^HydroBCAA \+EAA$/i); set([357], /^Whey Protein$/i);
set([363], /Beta-Alanine/i); set([364], /^Possessed$/i); set([370,371], /^HIT BCAA/i); set([372], /^Whey Protein Shadowhey/i);
set([373], /^Hydroxycut Hardcore Super Elite$/i); set([374,375], /^Platinum 100% Creatine$/i);
set([375], /Creatine5000.*Powder/i); set([376], /^EAA7000.*Powder/i); set([388], /Collagen/i);
set([414], /^Psychotic SAW$/i); set([417], /^I Am God$/i); set([424], /^DR\. FEAAR$/i);
set([426], /^Dragon Funnel Grey$/i); set([428], /^GREENS & REDS$/i); set([431], /^DRAGON CREW T-SHIRT$/i);
set([432], /^Vita XS$/i); set([438,439], /^Protein Cream - 400 g$/i); set([440], /^Vitamin C effervescent/i); set([441], /^Creatine Zero effervescent/i);
set([447], /^Omega 3 - 60ct$/i);

// Correcciones puntuales tras contrastar los ID con la hoja fuente.
set([329,335], /L-Citrulline Capsules/i); set([331,333], /L-Arginine Tablets/i); set([334], /^Nutricost Probiotic Complex Capsules$/i);
manual.delete(338); set([339], /Micronised Creatine Powder/i);
set([343], /^FLEXX EAAs$/i); set([344], /^Testrol Gold/i); set([345], /^MENS MULTI/i);
set([347], /^Magnesium Citrate$/i); set([348,349], /^Isolate Premium 4lbs$/i);
manual.delete(363); set([364], /Beta-Alanine/i); set([367], /^Possessed$/i);
set([369], /^HIT BCAA/i); set([370], /^Whey Protein Shadowhey 2Kg/i); manual.delete(371);
manual.delete(372); manual.delete(373);
set([374], /^Hydroxycut Hardcore Super Elite$/i); set([375], /^Platinum 100% Creatine$/i); manual.delete(376);
set([378], /Creatine5000.*Powder/i); set([379], /^EAA7000.*Powder/i);
set([413], /^JOKER,/i); set([414], /^MANIAC,/i); set([415], /^Psychotic SAW$/i);
manual.delete(424); set([431], /^DR\. FEAAR$/i); set([433], /^DRAGON CREW T-SHIRT$/i);

const rejected = new Set([176,203,207,214,215,222,244,252,253,259,260,265,269,270,271,287,289,290,291,292,293,299,302,306,317,318,319,3270,335,339,342,343,344,345,352,362,367,377,378,379,383,384,385,387,390,391,394,4120,413,415,416,418,425,427,430,433,442]);
const promo = /\b(tee|shirt|hoodie|hat|bag|stack|vip|nfla|gen iron|sample|bundle|toothbrush)\b/i;
const apparelQuery = /camiseta|shirt|tee|hoodie|gorra|hat|bag|mochila/i;

const updates = [];
for (const p of proposals) {
  const products = byBrand.get(brandAlias(p.marca)) ?? [];
  let chosen = null;
  let method = "";
  const pattern = manual.get(Number(p.id));
  if (pattern) {
    chosen = products.find((product) => pattern.test(product.title));
    if (chosen) method = "Regla curada";
  }
  if (!chosen && !rejected.has(Number(p.id)) && p.best) {
    const q = tokens(p.producto);
    const c = new Set(tokens(p.best.title));
    const shared = q.filter((token) => c.has(token)).length;
    const coverage = q.length ? shared / q.length : 0;
    const promotionalMismatch = promo.test(p.best.title) && !apparelQuery.test(p.producto);
    const strong = (q.length >= 2 && coverage >= 0.75) || (q.length === 1 && coverage === 1 && q[0].length >= 4);
    const confident = ["Alta confianza", "Confianza media"].includes(p.status) && coverage >= 0.5;
    if (!promotionalMismatch && (strong || confident)) {
      chosen = { title: p.best.title, imageUrl: p.best.imageUrl, productUrl: p.best.productUrl, sourceDomain: p.best.sourceDomain };
      method = strong ? "Coincidencia semántica" : p.status;
    }
  }
  if (chosen?.imageUrl) updates.push({ id: Number(p.id), marca: p.marca, producto: p.producto, sku: p.sku, imageUrl: chosen.imageUrl, sourceUrl: chosen.productUrl, sourceDomain: chosen.sourceDomain, matchedTitle: chosen.title, method });
}

await fs.writeFile("outputs/mr_supply_product_images/qa/approved_image_updates.json", JSON.stringify(updates, null, 2), "utf8");
console.log(JSON.stringify({ approved: updates.length, remaining: proposals.length - updates.length, byMethod: updates.reduce((a,u)=>({...a,[u.method]:(a[u.method]??0)+1}),{}) }, null, 2));
console.log(updates.filter((u) => u.method === "Coincidencia semántica").map((u) => `${u.id}\t${u.marca}\t${u.producto}\t=>\t${u.matchedTitle}`).join("\n"));
