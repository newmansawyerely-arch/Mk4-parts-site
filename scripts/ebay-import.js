const fs = require("fs");
const axios = require("axios");

const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

async function getToken() {
  const response = await axios.post(
    "https://api.ebay.com/identity/v1/oauth2/token",
    "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: { username: CLIENT_ID, password: CLIENT_SECRET },
    }
  );
  return response.data.access_token;
}

async function searchEbay(token) {
  const response = await axios.get(
    "https://api.ebay.com/buy/browse/v1/item_summary/search",
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { q: "MK4 Golf GTI parts", limit: 100 },
    }
  );
  return response.data.itemSummaries || [];
}

function productKey(product) {
  // eBay item URLs can differ only by tracking/query parameters.
  // Prefer the stable eBay item ID so the same listing is stored once.
  const id = String(product.id || "");
  const parts = id.split("|");
  if (parts.length >= 2 && /^v1$/.test(parts[0]) && /^\\d+$/.test(parts[1])) {
    return parts.slice(0, 3).join("|");
  }
  const url = String(product.ebay || "");
  const match = url.match(/\\/itm\\/(?:[^/]+\\/)?(\\d{9,15})/);
  if (match) return match[1];
  return url || id || String(product.name || "").toLowerCase().replace(/\\s+/g, " ").trim();
}

function categorizeProduct(name = "") {
  const title = name.toLowerCase();
  const rules = [
    ["brakes", /\b(brake|rotor|caliper|brake pad|brake line|master cylinder|abs sensor)\b/],
    ["suspension", /\b(suspension|coilover|shock|strut|spring|control arm|sway bar|tie rod|ball joint|wheel bearing|bushing)\b/],
    ["interior", /\b(interior|seat|floor mat|carpet|shift knob|steering wheel|door panel|window switch|radio|head unit|gauge cluster)\b/],
    ["exterior", /\b(exterior|bumper|fender|hood|grille|headlight|tail light|taillight|mirror|spoiler|body kit|door handle|windshield|wiper|wheel rim)\b/],
    ["engine", /\b(engine|turbo|intake|intercooler|spark plug|ignition coil|coil pack|fuel pump|injector|oil filter|water pump|timing belt|alternator|starter|radiator|thermostat|clutch|transmission|exhaust|downpipe|sensor|gasket|piston|camshaft|crankshaft)\b/],
  ];
  for (const [category, pattern] of rules) {
    if (pattern.test(title)) return category;
  }
  return "other";
}

async function main() {
  try {
    const token = await getToken();
    const items = await searchEbay(token);
    let existing = [];

    if (fs.existsSync("data.json")) {
      const raw = fs.readFileSync("data.json", "utf8").trim();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) existing = parsed;
      }
    }

    // Correct legacy categories and keep existing listings.
    const productsByKey = new Map();
    for (const product of existing) {
      if (!product || typeof product !== "object") continue;
      const normalized = {
        ...product,
        category: categorizeProduct(product.name || product.description || ""),
      };
      const key = productKey(normalized);
      if (key) productsByKey.set(key, normalized);
    }

    // Update current listings and deduplicate by eBay URL/ID.
    for (const item of items) {
      const product = {
        id: item.itemId || item.itemWebUrl,
        name: item.title || "MK4 Golf part",
        price: item.price ? item.price.value : "N/A",
        image: item.image ? item.image.imageUrl : "",
        ebay: item.itemWebUrl || "",
        category: categorizeProduct(item.title || ""),
        description: item.title || "",
      };
      const key = productKey(product);
      if (key) productsByKey.set(key, { ...(productsByKey.get(key) || {}), ...product });
    }

    const products = Array.from(productsByKey.values());
    fs.writeFileSync("data.json", JSON.stringify(products, null, 2) + "\n");
    console.log(`Saved ${products.length} total products`);
  } catch (err) {
    console.error(err.response?.data || err.message);
    process.exitCode = 1;
  }
}

main();
