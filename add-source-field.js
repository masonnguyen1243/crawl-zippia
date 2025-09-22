import fs from "fs";
import path from "path";

console.log("🚀 Starting to add source field to jobs...");

// Cấu hình đường dẫn
const INPUT_FILE = path.resolve(
  "c:/Users/Jason Cuong/Downloads/summarized_companies.json"
);
const OUTPUT_FILE = path.resolve("./summarized_companies_with_source.json");

async function addSourceField() {
  try {
    // Đọc file JSON
    console.log("📂 Reading input file...");
    const data = fs.readFileSync(INPUT_FILE, "utf8");
    const companies = JSON.parse(data);

    console.log(`✅ Loaded ${companies.length} companies`);

    let totalJobsProcessed = 0;

    // Duyệt qua từng company
    for (
      let companyIndex = 0;
      companyIndex < companies.length;
      companyIndex++
    ) {
      const company = companies[companyIndex];

      console.log(
        `\nProcessing company ${companyIndex + 1}/${companies.length}: ${
          company.companyName
        }`
      );

      if (company.jobs && Array.isArray(company.jobs)) {
        console.log(`  Found ${company.jobs.length} jobs`);

        // Duyệt qua từng job trong company
        for (let jobIndex = 0; jobIndex < company.jobs.length; jobIndex++) {
          const job = company.jobs[jobIndex];

          if (job.title) {
            // Tạo object mới với thứ tự field mong muốn
            const newJob = {
              title: job.title,
              source: "Jobsgo",
              ...Object.fromEntries(
                Object.entries(job).filter(([key]) => key !== "title")
              ),
            };

            company.jobs[jobIndex] = newJob;
            totalJobsProcessed++;
          }
        }

        console.log(`  ✅ Processed ${company.jobs.length} jobs`);
      } else {
        console.log("  ⚠️  No jobs found in this company");
      }
    }

    // Ghi file kết quả
    console.log(`\n💾 Saving results to: ${OUTPUT_FILE}`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(companies, null, 2), "utf8");

    console.log("✅ Successfully added source field!");
    console.log(`\nFinal Summary:`);
    console.log(`  Total companies: ${companies.length}`);
    console.log(`  Total jobs processed: ${totalJobsProcessed}`);
    console.log(`  Output saved to: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Chạy script
addSourceField();
