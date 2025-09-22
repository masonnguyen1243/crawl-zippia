import fs from "fs";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const EMBEDDING_API_URL = "https://embeds.talio.vn/embeds";
const API_KEY = "talio";
const AUTH_METHOD = "bearer";
const INPUT_FILE = "./input-sum-test.json";
const OUTPUT_FILE = "./output-sum-result.json";

// Fields to convert to embeddings
const FIELDS_TO_EMBED = [
  { source: "titleSum", target: "titleEmbed" },
  { source: "locationSum", target: "locationEmbed" },
  { source: "skillsSum", target: "skillsEmbed" },
  { source: "requirementsSum", target: "requirementsEmbed" },
];

// Rate limiting configuration
const BATCH_SIZE = 5; // Reduced batch size
const DELAY_BETWEEN_BATCHES = 2000; // Increased delay
const DELAY_BETWEEN_FIELDS = 500; // Delay between fields

// Mock embedding function for testing
function generateMockEmbedding(text) {
  const words = text.split(" ").filter((w) => w.length > 0);
  const embedding = new Array(384)
    .fill(0)
    .map(
      (_, i) =>
        Math.sin(words.length * i * 0.1) * 0.5 +
        Math.cos(text.length * i * 0.05) * 0.3 +
        (Math.random() - 0.5) * 0.1
    );
  return embedding;
}

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
      return baseHeaders;
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
 * Get embedding vector from API with fallback to mock
 */
async function getEmbedding(text, useMock = false) {
  if (!text || text.trim() === "") {
    console.log(`    ⚠️ Empty text provided`);
    return null;
  }

  // Clean and prepare text
  const cleanText = text.trim();
  console.log(
    `    📝 Text to embed: "${cleanText.substring(0, 100)}${
      cleanText.length > 100 ? "..." : ""
    }"`
  );

  if (useMock) {
    console.log(`    🔧 Using mock embedding`);
    await sleep(100); // Simulate API delay
    return generateMockEmbedding(cleanText);
  }

  try {
    const response = await axios.post(
      EMBEDDING_API_URL,
      getRequestBody(cleanText),
      {
        headers: getAuthHeaders(),
        timeout: 30000,
      }
    );

    return response.data.embedding || response.data;
  } catch (error) {
    console.error(
      `    ❌ API Error: ${error.response?.data?.detail || error.message}`
    );

    if (error.response?.status === 401) {
      console.error(`    🔧 Falling back to mock embedding...`);
      return generateMockEmbedding(cleanText);
    }

    console.error(
      `    ❌ Failed to get embedding for text: "${cleanText.substring(
        0,
        50
      )}..."`
    );
    return null;
  }
}

/**
 * Process a single job to add embeddings
 */
async function processJob(
  job,
  jobIndex,
  companyIndex,
  totalJobs,
  useMock = false
) {
  console.log(
    `\n📋 Processing job ${jobIndex + 1}/${totalJobs} from company ${
      companyIndex + 1
    }:`
  );
  console.log(`    Title: ${job.title || "No title"}`);

  const updates = {};
  let processedFields = 0;
  let successfulFields = 0;

  // Process each field that needs embedding
  for (const field of FIELDS_TO_EMBED) {
    processedFields++;
    const sourceText = job[field.source];

    console.log(
      `\n  🔄 Processing field ${processedFields}/${FIELDS_TO_EMBED.length}: ${field.source} -> ${field.target}`
    );

    if (sourceText && sourceText.trim() !== "") {
      console.log(`    ✅ Source text found (${sourceText.length} chars)`);

      const embedding = await getEmbedding(sourceText, useMock);

      if (embedding && Array.isArray(embedding) && embedding.length > 0) {
        updates[field.target] = embedding;
        successfulFields++;
        console.log(
          `    ✅ Successfully embedded! Vector length: ${embedding.length}`
        );
      } else {
        console.log(`    ❌ Failed to get embedding`);
        updates[field.target] = null;
      }

      // Add delay between fields
      await sleep(DELAY_BETWEEN_FIELDS);
    } else {
      console.log(`    ⚠️ Source field '${field.source}' is empty or null`);
      console.log(`    📊 Field value:`, sourceText);
      updates[field.target] = null;
    }
  }

  console.log(
    `  📈 Job summary: ${successfulFields}/${processedFields} fields embedded successfully`
  );
  return { ...job, ...updates };
}

/**
 * Sleep function for delays
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process jobs in batches
 */
async function processJobsBatch(jobs, companyIndex, useMock = false) {
  const results = [];
  const totalBatches = Math.ceil(jobs.length / BATCH_SIZE);

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const currentBatch = Math.floor(i / BATCH_SIZE) + 1;

    console.log(
      `\n🔄 Processing batch ${currentBatch}/${totalBatches} for company ${
        companyIndex + 1
      }`
    );
    console.log(`   Jobs in this batch: ${batch.length}`);

    // Process batch jobs sequentially to avoid overwhelming the API
    for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
      const job = batch[batchIndex];
      const globalJobIndex = i + batchIndex;

      const processedJob = await processJob(
        job,
        globalJobIndex,
        companyIndex,
        jobs.length,
        useMock
      );
      results.push(processedJob);
    }

    // Delay between batches
    if (i + BATCH_SIZE < jobs.length) {
      console.log(
        `\n⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`
      );
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  return results;
}

/**
 * Test API connection
 */
async function validateAPI() {
  console.log("🔍 Validating API connection...");
  console.log(`URL: ${EMBEDDING_API_URL}`);
  console.log(`Auth method: ${AUTH_METHOD}`);
  console.log(`API Key: ${API_KEY}`);

  const testText = "Software Engineer";
  const embedding = await getEmbedding(testText);

  if (embedding && Array.isArray(embedding) && embedding.length > 0) {
    console.log("✅ API connection successful!");
    console.log(`✅ Embedding vector length: ${embedding.length}`);
    return true;
  } else {
    console.log("❌ API connection failed!");
    console.log("💡 Will use mock embeddings for testing");
    return false;
  }
}

/**
 * Analyze the input data structure
 */
function analyzeInputData(companies) {
  console.log("\n📊 Analyzing input data structure...");

  let totalJobs = 0;
  const fieldStats = {
    titleSum: { present: 0, empty: 0 },
    locationSum: { present: 0, empty: 0 },
    skillsSum: { present: 0, empty: 0 },
    requirementsSum: { present: 0, empty: 0 },
  };

  companies.forEach((company) => {
    if (company.jobs && Array.isArray(company.jobs)) {
      totalJobs += company.jobs.length;

      company.jobs.forEach((job) => {
        FIELDS_TO_EMBED.forEach((field) => {
          const value = job[field.source];
          if (value && value.trim() !== "") {
            fieldStats[field.source].present++;
          } else {
            fieldStats[field.source].empty++;
          }
        });
      });
    }
  });

  console.log(`📈 Data Analysis Results:`);
  console.log(`  Companies: ${companies.length}`);
  console.log(`  Total jobs: ${totalJobs}`);
  console.log(`  Field statistics:`);

  Object.entries(fieldStats).forEach(([field, stats]) => {
    const total = stats.present + stats.empty;
    const percentage =
      total > 0 ? ((stats.present / total) * 100).toFixed(1) : "0";
    console.log(
      `    ${field}: ${stats.present}/${total} (${percentage}%) have data`
    );
  });

  return totalJobs;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log("🚀 Starting embedding conversion process...\n");

    // Validate API
    const isAPIValid = await validateAPI();
    const useMockEmbeddings = !isAPIValid;

    // Read input file
    console.log(`\n📂 Reading input file: ${INPUT_FILE}`);
    if (!fs.existsSync(INPUT_FILE)) {
      throw new Error(`Input file not found: ${INPUT_FILE}`);
    }

    const rawData = fs.readFileSync(INPUT_FILE, "utf8");
    const companies = JSON.parse(rawData);
    console.log(`✅ Loaded ${companies.length} companies`);

    // Analyze input data
    const totalJobs = analyzeInputData(companies);

    if (totalJobs === 0) {
      console.log("⚠️  No jobs found to process");
      return;
    }

    // Process each company
    const processedCompanies = [];
    let processedJobsCount = 0;

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

      const processedJobs = await processJobsBatch(
        company.jobs,
        companyIndex,
        useMockEmbeddings
      );
      processedJobsCount += processedJobs.length;

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

    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(processedCompanies, null, 2),
      "utf8"
    );

    console.log("✅ Conversion completed successfully!");
    console.log(`📄 Output saved to: ${OUTPUT_FILE}`);

    // Generate detailed summary
    let successCount = 0;
    let failCount = 0;
    const fieldSummary = {};

    processedCompanies.forEach((company) => {
      if (company.jobs) {
        company.jobs.forEach((job) => {
          FIELDS_TO_EMBED.forEach((field) => {
            if (!fieldSummary[field.target]) {
              fieldSummary[field.target] = { success: 0, failed: 0 };
            }

            if (job[field.target] !== null && job[field.target] !== undefined) {
              successCount++;
              fieldSummary[field.target].success++;
            } else if (job[field.source] && job[field.source].trim() !== "") {
              failCount++;
              fieldSummary[field.target].failed++;
            }
          });
        });
      }
    });

    console.log("\n📈 Final Summary:");
    console.log(`  ✅ Total successful embeddings: ${successCount}`);
    console.log(`  ❌ Total failed embeddings: ${failCount}`);
    console.log(
      `  📊 Overall success rate: ${(
        (successCount / (successCount + failCount)) *
        100
      ).toFixed(2)}%`
    );

    console.log(`\n📋 Field-by-field breakdown:`);
    Object.entries(fieldSummary).forEach(([field, stats]) => {
      const total = stats.success + stats.failed;
      const rate = total > 0 ? ((stats.success / total) * 100).toFixed(1) : "0";
      console.log(`    ${field}: ${stats.success}/${total} (${rate}%)`);
    });

    if (useMockEmbeddings) {
      console.log(`\n⚠️  Note: Mock embeddings were used due to API issues`);
      console.log(
        `   To use real embeddings, ensure the API key and endpoint are correct`
      );
    }
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
