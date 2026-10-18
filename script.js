let partsData = [];

const categoryLabels = {
  engine: "Engine & Turbo", used: "Used Parts", suspension: "Suspension", brakes: "Brakes",
  exterior: "Exterior", interior: "Interior", maintenance: "Maintenance", other: "Other Parts"
};

const controls = {
  search: document.getElementById("search"),
  category: document.getElementById("category"),
  price: document.getElementById("price-filter"),
  type: document.getElementById("type-filter"),
  vehicle: document.getElementById("vehicle-filter")
};

fetch("./data.json?updated=" + Date.now(), { cache: "no-store" })
  .then(res => { if (!res.ok) throw new Error("Could not load data.json"); return res.json(); })
  .then(data => { partsData = Array.isArray(data) ? data : []; filterParts(); })
  .catch(error => {
    console.error("Fetch error:", error);
    document.getElementById("results-count").textContent = "CATALOG UNAVAILABLE";
    document.getElementById("products").innerHTML = '<div class="empty-state"><strong>Could not load the parts</strong>Please refresh the page in a moment.</div>';
  });

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function searchableText(part) {
  return [part.name, part.description, part.category].join(" ").toLowerCase();
}
function priceNumber(part) {
  const n = Number(String(part.price ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && String(part.price ?? "").trim() !== "" ? n : null;
}
function matchesVehicle(part, key) {
  if (key === "all") return true;
  const text = searchableText(part);
  const patterns = {
    golf: /\bgolf\b/, gti: /\bgti\b/, jetta: /\bjetta\b/,
    "18t": /\b1[.]?8\s*t\b|1\.8t/i, "20l": /\b2[.]?0\s*l\b|2\.0l/i,
    vr6: /\bvr6\b|\br32\b|\b3[.]?2\s*l\b/
  };
  return patterns[key] ? patterns[key].test(text) : false;
}
function matchesType(part, type) {
  if (type === "all") return true;
  const text = searchableText(part);
  if (type === "oem") return /\boem\b|genuine volkswagen|genuine vw|original equipment/i.test(text);
  if (type === "performance") return /performance|upgrade|racing|sport|coilover|turbo|intercooler|downpipe|intake kit/i.test(text);
  if (type === "replacement") return /replacement|repair|fits|fitment|oem style|standard|direct fit/i.test(text) &&
    !/performance|upgrade|racing/i.test(text);
  return true;
}
function formatPrice(part) {
  const raw = String(part.price ?? "").trim();
  const n = priceNumber(part);
  return n === null ? "Check listing" : "$" + n.toFixed(2);
}
function displayParts(parts) {
  const container = document.getElementById("products");
  document.getElementById("results-count").textContent = parts.length + (parts.length === 1 ? " PART FOUND" : " PARTS FOUND");
  container.innerHTML = "";
  if (!parts.length) {
    container.innerHTML = '<div class="empty-state"><strong>No parts match those filters.</strong>Try widening your search or clearing the filters.</div>';
    return;
  }
  parts.forEach(part => {
    const name = escapeHTML(part.name || "MK4 Golf part");
    const category = escapeHTML(categoryLabels[part.category] || "MK4 Part");
    const price = escapeHTML(formatPrice(part));
    const image = String(part.image || "").trim();
    const ebay = String(part.ebay || "").trim();
    const amazon = String(part.amazon || "").trim();
    const text = searchableText(part);
    const tags = [];
    if (part.condition === "used" || /\b(used|pre-owned|salvage|for parts or not working)\b/i.test(String(part.name || ""))) tags.push("USED");
    if (/\boem\b|genuine volkswagen|genuine vw|original equipment/i.test(text)) tags.push("OEM CLAIM IN LISTING");
    if (/performance|upgrade|racing|sport|coilover|turbo|intercooler|downpipe/i.test(text)) tags.push("PERFORMANCE");
    const fitment = [];
    if (/\bgolf\b/i.test(text)) fitment.push("Golf");
    if (/\bgti\b/i.test(text)) fitment.push("GTI");
    if (/\bjetta\b/i.test(text)) fitment.push("Jetta");
    if (/\b1[.]?8\s*t\b|1\.8t/i.test(text)) fitment.push("1.8T");
    if (/\b2[.]?0\s*l\b|2\.0l/i.test(text)) fitment.push("2.0L");
    if (/\bvr6\b|\br32\b/i.test(text)) fitment.push("VR6/R32");
    const imageMarkup = image
      ? '<img src="' + escapeHTML(image) + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<div class=&quot;image-placeholder&quot;>MK4 PART</div>\'">'
      : '<div class="image-placeholder">MK4 PART</div>';
    const amazonButton = /^https?:\/\//i.test(amazon) ? '<a href="' + escapeHTML(amazon) + '" target="_blank" rel="noopener noreferrer sponsored" class="btn amazon">AMAZON ↗</a>' : "";
    const ebayButton = /^https?:\/\//i.test(ebay) ? '<a href="' + escapeHTML(ebay) + '" target="_blank" rel="noopener noreferrer sponsored" class="btn ebay">VIEW ON EBAY ↗</a>' : "";
    const div = document.createElement("article");
    div.className = "card";
    div.innerHTML = '<div class="card-image">' + imageMarkup + '</div><div class="card-content">' +
      '<div class="card-category">' + category + '</div><h3>' + name + '</h3>' +
      (fitment.length ? '<p class="fitment-label">MENTIONS: ' + escapeHTML(fitment.join(" · ")) + '</p>' : '') +
      (tags.length ? '<div class="product-tags">' + tags.map(tag => '<span>' + escapeHTML(tag) + '</span>').join("") + '</div>' : '') +
      '<p class="price">' + price + '</p><div class="card-actions">' + amazonButton + ebayButton + '</div></div>';
    container.appendChild(div);
  });
}
function filterParts() {
  const search = controls.search.value.trim().toLowerCase();
  const category = controls.category.value;
  const priceRange = controls.price.value;
  const type = controls.type.value;
  const vehicle = controls.vehicle.value;
  const filtered = partsData.filter(part => {
    const text = searchableText(part);
    const p = priceNumber(part);
    const searchMatch = !search || text.includes(search);
    const isUsed = part.condition === "used" || /\b(used|pre-owned|salvage|for parts or not working)\b/i.test(String(part.name || ""));
    const categoryMatch = category === "used" ? isUsed : category === "all" ? !isUsed : part.category === category && !isUsed;
    const priceMatch = priceRange === "all" ||
      (p !== null && (priceRange === "0-25" ? p < 25 :
        priceRange === "25-50" ? p >= 25 && p <= 50 :
        priceRange === "50-100" ? p > 50 && p <= 100 : p > 100));
    return searchMatch && categoryMatch && priceMatch && matchesType(part, type) && matchesVehicle(part, vehicle);
  });
  displayParts(filtered);
}
Object.values(controls).forEach(control => {
  control.addEventListener(control.tagName === "INPUT" ? "input" : "change", filterParts);
});
const externalSearch = document.getElementById("search-ebay");
externalSearch.addEventListener("click", () => {
  const query = controls.search.value.trim() || "Volkswagen Mk4 Golf GTI parts";
  window.open("https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(query), "_blank", "noopener,noreferrer");
});
document.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => {
  controls.category.value = button.dataset.category;
  document.getElementById("parts").scrollIntoView({behavior:"smooth"});
  filterParts();
}));
document.querySelectorAll("[data-guide]").forEach(button => button.addEventListener("click", () => {
  controls.category.value = button.dataset.guide;
  controls.search.value = "";
  controls.price.value = "all"; controls.type.value = "all"; controls.vehicle.value = "all";
  document.getElementById("parts").scrollIntoView({behavior:"smooth"});
  filterParts();
}));
document.getElementById("clear-filters").addEventListener("click", () => {
  controls.search.value = ""; controls.category.value = "all"; controls.price.value = "all";
  controls.type.value = "all"; controls.vehicle.value = "all"; filterParts();
});
const backToTop = document.getElementById("back-to-top");
window.addEventListener("scroll", () => backToTop.classList.toggle("visible", window.scrollY > 500));
backToTop.addEventListener("click", () => window.scrollTo({top:0,behavior:"smooth"}));
