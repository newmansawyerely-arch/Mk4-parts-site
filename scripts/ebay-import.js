const fs = require("fs");
const axios = require("axios");

const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

async function getToken() {
  const response = await axios.post(
    "https://api.ebay.com/identity/v1/oauth2/token",
    "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      auth: {
        username: CLIENT_ID,
        password: CLIENT_SECRET,
      },
    }
  );

  return response.data.access_token;
}

async function searchEbay(token) {
  const response = await axios.get(
    "https://api.ebay.com/buy/browse/v1/item_summary/search",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        q: "MK4 Golf GTI parts",
        limit: 100,
      },
    }
  );

  return response.data.itemSummaries || [];
}
async function main() {
  try {
    const token = await getToken();
    const items = await searchEbay(token);

    // Read existing products
    let existing = [];

    if (fs.existsSync("data.json")) {
      existing = JSON.parse(
        fs.readFileSync("data.json", "utf8")
      );
    }

    // Convert new eBay items
    const newProducts = items.map((item) => ({
      id: item.itemId || item.itemWebUrl,,
      name: item.title,
      price: item.price ? item.price.value : "N/A",
      image: item.image ? item.image.imageUrl : "",
      ebay: item.itemWebUrl,
      category: "mk4-parts",
      description: item.title,
    }));

    // Merge old + new
    const combined = [...existing, ...newProducts];

    // Remove duplicates by eBay URL
    const unique = combined.filter(
      (product, index, self) =>
        index === self.findIndex(
          p => p.ebay === product.ebay
        )
    );

    fs.writeFileSync(
      "data.json",
      JSON.stringify(unique, null, 2)
    );

    console.log(
      `Saved ${unique.length} total products`
    );

  } catch (err) {
    console.error(
      err.response?.data || err.message
    );
  }
}

main();
