import { ZippiaCrawler } from "./zippia-crawler.js";

// Test function to run the crawler
async function testCrawler() {
  console.log("Starting Zippia Crawler Test...");

  const crawler = new ZippiaCrawler();

  try {
    await crawler.init();
    await crawler.crawlJobs();
    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await crawler.close();
  }
}

// Run the test
testCrawler().catch(console.error);
