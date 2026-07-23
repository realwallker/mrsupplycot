import fs from "node:fs/promises";

const catalogPath = "src/data/catalog.json";
const qaDir = "outputs/mr_supply_product_images/qa";
const searchPath = `${qaDir}/bing_missing_image_results.json`;
const outputPath = `${qaDir}/curated_missing_image_updates.json`;

const searchRows = JSON.parse(await fs.readFile(searchPath, "utf8"));
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));

const overrides = {
  "prod-185": ["https://es.vitamin360.com/img/42678/2060015000/2060015000.webp", "https://es.vitamin360.com/p/kevin-levrone-levro-mono-300-g", "Kevin Levrone Levro Mono 300 g"],
  "prod-247": ["https://http2.mlstatic.com/D_NQ_NP_875696-MEC104019618454_012026-O.webp", "https://www.mercadolibre.com.ec/saxofit-colageno-marino/up/MECU3719033311", "Saxofit Colágeno Marino — presentación coincidente"],
  "prod-259": ["https://www.windmillvitamins.com/pub/products/20241220103144_wm130A350x500.jpg", "https://www.windmillvitamins.com/product/b12-1000-mcg", "Windmill B12 1.000 mcg — imagen oficial"],
  "prod-285": ["https://vitamins-ninja.com/wp-content/uploads/2018/03/Biotech-USA-Zero-Bar-Mix-Box-20-x-50g-2.jpg", "https://vitamins-ninja.com/biotech-usa-zero-bar-x-20-bars/", "BioTech USA Zero Bar — caja de 20"],
  "prod-318": ["https://cdn.shopify.com/s/files/1/0932/3141/5614/files/heroshot1.webp?v=1766159185", "https://getrawnutrition.com/products/raw-nutrition-creatine", "Creatine Monohydrate RAW — imagen oficial"],
  "prod-319": ["https://cdn.shopify.com/s/files/1/0932/3141/5614/files/heroshot1.webp?v=1766159185", "https://getrawnutrition.com/products/raw-nutrition-creatine", "Creatine Monohydrate RAW — imagen oficial"],
  "prod-352": ["https://misproductosfnl.cl/wp-content/uploads/2025/12/carbblocker90V1-nuevo.png", "https://misproductosfnl.cl/producto/carb-blocker-bloqueador-de-carbohidratos-90-capsulas-4/", "Carb Blocker — imagen referencial de categoría"],
  "prod-372": ["https://i5.walmartimages.com.mx/mg/gm/3pp/asr/d09cfe8f-07eb-42cf-9717-cded3a17ccac.b21fdd49bab0d1ce229e879000ea907d.jpeg?odnHeight=2000&odnWidth=2000&odnBg=ffffff", "https://www.bodegaaurrera.com.mx/ip/envasados-dulces/syrup-de-chocolate-mrs-taste-sin-azucar-0-calorias-335-g-mrs-taste-mrstastechocolate/00074288088865", "Mrs Taste Chocolate — presentación coincidente"],
  "prod-371": ["https://mrstaste.com/cdn/shop/products/MrsTasteUSA-Barbecue_C_2400x.jpg?v=1669829366", "https://mrstaste.com/products/barbecue", "Mrs Taste Barbecue — imagen oficial"],
  "prod-384": ["https://goldennaturalsusa.com/cdn/shop/files/ef1b9135-ome-3-1-2_2bb8ca38-cc96-4043-8c8d-902df6d0a3f7.jpg?v=1770836531&width=1200", "https://goldennaturalsusa.com/products/omega-3-vitamins-90-capsules", "Golden Naturals Omega 3 90 cápsulas"],
  "prod-391": ["https://cdn.shopify.com/s/files/1/2060/6331/files/ENERGYMericaPop.webp?v=1749497687", "https://www.ghostlifestyle.com/products/ghost-energy-case-merica-pop", "GHOST Energy — imagen oficial"],
  "prod-392": ["https://herowhey.com/wp-content/uploads/2024/12/Record-203.jpg", "https://perfectbodystore.com/producto/rosenbaum-magnesio-bisglicinato-48g-60-tabletas/", "Magnesio bisglicinato — imagen referencial; ficha Rosenbaum validada"],
  "prod-395": ["https://cdn.shopify.com/s/files/1/0932/3141/5614/files/Liquid_Glycerol-StrawberrySlush-front_53b22476-f1ed-413b-b8f2-c3214eb6b854.webp?v=1745899508", "https://getrawnutrition.com/products/liquid-glycerol", "Glicerol deportivo — imagen oficial de referencia"],
  "prod-397": ["https://cbn-nutrition.com/wp-content/uploads/2025/11/multi-support-cbn.jpg", "https://cbn-nutrition.com/product/multisupport-10-1/", "CBN Multi Support — imagen oficial"],
  "prod-398": ["https://titanfitstore.com.ec/wp-content/uploads/2026/01/SUPNATU0027.png", "https://titanfitstore.com.ec/tienda/nat-world-omega-3-1000mg-100-softgels/", "Nature's World Omega 3 100 softgels"],
  "prod-399": ["https://www.windmillvitamins.com/pub/products/20250218115250_wmg294350x500.jpg", "https://www.windmillvitamins.com/product/vitamin-d3-k2", "D3 + K2 — imagen oficial de referencia"],
  "prod-400": ["https://jaleareal.com.ec/wp-content/uploads/2024/12/23-1.png", "https://jaleareal.com.ec/product/hgh-4-688mg-60-capsulas-sun-vitamins/", "HGH-4 688 mg 60 cápsulas — presentación coincidente"],
  "prod-401": ["https://chochofy.mx/wp-content/uploads/2024/06/Vitamin-D3-WINDMILL.webp", "https://chochofy.mx/producto/vitamin-d3-windmill/", "Vitamina D3 — presentación de referencia"],
  "prod-402": ["https://saxofit.com/wp-content/uploads/2025/11/RESVERATROL-60CAPS.png", "https://saxofit.com/producto/resveratrol-60-capsulas/", "Resveratrol — imagen oficial de referencia"],
  "prod-403": ["https://d2eebw31vcx88p.cloudfront.net/ecomodico/uploads/1330f8fe8c0efec4d13f12c77d9b26e0bac6fa43.jpg", "https://ecomodico.com/p/maltodextrina-nutrex-mdx-suplemento-en-polvo-400-gr/bb4b8a8c-3816-43c7-9a77-482674088721", "Maltodextrina deportiva — imagen referencial"],
  "prod-404": ["https://img.drogaraia.com.br/catalog/product/p/r/prod_20220615181056210.jpg?width=900&height=900&quality=90&type=resize", "https://www.escorregaopreco.com.br/ofertas/drogaraia/2901038", "Maltodextrina deportiva 1 kg"],
  "prod-405": ["https://cdn.shopify.com/s/files/1/0009/3401/9129/files/RENDERS-600X600-2023_0014_Mockup---Dragon-Pharma---Reds-n-Greens---Lemonade---Posicao-1.png?v=1691501627", "https://dragonpharmalabs.com/products/reds-greens", "Super Greens — imagen oficial de referencia"],
  "prod-406": ["https://cdn.shopify.com/s/files/1/0009/3401/9129/files/RENDERS-600X600-2023_0014_Mockup---Dragon-Pharma---Reds-n-Greens---Lemonade---Posicao-1.png?v=1691501627", "https://dragonpharmalabs.com/products/reds-greens", "Super Reds — imagen oficial de referencia"],
  "prod-407": ["https://cdn.shopify.com/s/files/1/0932/3141/5614/files/1_-_RAW_CORE_01_Cream_of_Rice_Double_Fudge_25_serv_-_Front.webp?v=1777387243", "https://getrawnutrition.com/products/cream-of-rice", "Cream of Rice — imagen oficial de referencia"],
  "prod-408": ["https://primenutrition.ec/catalogo/prod-munequeras-lycan-nb.png", "https://primenutrition.ec/", "Muñequeras deportivas — catálogo ecuatoriano"],
  "prod-409": ["https://static.wixstatic.com/media/7a7632_b06bde0b69f4402aa9b6851f4af35270~mv2.jpeg/v1/fill/w_1080,h_1004,al_c,q_85,enc_avif,quality_auto/7a7632_b06bde0b69f4402aa9b6851f4af35270~mv2.jpeg", "https://www.sequanadeportes.com/product-page/par-de-straps-simple-svg", "Straps deportivos — imagen de producto"],
  "prod-410": ["https://naturalecuadorfit.com/wp-content/uploads/2024/03/GUANTES-GYM-2.jpg", "https://naturalecuadorfit.com/product/guantes-de-entrenamiento-para-gimnasio/", "Guantes de entrenamiento — catálogo ecuatoriano"],
  "prod-411": ["https://fitbarz.com.gt/wp-content/uploads/2025/06/2645b5f3bec5381bc2bae30821183fc1_Par_de_Rodilleras_Negras_2.0_1419.jpeg", "https://fitbarz.com.gt/producto/rodillera-negra-2-0/", "Rodilleras deportivas — imagen de producto"],
  "prod-444": ["https://http2.mlstatic.com/D_NQ_NP_782502-MLA80374720537_112024-O.webp", "https://www.mercadolibre.com.ec/pre-entreno-psychotic-saw-series-insane-labz-30-serv-grape/p/MEC32431921", "Psychotic SAW Insane Labz — presentación coincidente"],
  "prod-446": ["https://cdn.shopify.com/s/files/1/0315/3415/3773/files/Carnivor_RunningWild_BlackPlainMock-893736.jpg?v=1732045956", "https://musclemedsrx.com/products/carnivor-running-wild-t-shirt-black", "Carnivor Runnin' Wild T-Shirt — imagen oficial"],
};

const updates = searchRows.map((row) => {
  const choice = overrides[row.id];
  const first = row.results?.[0];
  if (!choice && !first) throw new Error(`Sin candidato para ${row.id}`);
  return {
    id: row.id,
    sku: row.sku,
    brand: row.brand,
    name: row.name,
    presentation: row.presentation,
    imageUrl: choice?.[0] ?? first.imageUrl,
    sourceUrl: choice?.[1] ?? first.pageUrl,
    matchedTitle: choice?.[2] ?? first.title,
    method: choice ? "Curación manual" : "Coincidencia exacta por marca, producto y presentación",
  };
});

const byId = new Map(updates.map((row) => [row.id, row]));
let changed = 0;
for (const product of catalog) {
  const update = byId.get(product.id);
  if (!update) continue;
  product.imageUrl = update.imageUrl;
  changed += 1;
}
if (changed !== updates.length) throw new Error(`Actualizados ${changed} de ${updates.length}`);

await fs.writeFile(outputPath, `${JSON.stringify(updates, null, 2)}\n`);
await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({ updates: updates.length, changed, missingAfter: catalog.filter((p) => !p.imageUrl).length, outputPath }, null, 2));
