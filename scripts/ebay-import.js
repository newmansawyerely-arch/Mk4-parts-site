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
  // Prefer the stable eBay item ID; ignore URL tracking/query parameters.
  const id = String(product.id || "");
  const parts = id.split("|");
  if (parts.length >= 2 && parts[0] === "v1" && /^\d+$/.test(parts[1])) {
    return parts.slice(0, 3).join("|");
  }
  const url = String(product.ebay || "");
  const match = url.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/);
  if (match) return match[1];
  return url || id || String(product.name || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function categorizeProduct(name = "") {
  const title = name.toLowerCase();
  const rules = [
    ["maintenance", /\\b(oil filter|air filter|cabin filter|fuel filter|maintenance kit|timing belt kit|serpentine belt|drive belt|coolant hose|radiator hose|heater hose|service kit|wiper blade)\\b/],
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

    // Keep the engine category from being flooded with near-identical
    // silicone intake/induction hoses. Keep at most two distinct listings.
    const allProducts = Array.from(productsByKey.values());
    const products = [];
    let siliconeIntakeHosesKept = 0;
    let radiatorHoseListingsKept = 0;
    const siliconeIntakeHosePattern = /\b(silicone|silicon)\b.*\b(intake|induction)\b.*\b(pipe|hose|tub(e|ing))\b|\b(intake|induction)\b.*\b(pipe|hose|tub(e|ing))\b.*\b(silicone|silicon)\b/i;
    const radiatorHosePattern = /\b(radiator|coolant)\b.*\b(hose|hoses|pipe|piping|tube|tubing|kit)\b|\b(hose|hoses|pipe|piping|tube|tubing|kit)\b.*\b(radiator|coolant)\b/i;

    for (const product of allProducts) {
      const title = String(product.name || product.description || "");
      if (siliconeIntakeHosePattern.test(title)) {
        if (siliconeIntakeHosesKept >= 2) continue;
        siliconeIntakeHosesKept++;
      }
      if (radiatorHosePattern.test(title)) {
        if (radiatorHoseListingsKept >= 2) continue;
        radiatorHoseListingsKept++;
      }
      products.push(product);
    }

    fs.writeFileSync("data.json", JSON.stringify(products, null, 2) + "\n");
    console.log("Saved " + products.length + " total products (kept " + siliconeIntakeHosesKept + " silicone intake/induction hose listings and " + radiatorHoseListingsKept + " radiator/coolant hose listings)");
  } catch (err) {
    console.error(err.response?.data || err.message);
    process.exitCode = 1;
  }
}

main();
