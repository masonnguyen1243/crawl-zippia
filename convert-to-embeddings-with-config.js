import fs from "fs";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
const CONFIG_FILE = "./embedding-config.json";
let config;

try {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.log("❌ Config file not found!");
    console.log("Run: node create-config.js to create one");
    process.exit(1);
  }

  config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  console.log("✅ Loaded configuration from", CONFIG_FILE);
} catch (error) {
  console.error("❌ Failed to load config:", error.message);
  process.exit(1);
}

/**
 * Get appropriate headers based on auth method
 */
function getAuthHeaders() {
  const baseHeaders = {
    "Content-Type": "application/json",
  };

  switch (config.api.authMethod.toLowerCase()) {
    case "bearer":
      return { ...baseHeaders, Authorization: `Bearer ${config.api.key}` };
    case "api-key":
      return { ...baseHeaders, "API-Key": config.api.key };
    case "x-api-key":
      return { ...baseHeaders, "X-API-Key": config.api.key };
    case "plain":
      return { ...baseHeaders, Authorization: config.api.key };
    case "body":
      return baseHeaders; // API key will be in body
    default:
      return { ...baseHeaders, Authorization: `Bearer ${config.api.key}` };
  }
}

/**
 * Get request body with or without API key
 */
function getRequestBody(text) {
  const baseBody = { text: text.trim() };

  if (config.api.authMethod.toLowerCase() === "body") {
    return { ...baseBody, apikey: config.api.key };
  }

  return baseBody;
}

/**
 * Get embedding vector from API
 */
async function getEmbedding(text) {
  if (!text || text.trim() === "") {
    return null;
  }

  try {
    const response = await axios.post(config.api.url, getRequestBody(text), {
      headers: getAuthHeaders(),
      timeout: config.rateLimiting.requestTimeout,
    });

    // API returns { embedding: [vector] }
    return response.data.embedding || response.data;
  } catch (error) {
    console.error(
      `Error getting embedding for text: "${text.substring(0, 50)}..."`
    );

    if (error.response?.status === 401) {
      console.error("❌ Authentication failed - API key might be incorrect");
      console.error("💡 Current auth method:", config.api.authMethod);
      console.error("💡 Update api.key in", CONFIG_FILE);
    }

    console.error(`Error details:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Test API connection before starting the main process
 */
async function validateAPI() {
  console.log("🔍 Validating API connection...");
  console.log(`URL: ${config.api.url}`);
  console.log(`Auth method: ${config.api.authMethod}`);

  const testText = "Software Engineer";
  const embedding = await getEmbedding(testText);

  if (embedding) {
    console.log("✅ API connection successful!");
    console.log(
      `✅ Embedding vector length: ${
        Array.isArray(embedding) ? embedding.length : "Not an array"
      }`
    );
    console.log(
      `✅ Sample values: [${
        Array.isArray(embedding) ? embedding.slice(0, 3).join(", ") : "N/A"
      }...]`
    );
    return true;
  } else {
    console.log("❌ API connection failed!");
    console.log("💡 Please check your configuration in", CONFIG_FILE);
    return false;
  }
}

/**
 * Process a single job to add embeddings
 */
async function processJob(job, jobIndex, companyIndex, totalJobs) {
  console.log(
    `Processing job ${jobIndex + 1}/${totalJobs} from company ${
      companyIndex + 1
    }...`
  );

  const updates = {};

  // Process each field that needs embedding
  for (const field of config.fields) {
    const sourceText = job[field.source];
    if (sourceText && sourceText.trim() !== "") {
      console.log(`  Getting embedding for ${field.source}...`);
      const embedding = await getEmbedding(sourceText);
      if (embedding) {
        updates[field.target] = embedding;
        console.log(
          `  ✓ Successfully embedded ${field.source} -> ${field.target}`
        );
      } else {
        console.log(`  ✗ Failed to embed ${field.source}`);
        updates[field.target] = null;
      }

      // Add small delay between fields to avoid rate limiting
      await sleep(config.rateLimiting.delayBetweenFields);
    } else {
      console.log(`  - Skipping ${field.source} (empty or null)`);
      updates[field.target] = null;
    }
  }

  // Return job with new embedding fields
  return { ...job, ...updates };
}

/**
 * Sleep function for delays
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process jobs in batches to manage API rate limits
 */
async function processJobsBatch(jobs, companyIndex) {
  const results = [];

  for (let i = 0; i < jobs.length; i += config.rateLimiting.batchSize) {
    const batch = jobs.slice(i, i + config.rateLimiting.batchSize);
    console.log(
      `\nProcessing batch ${
        Math.floor(i / config.rateLimiting.batchSize) + 1
      }/${Math.ceil(jobs.length / config.rateLimiting.batchSize)} for company ${
        companyIndex + 1
      }`
    );

    // Process batch concurrently
    const batchPromises = batch.map((job, batchIndex) =>
      processJob(job, i + batchIndex, companyIndex, jobs.length)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Delay between batches to avoid rate limiting
    if (i + config.rateLimiting.batchSize < jobs.length) {
      console.log(
        `Waiting ${config.rateLimiting.delayBetweenBatches}ms before next batch...`
      );
      await sleep(config.rateLimiting.delayBetweenBatches);
    }
  }

  return results;
}

/**
 * Main function to process the entire dataset
 */
async function main() {
  try {
    console.log("🚀 Starting embedding conversion process...\n");

    // Validate API first
    const isAPIValid = await validateAPI();
    if (!isAPIValid) {
      console.log("\n❌ Stopping process due to API validation failure");
      console.log("📝 Update your configuration in", CONFIG_FILE);
      return;
    }

    // Read input file
    console.log(`\n📂 Reading input file: ${config.files.input}`);
    if (!fs.existsSync(config.files.input)) {
      throw new Error(`Input file not found: ${config.files.input}`);
    }

    const rawData = fs.readFileSync(config.files.input, "utf8");
    const companies = JSON.parse(rawData);
    console.log(`✅ Loaded ${companies.length} companies`);

    // Calculate total jobs for progress tracking
    const totalJobs = companies.reduce(
      (sum, company) => sum + (company.jobs?.length || 0),
      0
    );
    console.log(`📊 Total jobs to process: ${totalJobs}`);

    if (totalJobs === 0) {
      console.log("⚠️  No jobs found to process");
      return;
    }

    // Process each company
    const processedCompanies = [];

    for (
      let companyIndex = 0;
      companyIndex < companies.length;
      companyIndex++
    ) {
      const company = companies[companyIndex];
      console.log(
        `\n🏢 Processing company ${companyIndex + 1}/${companies.length}: ${
          company.companyName
        }`
      );

      if (!company.jobs || company.jobs.length === 0) {
        console.log("  No jobs found for this company");
        processedCompanies.push(company);
        continue;
      }

      console.log(`  Found ${company.jobs.length} jobs`);

      // Process all jobs for this company
      const processedJobs = await processJobsBatch(company.jobs, companyIndex);

      // Add processed company to results
      processedCompanies.push({
        ...company,
        jobs: processedJobs,
      });

      console.log(
        `✅ Completed company ${companyIndex + 1}/${companies.length}`
      );
    }

    // Save results
    console.log(`\n💾 Saving results to: ${config.files.output}`);

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(config.files.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save with pretty formatting
    fs.writeFileSync(
      config.files.output,
      JSON.stringify(processedCompanies, null, 2),
      "utf8"
    );

    console.log("✅ Conversion completed successfully!");
    console.log(`📄 Output saved to: ${config.files.output}`);

    // Generate summary
    let successCount = 0;
    let failCount = 0;

    processedCompanies.forEach((company) => {
      if (company.jobs) {
        company.jobs.forEach((job) => {
          config.fields.forEach((field) => {
            if (job[field.target] !== null) {
              successCount++;
            } else if (job[field.source] && job[field.source].trim() !== "") {
              failCount++;
            }
          });
        });
      }
    });

    console.log("\n📈 Summary:");
    console.log(`  ✅ Successful embeddings: ${successCount}`);
    console.log(`  ❌ Failed embeddings: ${failCount}`);
    console.log(
      `  📊 Success rate: ${(
        (successCount / (successCount + failCount)) *
        100
      ).toFixed(2)}%`
    );
  } catch (error) {
    console.error("❌ Error during conversion:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⚠️  Process interrupted. Partial results may be available.");
  process.exit(0);
});

// Run the script
main();
