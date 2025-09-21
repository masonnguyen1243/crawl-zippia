import axios from "axios";

const EMBEDDING_API_URL = "https://embeds.talio.vn/embeds";
const API_KEY = "talio";

async function testEmbeddingAPIWithDifferentAuth() {
  const testText = "Software Engineer at Ho Chi Minh City";

  // Test different authentication methods
  const authMethods = [
    { name: "Bearer token", headers: { Authorization: `Bearer ${API_KEY}` } },
    { name: "API-Key header", headers: { "API-Key": API_KEY } },
    { name: "X-API-Key header", headers: { "X-API-Key": API_KEY } },
    { name: "apikey header", headers: { apikey: API_KEY } },
    {
      name: "key in body",
      headers: {},
      body: { text: testText, apikey: API_KEY },
    },
    {
      name: "key in body as key",
      headers: {},
      body: { text: testText, key: API_KEY },
    },
    { name: "Authorization plain", headers: { Authorization: API_KEY } },
  ];

  for (const method of authMethods) {
    try {
      console.log(`\n🧪 Testing: ${method.name}`);

      const requestBody = method.body || { text: testText };
      const requestHeaders = {
        "Content-Type": "application/json",
        ...method.headers,
      };

      console.log("Headers:", requestHeaders);
      console.log("Body:", requestBody);

      const response = await axios.post(EMBEDDING_API_URL, requestBody, {
        headers: requestHeaders,
        timeout: 10000,
      });

      console.log("✅ SUCCESS!");
      console.log("Status:", response.status);
      console.log("Data type:", typeof response.data);
      console.log(
        "Data sample:",
        JSON.stringify(response.data).substring(0, 100) + "..."
      );

      return { method: method.name, response: response.data };
    } catch (error) {
      console.log("❌ FAILED");
      console.log("Status:", error.response?.status);
      console.log("Error:", error.response?.data?.detail || error.message);
    }
  }

  console.log("\n🤔 All authentication methods failed. Possible issues:");
  console.log('1. API key "talio" might be incorrect');
  console.log("2. API endpoint might require different authentication");
  console.log("3. API might be down or changed");
  console.log("4. Rate limiting or IP restrictions");

  return null;
}

// Also test if the endpoint exists without auth
async function testEndpointExistence() {
  try {
    console.log("\n🔍 Testing if endpoint exists (without auth)...");
    await axios.post(EMBEDDING_API_URL, { text: "test" }, { timeout: 5000 });
  } catch (error) {
    if (error.response?.status === 401) {
      console.log("✅ Endpoint exists (got 401 Unauthorized)");
    } else if (error.response?.status === 422) {
      console.log("✅ Endpoint exists (got 422 Validation Error)");
    } else if (error.response?.status === 404) {
      console.log("❌ Endpoint not found (404)");
    } else {
      console.log("Status:", error.response?.status);
      console.log("Error:", error.response?.data);
    }
  }
}

async function main() {
  await testEndpointExistence();
  await testEmbeddingAPIWithDifferentAuth();
}

main();
