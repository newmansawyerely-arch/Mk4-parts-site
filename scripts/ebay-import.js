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

const SEARCHES = [
  "VW Golf GTI MK4 oil filter 1.8T",
  "VW Golf GTI MK4 air filter 1.8T",
  "VW Golf GTI MK4 spark plugs 1.8T",
  "VW Golf GTI MK4 timing belt kit water pump",
  "VW Golf GTI MK4 serpentine drive belt",
  "VW Golf GTI MK4 water pump 1.8T",
  "VW Golf GTI MK4 thermostat coolant flange",
  "VW Golf GTI MK4 brake pads rotors",
  "VW Golf GTI MK4 ignition coil pack",
  "VW Golf GTI MK4 suspension coilovers",
  "VW Golf GTI MK4 radiator coolant hose",
  "VW Golf GTI MK4 parts"
];

async function searchEbay(token) {
  const responses = await Promise.all(SEARCHES.map(async q => {
    try {
      const response = await axios.get(
        "https://api.ebay.com/buy/browse/v1/item_summary/search",
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { q, limit: 50, filter: "buyingOptions:{FIXED_PRICE}" },
        }
      );
      return response.data.itemSummaries || [];
    } catch (error) {
      console.warn("Search failed for:", q, error.response?.status || error.message);
      return [];
    }
  }));
  return responses.flat();
}

function isUsed(product) {
  const text = [product.condition, product.name, product.description].join(" ");
  return /\b(used|pre-owned|preowned|salvage|for parts or not working|refurbished)\b/i.test(text);
}

function categorizeProduct(name = "") {
  const title = name.toLowerCase();
  if (/\b(used|pre-owned|preowned|salvage|for parts or not working|refurbished)\b/i.test(title)) return "used";
  // Maintenance gets checked before broad engine terms, so filters, belts and service kits
  // don't get swallowed by the Engine category.
  const rules = [
    ["maintenance", /\b(oil filter|air filter|cabin filter|fuel filter|spark plug|spark plugs|timing belt kit|timing belt set|serpentine belt|drive belt|accessory belt|coolant hose|radiator hose|heater hose|service kit|maintenance kit|wiper blade|oil change|filter kit|water pump kit)\b/],
    ["brakes", /\b(brake|rotor|caliper|brake pad|brake line|master cylinder|abs sensor)\b/],
    ["suspension", /\b(suspension|coilover|shock|strut|spring|control arm|sway bar|tie rod|ball joint|wheel bearing|bushing)\b/],
    ["interior", /\b(interior|seat|floor mat|carpet|shift knob|steering wheel|door panel|window switch|radio|head unit|gauge cluster|cup holder|ashtray)\b/],
    ["exterior", /\b(exterior|bumper|fender|hood|grille|headlight|tail light|taillight|mirror|spoiler|body kit|door handle|windshield|wheel rim|rocker panel|quarter panel)\b/],
    ["engine", /\b(engine|turbo|intake|intercooler|ignition coil|coil pack|fuel pump|injector|water pump|radiator|thermostat|clutch|transmission|exhaust|downpipe|sensor|gasket|piston|camshaft|crankshaft|throttle body|coolant flange)\b/],
  ];
  for (const [category, pattern] of rules) {
    if (pattern.test(title)) return category;
  }
  return "other";
}

function productKey(product) {
  const id = String(product.id || "");
  const parts = id.split("|");
  if (parts.length >= 2 && parts[0] === "v1" && /^\d+$/.test(parts[1])) return parts.slice(0, 3).join("|");
  const url = String(product.ebay || "");
  const match = url.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/);
  if (match) return match[1];
  return id || url || String(product.name || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function titleKey(product) {
  return String(product.name || product.description || "")
    .toLowerCase()
    .replace(/\b(for|fits|with|kit|set|vw|volkswagen|golf|jetta|mk4|gti|1999|2000|2001|2002|2003|2004|2005|2006)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
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

    let featured = [];
    if (fs.existsSync("featured-products.json")) {
      const parsed = JSON.parse(fs.readFileSync("featured-products.json", "utf8"));
      if (Array.isArray(parsed)) featured = parsed;
    }

    // Start with the old catalog, then add the hand-picked products. Preserve these
    // even when eBay search results change or the importer runs again.
    const byId = new Map();
    for (const product of [...existing, ...featured]) {
      if (!product || typeof product !== "object") continue;
      const used = product.condition === "used" || isUsed(product);
      const normalized = {
        ...product,
        condition: used ? "used" : (product.condition || "unknown"),
        category: used ? "used" : (product.featured ? product.category : categorizeProduct(product.name || product.description || "")),
      };
      const key = productKey(normalized);
      if (key) byId.set(key, normalized);
    }

    // Fresh API results update existing listings and add new ones, without losing
    // curated products or the previous catalog.
    for (const item of items) {
      const name = item.title || "MK4 Golf part";
      const used = isUsed({ name, condition: item.condition });
      const product = {
        id: item.itemId || item.itemWebUrl,
        name,
        price: item.price?.value ?? "N/A",
        image: item.image?.imageUrl || "",
        ebay: item.itemWebUrl || "",
        condition: used ? "used" : "new",
        category: used ? "used" : categorizeProduct(name),
        description: name,
        featured: false,
        source: "ebay",
      };
      const key = productKey(product);
      if (!key) continue;
      const previous = byId.get(key) || {};
      byId.set(key, { ...previous, ...product, featured: Boolean(previous.featured) });
    }

    // Collapse duplicate-looking listings while retaining the curated featured item.
    // Keep at most two listings for near-identical hose kits to improve variety.
    const deduped = new Map();
    for (const product of byId.values()) {
      const key = titleKey(product);
      const existingMatch = deduped.get(key);
      if (!existingMatch || product.featured) deduped.set(key, product);
    }

    const products = [];
    let intakeHoses = 0;
    let radiatorHoses = 0;
    for (const product of deduped.values()) {
      const title = String(product.name || "");
      if (/\b(silicone|silicon)\b.*\b(intake|induction)\b.*\b(pipe|hose|tub(e|ing))\b|\b(intake|induction)\b.*\b(pipe|hose|tub(e|ing))\b.*\b(silicone|silicon)\b/i.test(title)) {
        if (intakeHoses >= 2 && !product.featured) continue;
        intakeHoses++;
      }
      if (/\b(radiator|coolant)\b.*\b(hose|hoses|pipe|piping|tube|tubing|kit)\b|\b(hose|hoses|pipe|piping|tube|tubing|kit)\b.*\b(radiator|coolant)\b/i.test(title)) {
        if (radiatorHoses >= 3 && !product.featured) continue;
        radiatorHoses++;
      }
      products.push(product);
    }

    // Sort featured items first, then maintenance, then the other categories.
    const priority = { maintenance: 0, engine: 1, brakes: 2, suspension: 3, exterior: 4, interior: 5, other: 6, used: 7 };
    products.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
      (priority[a.category] ?? 8) - (priority[b.category] ?? 8));

    fs.writeFileSync("data.json", JSON.stringify(products, null, 2) + "\n");
    const counts = products.reduce((acc, p) => {
      acc[p.category || "other"] = (acc[p.category || "other"] || 0) + 1;
      return acc;
    }, {});
    console.log("Saved " + products.length + " products. Categories:", JSON.stringify(counts));
    console.log("New API listings received:", items.length, "| Unique catalog items:", products.length);
  } catch (err) {
    console.error(err.response?.data || err.message);
    process.exitCode = 1;
  }
}

main();
