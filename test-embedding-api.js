import axios from "axios";

const EMBEDDING_API_URL = "https://embeds.talio.vn/embeds";
const API_KEY = "talio";

async function testEmbeddingAPI() {
  try {
    console.log("🧪 Testing embedding API...");
    console.log(`URL: ${EMBEDDING_API_URL}`);
    console.log(`API Key: ${API_KEY}`);

    const testText = "Software Engineer at Ho Chi Minh City";
    console.log(`Test text: "${testText}"`);

    const response = await axios.post(
      EMBEDDING_API_URL,
      {
        text: testText,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        timeout: 10000,
      }
    );

    console.log("\n✅ API Response:");
    console.log("Status:", response.status);
    console.log("Headers:", response.headers);
    console.log("Data type:", typeof response.data);
    console.log(
      "Data length:",
      Array.isArray(response.data) ? response.data.length : "Not an array"
    );
    console.log(
      "Sample data:",
      JSON.stringify(response.data).substring(0, 200) + "..."
    );

    return response.data;
  } catch (error) {
    console.error("❌ API Test failed:");
    console.error("Status:", error.response?.status);
    console.error("Status Text:", error.response?.statusText);
    console.error("Response:", error.response?.data);
    console.error("Message:", error.message);

    if (error.code === "ECONNREFUSED") {
      console.error("💡 The API server might be down or the URL is incorrect");
    } else if (error.response?.status === 401) {
      console.error("💡 Authentication failed - check your API key");
    } else if (error.response?.status === 404) {
      console.error("💡 API endpoint not found - check the URL");
    }

    return null;
  }
}

testEmbeddingAPI();
