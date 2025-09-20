import { ZippiaCrawler } from "./zippia-crawler.js";

async function testSingleJob() {
  console.log("Testing single job extraction...");

  const crawler = new ZippiaCrawler();

  try {
    await crawler.init();

    // Test với Account Executive job
    const jobData = await crawler.extractJobDetails(
      "https://www.zippia.com/account-executive-jobs/",
      "Account Executive Test"
    );

    console.log("=== EXTRACTED JOB DATA ===");
    console.log("Job Name:", jobData.job_name);
    console.log(
      "Overview:",
      jobData.details[0]?.overview?.substring(0, 100) + "..."
    );
    console.log("Salary:", JSON.stringify(jobData.details[0]?.salary, null, 2));
    console.log(
      "Stability Level:",
      JSON.stringify(jobData.details[0]?.stability_level, null, 2)
    );
    console.log(
      "Diversity:",
      JSON.stringify(jobData.details[0]?.diversity, null, 2)
    );
    console.log("Stress Level:", jobData.details[0]?.stress_level);
    console.log("Complexity Level:", jobData.details[0]?.complexity_level);
    console.log("Work Life Balance:", jobData.details[0]?.work_life_balance);

    // Save the test result
    await crawler.saveJobData(jobData);
    console.log("Test data saved to zippia-jobs.json");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await crawler.close();
  }
}

testSingleJob();
