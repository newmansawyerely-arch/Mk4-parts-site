let partsData = [];

const categoryLabels = {
  engine: "Engine", suspension: "Suspension", brakes: "Brakes",
  exterior: "Exterior", interior: "Interior", other: "Other Parts"
};

fetch("./data.json?updated=" + Date.now(), { cache: "no-store" })
  .then(res => {
    if (!res.ok) throw new Error("Could not load data.json");
    return res.json();
  })
  .then(data => {
    partsData = Array.isArray(data) ? data : [];
    displayParts(partsData);
  })
  .catch(error => {
    console.error("Fetch error:", error);
    document.getElementById("results-count").textContent = "CATALOG UNAVAILABLE";
    document.getElementById("products").innerHTML =
      '<div class="empty-state"><strong>Could not load the parts</strong>Please refresh the page in a moment.</div>';
  });

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function displayParts(parts) {
  const container = document.getElementById("products");
  const count = document.getElementById("results-count");
  count.textContent = parts.length + (parts.length === 1 ? " PART FOUND" : " PARTS FOUND");
  container.innerHTML = "";

  if (!parts.length) {
    container.innerHTML = '<div class="empty-state"><strong>No parts found.</strong>Try a different search or choose another category.</div>';
    return;
  }

  parts.forEach(part => {
    const name = escapeHTML(part.name || "MK4 Golf part");
    const category = escapeHTML(categoryLabels[part.category] || "MK4 Part");
    const priceValue = part.price !== undefined && part.price !== null && part.price !== "" ? String(part.price) : "Check listing";
    const price = priceValue === "N/A" ? "Check listing" :
      (/^\d+(\.\d{1,2})?$/.test(priceValue) ? "$" + priceValue : escapeHTML(priceValue));
    const image = String(part.image || "").trim();
    const ebay = String(part.ebay || "").trim();
    const amazon = String(part.amazon || "").trim();

    const div = document.createElement("article");
    div.className = "card";
    const imageMarkup = image
      ? '<img src="' + escapeHTML(image) + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<div class=&quot;image-placeholder&quot;>MK4 PART</div>\'">'
      : '<div class="image-placeholder">MK4 PART</div>';
    const amazonButton = /^https?:\/\//i.test(amazon)
      ? '<a href="' + escapeHTML(amazon) + '" target="_blank" rel="noopener noreferrer" class="btn amazon">AMAZON ↗</a>' : "";
    const ebayButton = /^https?:\/\//i.test(ebay)
      ? '<a href="' + escapeHTML(ebay) + '" target="_blank" rel="noopener noreferrer" class="btn ebay">VIEW ON EBAY ↗</a>' : "";

    div.innerHTML = '<div class="card-image">' + imageMarkup + '</div>' +
      '<div class="card-content"><div class="card-category">' + category + '</div>' +
      '<h3>' + name + '</h3><p class="price">' + price + '</p>' +
      '<div class="card-actions">' + amazonButton + ebayButton + '</div></div>';
    container.appendChild(div);
  });
}

function filterParts() {
  const search = document.getElementById("search").value.trim().toLowerCase();
  const category = document.getElementById("category").value;
  const filtered = partsData.filter(part =>
    String(part.name || "").toLowerCase().includes(search) &&
    (category === "all" || part.category === category)
  );
  displayParts(filtered);
}

document.getElementById("search").addEventListener("input", filterParts);
document.getElementById("category").addEventListener("change", filterParts);