// Test scraper: GPU prices from Best Buy. Node 18+, no dependencies.
// Usage:
//   node test/scrape_bestbuy.mjs                 # HTML scrape attempt
//   BESTBUY_API_KEY=xxx node test/scrape_bestbuy.mjs   # official Products API
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("./out/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/<[^>]+>/g, "").trim();

async function viaApi(key) {
  const url =
    "https://api.bestbuy.com/v1/products(search=graphics&search=card&categoryPath.id=abcat0507002)" +
    `?apiKey=${key}&format=json&pageSize=25&sort=salePrice.asc&show=sku,name,salePrice,regularPrice,onSale,url,inStoreAvailability,onlineAvailability`;
  const res = await fetch(url);
  console.log(`API status: ${res.status}`);
  const json = await res.json();
  writeFileSync(new URL("api.json", OUT), JSON.stringify(json, null, 2));
  return (json.products ?? []).map((p) => ({
    sku: p.sku, name: p.name, price: p.salePrice, regular: p.regularPrice, inStock: p.onlineAvailability, url: p.url,
  }));
}

async function viaHtml() {
  const url = "https://www.bestbuy.com/site/searchpage.jsp?st=graphics+card&cp=1";
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  const html = await res.text();
  writeFileSync(new URL("search.html", OUT), html);
  console.log(`HTML status: ${res.status}, ${html.length} bytes, server=${res.headers.get("server")}`);

  const items = [];
  // Card order in the DOM differs from the price blocks, so join on SKU using the embedded Apollo cache:
  // "price":{..."displayableCustomerPrice":N,..."skuId":"X"}
  const priceBySku = new Map();
  for (const m of html.matchAll(/"displayableCustomerPrice":([\d.]+)[^}]*?"skuId":"(\d+)"/g)) priceBySku.set(m[2], Number(m[1]));
  const chunks = html.split(/(?=<a[^>]*class="sku-title)/).slice(1);
  chunks.forEach((c) => {
    const href = c.match(/^<a[^>]*href="([^"]+)"/)?.[1];
    const name = c.match(/nc-product-title">([\s\S]*?)<\/span>/)?.[1];
    const sku = href?.match(/\/sku\/(\d+)/)?.[1];
    if (name) items.push({ sku, name: decode(name), price: priceBySku.get(sku) ?? null, url: href ? decode(href) : null });
  });
  if (!items.length) console.log("No products parsed; inspect test/out/search.html (markup changed or bot-block page).");
  return items;
}

const key = process.env.BESTBUY_API_KEY;
const items = key ? await viaApi(key) : await viaHtml();
console.log(`Parsed ${items.length} products (${key ? "API" : "HTML"})`);
writeFileSync(new URL("gpus.json", OUT), JSON.stringify(items, null, 2));
for (const i of items.slice(0, 10)) console.log(`${i.price ?? "n/a"}\t${i.name}`);
