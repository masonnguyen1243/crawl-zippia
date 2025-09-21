import fs from "fs";

// Script để tạo config file cho embedding conversion

const CONFIG_TEMPLATE = {
  // API Configuration
  api: {
    url: "https://embeds.talio.vn/embeds",
    key: "YOUR_API_KEY_HERE", // ⚠️ Cập nhật API key thật tại đây
    authMethod: "bearer", // Options: 'bearer', 'api-key', 'x-api-key', 'body', 'plain'
  },

  // File paths
  files: {
    input: "./emb/summarized_companies.json",
    output: "./emb/summarized_companies_with_embeddings.json",
  },

  // Fields to convert to embeddings
  fields: [
    { source: "titleSum", target: "titleEmbed" },
    { source: "locationSum", target: "locationEmbed" },
    { source: "skillsSum", target: "skillsEmbed" },
    { source: "requirementsSum", target: "requirementsEmbed" },
  ],

  // Rate limiting to avoid API overload
  rateLimiting: {
    batchSize: 10, // Number of concurrent requests
    delayBetweenBatches: 1000, // Milliseconds
    delayBetweenFields: 200, // Milliseconds
    requestTimeout: 30000, // Milliseconds
  },
};

function createConfigFile() {
  const configPath = "./embedding-config.json";

  try {
    if (fs.existsSync(configPath)) {
      console.log("⚠️ Config file already exists:", configPath);
      console.log("Delete it first if you want to recreate");
      return;
    }

    fs.writeFileSync(
      configPath,
      JSON.stringify(CONFIG_TEMPLATE, null, 2),
      "utf8"
    );

    console.log("✅ Created config file:", configPath);
    console.log("\n📝 Next steps:");
    console.log("1. Open embedding-config.json");
    console.log("2. Update api.key with your real API key");
    console.log("3. Update api.authMethod if needed");
    console.log("4. Run: node convert-to-embeddings-with-config.js");
  } catch (error) {
    console.error("❌ Failed to create config file:", error.message);
  }
}

createConfigFile();
