import fs from "fs";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - CẬP NHẬT CÁC GIÁ TRỊ NÀY THEO API THỰC TẾ
const EMBEDDING_API_URL = "https://embeds.talio.vn/embeds";
const API_KEY = "talio"; // ⚠️ CẬP NHẬT API KEY ĐÚNG TẠI ĐÂY
const AUTH_METHOD = "bearer"; // Options: 'bearer', 'api-key', 'x-api-key', 'body', 'plain'
const INPUT_FILE = "./emb/summarized_companies.json";
const OUTPUT_FILE = "./emb/summarized_companies_with_embeddings.json";

// Fields to convert to embeddings
const FIELDS_TO_EMBED = [
  { source: "titleSum", target: "titleEmbed" },
  { source: "locationSum", target: "locationEmbed" },
  { source: "skillsSum", target: "skillsEmbed" },
  { source: "requirementsSum", target: "requirementsEmbed" },
];

// Rate limiting configuration
const BATCH_SIZE = 10; // Number of concurrent requests
const DELAY_BETWEEN_BATCHES = 1000; // Delay in milliseconds

/**
 * Get appropriate headers based on auth method
 */
function getAuthHeaders() {
  const baseHeaders = {
    "Content-Type": "application/json",
  };

  switch (AUTH_METHOD.toLowerCase()) {
    case "bearer":
      return { ...baseHeaders, Authorization: `Bearer ${API_KEY}` };
    case "api-key":
      return { ...baseHeaders, "API-Key": API_KEY };
    case "x-api-key":
      return { ...baseHeaders, "X-API-Key": API_KEY };
    case "plain":
      return { ...baseHeaders, Authorization: API_KEY };
    case "body":
      return baseHeaders; // API key will be in body
    default:
      return { ...baseHeaders, Authorization: `Bearer ${API_KEY}` };
  }
}

/**
 * Get request body with or without API key
 */
function getRequestBody(text) {
  const baseBody = { text: text.trim() };

  if (AUTH_METHOD.toLowerCase() === "body") {
    return { ...baseBody, apikey: API_KEY };
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
    const response = await axios.post(EMBEDDING_API_URL, getRequestBody(text), {
      headers: getAuthHeaders(),
      timeout: 30000, // 30 second timeout
    });

    // API returns { embedding: [vector] }
    return response.data.embedding || response.data;
  } catch (error) {
    console.error(
      `Error getting embedding for text: "${text.substring(0, 50)}..."`
    );

    if (error.response?.status === 401) {
      console.error("❌ Authentication failed - API key might be incorrect");
      console.error("💡 Current auth method:", AUTH_METHOD);
      console.error("💡 Try updating API_KEY and AUTH_METHOD in the script");
    }

    console.error(`Error details:`, error.response?.data || error.message);
    return null;
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
  for (const field of FIELDS_TO_EMBED) {
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
      await sleep(200);
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

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    console.log(
      `\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
        jobs.length / BATCH_SIZE
      )} for company ${companyIndex + 1}`
    );

    // Process batch concurrently
    const batchPromises = batch.map((job, batchIndex) =>
      processJob(job, i + batchIndex, companyIndex, jobs.length)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < jobs.length) {
      console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  return results;
}

/**
 * Test API connection before starting the main process
 */
async function validateAPI() {
  console.log("🔍 Validating API connection...");
  console.log(`URL: ${EMBEDDING_API_URL}`);
  console.log(`Auth method: ${AUTH_METHOD}`);

  const testText = "Software Engineer";
  const embedding = await getEmbedding(testText);

  if (embedding) {
    console.log("✅ API connection successful!");
    console.log(
      `✅ Embedding vector length: ${
        Array.isArray(embedding) ? embedding.length : "Not an array"
      }`
    );
    return true;
  } else {
    console.log("❌ API connection failed!");
    console.log("💡 Please check:");
    console.log("  1. API_KEY is correct");
    console.log("  2. AUTH_METHOD is appropriate");
    console.log("  3. Internet connection is working");
    console.log("  4. API endpoint is accessible");
    return false;
  }
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
      console.log("📝 To fix this:");
      console.log("  1. Update API_KEY in the script");
      console.log("  2. Change AUTH_METHOD if needed");
      console.log("  3. Run test-auth-methods.js to find the correct method");
      return;
    }

    // Read input file
    console.log(`📂 Reading input file: ${INPUT_FILE}`);
    if (!fs.existsSync(INPUT_FILE)) {
      throw new Error(`Input file not found: ${INPUT_FILE}`);
    }

    const rawData = fs.readFileSync(INPUT_FILE, "utf8");
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
    console.log(`\n💾 Saving results to: ${OUTPUT_FILE}`);

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save with pretty formatting
    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(processedCompanies, null, 2),
      "utf8"
    );

    console.log("✅ Conversion completed successfully!");
    console.log(`📄 Output saved to: ${OUTPUT_FILE}`);

    // Generate summary
    let successCount = 0;
    let failCount = 0;

    processedCompanies.forEach((company) => {
      if (company.jobs) {
        company.jobs.forEach((job) => {
          FIELDS_TO_EMBED.forEach((field) => {
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
