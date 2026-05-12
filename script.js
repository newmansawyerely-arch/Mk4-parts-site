let partsData = [];

fetch("Data.json")
  .then(res => res.json())
  .then(data => {
    partsData = data;
    displayParts(partsData);
  });

function displayParts(parts) {
  const container = document.getElementById("products");
  container.innerHTML = "";

  parts.forEach(part => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${part.image}">
      <div class="card-content">
        <h2>${part.name}</h2>
        <p class="price">$${part.price}</p>

        <div>
          <a href="${part.amazon}" target="_blank" class="btn amazon">Amazon</a>
          <a href="${part.ebay}" target="_blank" class="btn ebay">eBay</a>
        </div>
      </div>
    `;

    container.appendChild(div);
  });
}

function filterParts() {
  const search = document.getElementById("search").value.toLowerCase();
  const category = document.getElementById("category").value;

  const filtered = partsData.filter(p =>
    p.name.toLowerCase().includes(search) &&
    (category === "all" || p.category === category)
  );

  displayParts(filtered);
}

document.getElementById("search").addEventListener("input", filterParts);
document.getElementById("category").addEventListener("change", filterParts);
