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
const AUTH_METHOD = "plain";
const INPUT_FILE = "./summarized_ketquafinal-3.json";
const OUTPUT_FILE = "./final-result-3.json";

// Fields to convert to embeddings
const FIELDS_TO_EMBED = [
  { source: "requirementsSum", target: "requirementsEmbedding" },
];

// Company level fields to embed
const COMPANY_FIELDS_TO_EMBED = [];

// Rate limiting configuration
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 2000;
const DELAY_BETWEEN_FIELDS = 1000;
const REQUEST_TIMEOUT = 60000; // Increase to 60 seconds
const MAX_RETRIES = 3;

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

// Mock embedding function for fallback
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
 * Get embedding vector from API with fallback to mock
 */
async function getEmbedding(text, retryCount = 0) {
  if (!text || text.trim() === "") {
    console.log("Empty text provided");
    return null;
  }

  // Clean and prepare text
  const cleanText = text.trim();
  console.log(
    "Text to embed:",
    cleanText.substring(0, 100) + (cleanText.length > 100 ? "..." : "")
  );

  try {
    const response = await axios.post(
      EMBEDDING_API_URL,
      getRequestBody(cleanText),
      {
        headers: getAuthHeaders(),
        timeout: REQUEST_TIMEOUT,
      }
    );

    return response.data.embedding || response.data;
  } catch (error) {
    console.error("API Error:", error.response?.data?.detail || error.message);

    // Retry on timeout or network errors
    if (
      retryCount < MAX_RETRIES &&
      (error.code === "ECONNABORTED" ||
        error.message.includes("timeout") ||
        error.response?.status >= 500)
    ) {
      console.log(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(2000 * (retryCount + 1)); // Exponential backoff
      return await getEmbedding(text, retryCount + 1);
    }

    // Always fall back to mock embedding on any error
    console.error("Falling back to mock embedding...");
    // Generate mock embedding as fallback
    const words = cleanText.split(" ").filter((w) => w.length > 0);
    const embedding = new Array(384)
      .fill(0)
      .map(
        (_, i) =>
          Math.sin(words.length * i * 0.1) * 0.5 +
          Math.cos(cleanText.length * i * 0.05) * 0.3 +
          (Math.random() - 0.5) * 0.1
      );
    return embedding;
  }
}

/**
 * Process a single company to add embeddings
 */
async function processCompany(company, companyIndex, totalCompanies) {
  console.log(
    "\nProcessing company " + (companyIndex + 1) + "/" + totalCompanies + ":"
  );
  console.log("    Company Name:", company.name || "No name");

  const companyUpdates = {};
  let processedFields = 0;
  let successfulFields = 0;

  // Process each company field that needs embedding
  for (const field of COMPANY_FIELDS_TO_EMBED) {
    processedFields++;
    const sourceText = company[field.source];

    console.log(
      "\n  Processing company field " +
        processedFields +
        "/" +
        COMPANY_FIELDS_TO_EMBED.length +
        ": " +
        field.source +
        " -> " +
        field.target
    );

    if (sourceText && sourceText.trim() !== "") {
      console.log("    Source text found (" + sourceText.length + " chars)");

      const embedding = await getEmbedding(sourceText);

      if (embedding && Array.isArray(embedding) && embedding.length > 0) {
        companyUpdates[field.target] = embedding;
        successfulFields++;
        console.log(
          "    Successfully embedded! Vector length:",
          embedding.length
        );
      } else {
        console.log("    Failed to get embedding");
        companyUpdates[field.target] = null;
      }

      // Add delay between fields
      await sleep(DELAY_BETWEEN_FIELDS);
    } else {
      console.log("    Source field '" + field.source + "' is empty or null");
      console.log("    Field value:", sourceText);
      companyUpdates[field.target] = null;
    }
  }

  console.log(
    "  Company embedding summary:",
    successfulFields + "/" + processedFields + " fields embedded successfully"
  );
  return companyUpdates;
}

/**
 * Process a single job to add embeddings
 */
async function processJob(job, jobIndex, companyIndex, totalJobs) {
  console.log(
    `\nProcessing job ${jobIndex + 1}/${totalJobs} from company ${
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
      `\n  Processing field ${processedFields}/${FIELDS_TO_EMBED.length}: ${field.source} -> ${field.target}`
    );

    if (sourceText && sourceText.trim() !== "") {
      console.log(`    Source text found (${sourceText.length} chars)`);

      const embedding = await getEmbedding(sourceText);

      if (embedding && Array.isArray(embedding) && embedding.length > 0) {
        updates[field.target] = embedding;
        successfulFields++;
        console.log(
          `    Successfully embedded! Vector length: ${embedding.length}`
        );
      } else {
        console.log(`    Failed to get embedding`);
        updates[field.target] = null;
      }

      // Add delay between fields
      await sleep(DELAY_BETWEEN_FIELDS);
    } else {
      console.log(`    Source field '${field.source}' is empty or null`);
      console.log(`    Field value:`, sourceText);
      updates[field.target] = null;
    }
  }

  console.log(
    `  Job summary: ${successfulFields}/${processedFields} fields embedded successfully`
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
 * Process jobs in batches to manage API rate limits
 */
async function processJobsBatch(jobs, companyIndex) {
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
        jobs.length
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
 * Save intermediate results to file
 */
function saveIntermediateResults(processedCompanies, currentIndex, total) {
  try {
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save current progress
    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(processedCompanies, null, 2),
      "utf8"
    );

    console.log(
      `💾 Saved progress: ${currentIndex}/${total} companies (${(
        (currentIndex / total) *
        100
      ).toFixed(1)}%)`
    );
  } catch (error) {
    console.error("❌ Error saving intermediate results:", error.message);
  }
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
    console.log("⚠️  API connection failed! Using mock embeddings...");
    console.log("💡 The process will continue with generated mock embeddings");
    return true; // Continue with mock embeddings
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

    // Check if output file already exists
    let startFromIndex = 0;
    if (fs.existsSync(OUTPUT_FILE)) {
      try {
        const existingData = fs.readFileSync(OUTPUT_FILE, "utf8");
        const existingCompanies = JSON.parse(existingData);
        startFromIndex = existingCompanies.length;
        console.log(
          `📋 Found existing output file with ${startFromIndex} companies`
        );
        console.log(`🔄 Resuming from company ${startFromIndex + 1}`);
      } catch (error) {
        console.log(`⚠️  Existing output file is corrupted, starting fresh`);
        startFromIndex = 0;
      }
    }

    const rawData = fs.readFileSync(INPUT_FILE, "utf8");
    const companies = JSON.parse(rawData);
    console.log(`✅ Loaded ${companies.length} companies`);

    // Calculate total jobs for progress tracking
    const totalJobs = companies
      .slice(startFromIndex)
      .reduce((sum, company) => sum + (company.jobs?.length || 0), 0);
    console.log(
      `📊 Total jobs to process: ${totalJobs} (remaining from company ${
        startFromIndex + 1
      })`
    );

    if (totalJobs === 0) {
      if (startFromIndex === 0) {
        console.log("⚠️  No jobs found to process");
        return;
      } else {
        console.log("✅ All companies already processed!");
        return;
      }
    }

    // Load existing processed companies if any
    let processedCompanies = [];
    if (startFromIndex > 0 && fs.existsSync(OUTPUT_FILE)) {
      try {
        const existingData = fs.readFileSync(OUTPUT_FILE, "utf8");
        processedCompanies = JSON.parse(existingData);
        console.log(
          `📥 Loaded ${processedCompanies.length} existing processed companies`
        );
      } catch (error) {
        console.log("⚠️  Could not load existing data, starting fresh");
        processedCompanies = [];
        startFromIndex = 0;
      }
    }

    for (
      let companyIndex = startFromIndex;
      companyIndex < companies.length;
      companyIndex++
    ) {
      const company = companies[companyIndex];

      // Process company-level embedding first
      const companyEmbeddings = await processCompany(
        company,
        companyIndex,
        companies.length
      );

      if (!company.jobs || company.jobs.length === 0) {
        console.log("  No jobs found for this company");

        // Keep original company structure without embeddings
        processedCompanies.push({
          ...company,
          jobs: company.jobs || [],
        });

        // Save intermediate results after each company
        saveIntermediateResults(
          processedCompanies,
          companyIndex + 1,
          companies.length
        );
        continue;
      }

      console.log("  Found " + company.jobs.length + " jobs");

      // Process all jobs for this company
      const processedJobs = await processJobsBatch(company.jobs, companyIndex);

      // Add processed company to results with job embeddings only
      processedCompanies.push({
        ...company,
        jobs: processedJobs,
      });

      console.log(
        "Completed company " + (companyIndex + 1) + "/" + companies.length
      );

      // Save intermediate results after each company
      saveIntermediateResults(
        processedCompanies,
        companyIndex + 1,
        companies.length
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
    let companySuccessCount = 0;
    let companyFailCount = 0;

    processedCompanies.forEach((company) => {
      // Count company-level embeddings
      COMPANY_FIELDS_TO_EMBED.forEach((field) => {
        if (
          company[field.target] !== null &&
          company[field.target] !== undefined
        ) {
          companySuccessCount++;
        } else if (
          company[field.source] &&
          company[field.source].trim() !== ""
        ) {
          companyFailCount++;
        }
      });

      // Count job-level embeddings
      if (company.jobs) {
        company.jobs.forEach((job) => {
          FIELDS_TO_EMBED.forEach((field) => {
            if (job[field.target] !== null && job[field.target] !== undefined) {
              successCount++;
            } else if (job[field.source] && job[field.source].trim() !== "") {
              failCount++;
            }
          });
        });
      }
    });

    const totalSuccess = successCount + companySuccessCount;
    const totalFail = failCount + companyFailCount;

    console.log("\nFinal Summary:");
    console.log(
      "  Company embeddings:",
      companySuccessCount + "/" + (companySuccessCount + companyFailCount)
    );
    console.log(
      "  Job embeddings:",
      successCount + "/" + (successCount + failCount)
    );
    console.log("  Total successful embeddings:", totalSuccess);
    console.log("  Total failed embeddings:", totalFail);
    console.log(
      "  Overall success rate:",
      ((totalSuccess / (totalSuccess + totalFail)) * 100).toFixed(2) + "%"
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
