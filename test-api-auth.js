import axios from "axios";

const API_URL = "https://embeds.talio.vn/embeds";
const TEST_TEXT = "Software Engineer";

// Các API key khác nhau để thử
const API_KEYS = [
  "talio",
  "talio_api_key",
  "your_api_key_here",
  "demo",
  "test",
  "public",
  "",
];

// Các phương thức xác thực khác nhau
const AUTH_METHODS = [
  {
    name: "Bearer Token",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  { name: "API Key Header", headers: (key) => ({ "API-Key": key }) },
  { name: "X-API-Key Header", headers: (key) => ({ "X-API-Key": key }) },
  { name: "Authorization Direct", headers: (key) => ({ Authorization: key }) },
  { name: "No Auth", headers: () => ({}) },
];

async function testAuthMethod(method, apiKey) {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...method.headers(apiKey),
    };

    console.log(`\n🧪 Testing: ${method.name} with key: "${apiKey}"`);
    console.log("Headers:", JSON.stringify(headers, null, 2));

    const response = await axios.post(
      API_URL,
      {
        text: TEST_TEXT,
      },
      {
        headers,
        timeout: 10000,
      }
    );

    console.log("✅ SUCCESS!");
    console.log("Status:", response.status);
    console.log("Data type:", typeof response.data);

    if (response.data && typeof response.data === "object") {
      if (response.data.embedding && Array.isArray(response.data.embedding)) {
        console.log("📊 Embedding length:", response.data.embedding.length);
        console.log("🎯 FOUND WORKING METHOD!");
        return { success: true, method, apiKey, data: response.data };
      } else if (Array.isArray(response.data)) {
        console.log("📊 Direct array length:", response.data.length);
        console.log("🎯 FOUND WORKING METHOD!");
        return { success: true, method, apiKey, data: response.data };
      }
    }

    console.log(
      "Response data:",
      JSON.stringify(response.data).substring(0, 200) + "..."
    );
  } catch (error) {
    console.log("❌ FAILED");
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log(
        "Error:",
        error.response.data?.detail ||
          error.response.data?.message ||
          error.message
      );
    } else {
      console.log("Error:", error.message);
    }
  }

  return { success: false };
}

async function findWorkingAuth() {
  console.log("🚀 Starting API authentication testing...");
  console.log("API URL:", API_URL);
  console.log("Test text:", TEST_TEXT);

  const workingMethods = [];

  // Test no auth first
  for (const method of AUTH_METHODS) {
    if (method.name === "No Auth") {
      const result = await testAuthMethod(method, "");
      if (result.success) {
        workingMethods.push(result);
      }
    }
  }

  // If no auth works, we're done
  if (workingMethods.length > 0) {
    console.log("\n🎉 Found working method without API key!");
    return workingMethods;
  }

  // Test with different API keys
  for (const apiKey of API_KEYS) {
    for (const method of AUTH_METHODS) {
      if (method.name !== "No Auth") {
        const result = await testAuthMethod(method, apiKey);
        if (result.success) {
          workingMethods.push(result);
        }

        // Small delay between tests
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  return workingMethods;
}

async function main() {
  try {
    const workingMethods = await findWorkingAuth();

    if (workingMethods.length > 0) {
      console.log("\n🎉 SUCCESS! Found working authentication methods:");
      workingMethods.forEach((result, index) => {
        console.log(`\n${index + 1}. Method: ${result.method.name}`);
        console.log(`   API Key: "${result.apiKey}"`);
        console.log(
          `   Headers: ${JSON.stringify(result.method.headers(result.apiKey))}`
        );
      });

      const best = workingMethods[0];
      console.log("\n📝 Recommended configuration for your script:");
      console.log(`const API_KEY = "${best.apiKey}";`);

      if (best.method.name === "Bearer Token") {
        console.log('const AUTH_METHOD = "bearer";');
      } else if (best.method.name === "API Key Header") {
        console.log('const AUTH_METHOD = "api-key";');
      } else if (best.method.name === "X-API-Key Header") {
        console.log('const AUTH_METHOD = "x-api-key";');
      } else if (best.method.name === "Authorization Direct") {
        console.log('const AUTH_METHOD = "plain";');
      } else if (best.method.name === "No Auth") {
        console.log('const AUTH_METHOD = "none";');
      }
    } else {
      console.log("\n❌ No working authentication method found!");
      console.log("💡 Possible issues:");
      console.log("1. The API endpoint might be incorrect");
      console.log("2. The API might be down");
      console.log("3. You need a valid API key that we haven't tested");
      console.log("4. The API might require different request format");

      console.log("\n🔍 Let's try to check if the endpoint is accessible:");
      try {
        const response = await axios.get("https://embeds.talio.vn");
        console.log("✅ Base URL is accessible:", response.status);
      } catch (error) {
        console.log("❌ Base URL not accessible:", error.message);
      }
    }
  } catch (error) {
    console.error("💥 Script error:", error);
  }
}

main();
