import puppeteer from "puppeteer";
import fs from "fs";

async function crawlZippiaIndustries() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  try {
    const page = await browser.newPage();

    // Navigate to Zippia homepage
    console.log("Navigating to Zippia homepage...");
    await page.goto("https://www.zippia.com/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for the page to load completely
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Look for industry links with the specified selector
    console.log("Looking for industry elements...");

    // Wait for elements to be present
    try {
      await page.waitForSelector("span.list-link.industry-title", {
        timeout: 10000,
      });
    } catch (error) {
      console.log(
        "Primary selector not found, trying alternative selectors..."
      );
    }

    // Extract industry data
    const industries = await page.evaluate(() => {
      const industryElements = document.querySelectorAll(
        "span.list-link.industry-title"
      );
      const results = [];

      industryElements.forEach((element) => {
        const text = element.textContent?.trim();
        if (text) {
          // Create slug by converting text to lowercase and replacing spaces/special chars with hyphens
          const slug = text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "") // Remove special characters
            .replace(/\s+/g, "-") // Replace spaces with hyphens
            .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

          results.push({
            slug: slug,
            name: text,
          });
        }
      });

      return results;
    });

    console.log(`Found ${industries.length} industries:`);
    industries.forEach((industry, index) => {
      console.log(
        `${index + 1}. Slug: "${industry.slug}", Name: "${industry.name}"`
      );
    });

    // Save results to JSON file
    const outputFile = "zippia-industries.json";
    fs.writeFileSync(outputFile, JSON.stringify(industries, null, 2));
    console.log(`\nResults saved to ${outputFile}`);

    // Also look for the specific "technology" industry if it exists
    const technologyIndustry = industries.find(
      (industry) =>
        industry.slug.includes("technology") ||
        industry.name.toLowerCase().includes("technology")
    );

    if (technologyIndustry) {
      console.log("\nFound Technology industry:");
      console.log(`Slug: "${technologyIndustry.slug}"`);
      console.log(`Name: "${technologyIndustry.name}"`);
    } else {
      console.log("\nTechnology industry not found in the current results.");
    }

    return industries;
  } catch (error) {
    console.error("Error during crawling:", error);

    // Take screenshot for debugging if page exists
    try {
      const page = await browser.newPage();
      await page.screenshot({ path: "error-screenshot.png", fullPage: true });
      console.log("Screenshot saved as error-screenshot.png");
    } catch (screenshotError) {
      console.error("Could not take screenshot:", screenshotError);
    }

    throw error;
  } finally {
    await browser.close();
  }
}

// Alternative function to crawl from industries page directly
async function crawlZippiaIndustriesPage() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  try {
    const page = await browser.newPage();

    // Try different possible URLs for industries
    const possibleUrls = [
      "https://www.zippia.com/industries/",
      "https://www.zippia.com/browse/industries/",
      "https://www.zippia.com/explore/industries/",
    ];

    let industries = [];

    for (const url of possibleUrls) {
      try {
        console.log(`Trying URL: ${url}`);
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Look for industry links
        const found = await page.evaluate(() => {
          const elements = document.querySelectorAll(
            "span.list-link.industry-title, .industry-title, .list-link"
          );
          const results = [];

          elements.forEach((element) => {
            const text = element.textContent?.trim();
            if (text && text.length > 2) {
              const slug = text
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "");

              results.push({
                slug: slug,
                name: text,
              });
            }
          });

          return results;
        });

        if (found.length > 0) {
          industries = found;
          console.log(`Found ${industries.length} industries on ${url}`);
          break;
        }
      } catch (error) {
        console.log(`Failed to load ${url}:`, error.message);
        continue;
      }
    }

    if (industries.length === 0) {
      console.log("No industries found. Let me try a different approach...");

      // Try to find any links or elements that might contain industry information
      await page.goto("https://www.zippia.com/", { waitUntil: "networkidle2" });

      const allText = await page.evaluate(() => {
        // Look for any elements that might contain "technology" or other industries
        const allElements = document.querySelectorAll("*");
        const results = [];

        allElements.forEach((element) => {
          const text = element.textContent?.trim();
          if (
            text &&
            (text.toLowerCase().includes("technology") ||
              text.toLowerCase().includes("healthcare") ||
              text.toLowerCase().includes("finance") ||
              text.toLowerCase().includes("education"))
          ) {
            if (text.length < 50) {
              // Avoid very long text
              results.push({
                tagName: element.tagName,
                className: element.className,
                text: text,
              });
            }
          }
        });

        return results;
      });

      console.log("Found potential industry-related elements:");
      allText.forEach((item, index) => {
        console.log(
          `${index + 1}. ${item.tagName}.${item.className}: "${item.text}"`
        );
      });
    }

    return industries;
  } catch (error) {
    console.error("Error during alternative crawling:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Main execution
async function main() {
  try {
    console.log("Starting Zippia industry crawler...");
    console.log("Attempting to crawl from homepage first...\n");

    let industries = await crawlZippiaIndustries();

    if (industries.length === 0) {
      console.log(
        "\nNo industries found on homepage. Trying alternative approach...\n"
      );
      industries = await crawlZippiaIndustriesPage();
    }

    if (industries.length > 0) {
      console.log(`\nSuccessfully crawled ${industries.length} industries!`);
    } else {
      console.log(
        "\nNo industries found. The page structure might have changed."
      );
      console.log(
        "You may need to inspect the page manually to find the correct selectors."
      );
    }
  } catch (error) {
    console.error("Main execution error:", error);
    process.exit(1);
  }
}

// Run the crawler
main();
