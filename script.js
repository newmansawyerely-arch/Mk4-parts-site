let partsData = [];

fetch("./data.json")
  .then(res => {
    if (!res.ok) {
      throw new Error("Could not load data.json");
    }
    return res.json();
  })
  .then(data => {
    console.log("JSON loaded:", data);

    partsData = data;
    displayParts(partsData);
  })
  .catch(error => {
    console.error("Fetch error:", error);

    document.getElementById("products").innerHTML = `
      <p style="color:white;padding:20px;">
        Error loading products.
      </p>
    `;
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
          <div>
  ${part.amazon ? `
    <a href="${part.amazon}" target="_blank" class="btn amazon">Amazon</a>
  ` : ""}

  ${part.ebay ? `
    <a href="${part.ebay}" target="_blank" class="btn ebay">eBay</a>
  ` : ""}
</div>
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
