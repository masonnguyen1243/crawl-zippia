import axios from "axios";

const API_URL = "https://embeds.talio.vn/embeds";
const TEST_TEXT = "Software Engineer";

// Các phương thức xác thực khác nhau để thử
const AUTH_METHODS = [
  {
    name: "No Auth",
    headers: { "Content-Type": "application/json" },
    body: { text: TEST_TEXT },
  },
  {
    name: "Bearer Token",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer talio",
    },
    body: { text: TEST_TEXT },
  },
  {
    name: "API Key in Header",
    headers: {
      "Content-Type": "application/json",
      "API-Key": "talio",
    },
    body: { text: TEST_TEXT },
  },
  {
    name: "X-API-Key in Header",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "talio",
    },
    body: { text: TEST_TEXT },
  },
  {
    name: "API Key in Body",
    headers: { "Content-Type": "application/json" },
    body: { text: TEST_TEXT, apikey: "talio" },
  },
  {
    name: "API Key in Body (key field)",
    headers: { "Content-Type": "application/json" },
    body: { text: TEST_TEXT, key: "talio" },
  },
  {
    name: "Plain Authorization",
    headers: {
      "Content-Type": "application/json",
      Authorization: "talio",
    },
    body: { text: TEST_TEXT },
  },
];

async function testAuthMethod(method) {
  console.log(`\n🔍 Testing: ${method.name}`);
  console.log(`Headers:`, JSON.stringify(method.headers, null, 2));
  console.log(`Body:`, JSON.stringify(method.body, null, 2));

  try {
    const response = await axios.post(API_URL, method.body, {
      headers: method.headers,
      timeout: 10000,
    });

    console.log(`✅ SUCCESS! Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));

    if (
      response.data &&
      (response.data.embedding || Array.isArray(response.data))
    ) {
      const embedding = response.data.embedding || response.data;
      console.log(
        `📊 Embedding length: ${
          Array.isArray(embedding) ? embedding.length : "Not an array"
        }`
      );
      return { method: method.name, success: true, data: response.data };
    }
  } catch (error) {
    console.log(`❌ FAILED! Status: ${error.response?.status || "N/A"}`);
    console.log(`Error:`, error.response?.data || error.message);
    return {
      method: method.name,
      success: false,
      error: error.response?.data || error.message,
    };
  }

  return { method: method.name, success: false };
}

async function main() {
  console.log(
    "🚀 Testing different authentication methods for Talio Embedding API...\n"
  );
  console.log(`API URL: ${API_URL}`);
  console.log(`Test text: "${TEST_TEXT}"`);

  const results = [];

  for (const method of AUTH_METHODS) {
    const result = await testAuthMethod(method);
    results.push(result);

    // Add delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n" + "=".repeat(50));
  console.log("📈 SUMMARY RESULTS:");
  console.log("=".repeat(50));

  const successMethods = results.filter((r) => r.success);
  const failedMethods = results.filter((r) => !r.success);

  if (successMethods.length > 0) {
    console.log(`\n✅ WORKING METHODS (${successMethods.length}):`);
    successMethods.forEach((r) => {
      console.log(`  ✓ ${r.method}`);
    });

    console.log(`\n💡 RECOMMENDED: Use "${successMethods[0].method}" method`);
  } else {
    console.log(`\n❌ NO WORKING METHODS FOUND`);
  }

  if (failedMethods.length > 0) {
    console.log(`\n❌ FAILED METHODS (${failedMethods.length}):`);
    failedMethods.forEach((r) => {
      console.log(`  ✗ ${r.method}`);
    });
  }
}

main().catch(console.error);
