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
        limit: 20,
      },
    }
  );

  return response.data.itemSummaries || [];
}

async function main() {
  try {
    const token = await getToken();

    const items = await searchEbay(token);

    const products = items.map((item, index) => ({
      id: index + 1,
      name: item.title,
      price: item.price ? item.price.value : "N/A",
      image: item.image ? item.image.imageUrl : "",
      ebay: item.itemWebUrl,
      category: "mk4-parts",
      description: item.title,
    }));

    fs.writeFileSync(
      "products.json",
      JSON.stringify(products, null, 2)
    );

    console.log("products.json updated");
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

main();
