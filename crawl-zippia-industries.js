import puppeteer from "puppeteer";
import fs from "fs/promises";

class ZippiaIndustryCrawler {
  constructor() {
    this.browser = null;
    this.page = null;
    this.industries = [];
  }

  async init() {
    console.log("Initializing browser...");
    this.browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  // Function to convert name to slug
  nameToSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
  }

  async crawlIndustries() {
    try {
      console.log("Navigating to Zippia.com...");
      await this.page.goto("https://www.zippia.com/", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Wait for the page to load completely
      await new Promise((resolve) => setTimeout(resolve, 3000));

      console.log("Looking for industry elements...");

      // Try to find industry links with the specified selector
      const industryElements = await this.page.$$(
        "span.list-link.industry-title"
      );

      if (industryElements.length === 0) {
        // If the specific selector doesn't work, try alternative selectors
        console.log(
          "Primary selector not found, trying alternative selectors..."
        );

        // Alternative selectors to try
        const alternativeSelectors = [
          "span.industry-title",
          ".industry-title",
          "a[href*='industry']",
          ".list-link",
          "span.list-link",
        ];

        for (const selector of alternativeSelectors) {
          const elements = await this.page.$$(selector);
          if (elements.length > 0) {
            console.log(
              `Found ${elements.length} elements with selector: ${selector}`
            );
            // Get text content from these elements
            const texts = await this.page.$$eval(selector, (elements) =>
              elements
                .map((el) => el.textContent?.trim())
                .filter((text) => text && text.length > 0)
            );
            console.log("Sample texts found:", texts.slice(0, 5));
          }
        }
      }

      // Extract industry data
      const industries = await this.page.evaluate(() => {
        const elements = document.querySelectorAll(
          "span.list-link.industry-title"
        );
        const results = [];

        elements.forEach((element) => {
          const name = element.textContent?.trim();
          if (name && name.length > 0) {
            results.push(name);
          }
        });

        return results;
      });

      // If primary selector didn't work, try to find industries in page content
      if (industries.length === 0) {
        console.log(
          "Trying to extract industry information from page content..."
        );

        // Look for common industry terms or patterns
        const pageContent = await this.page.evaluate(() => {
          // Try to find industry-related content
          const possibleIndustryElements = document.querySelectorAll(
            'a[href*="industry"], a[href*="career"], .industry, .career-path, [class*="industry"], [class*="career"]'
          );

          const industries = [];
          possibleIndustryElements.forEach((el) => {
            const text = el.textContent?.trim();
            if (text && text.length > 2 && text.length < 50) {
              industries.push(text);
            }
          });

          return [...new Set(industries)]; // Remove duplicates
        });

        if (pageContent.length > 0) {
          console.log(
            `Found ${pageContent.length} potential industry items from page content`
          );
          pageContent.forEach((name) => {
            if (
              name &&
              !industries.some((industry) => industry.name === name)
            ) {
              industries.push(name);
            }
          });
        }
      }

      // Convert to desired format
      console.log(`Processing ${industries.length} industries...`);
      this.industries = industries.map((name) => ({
        name: name,
        slug: this.nameToSlug(name),
      }));

      // Remove duplicates based on slug
      this.industries = this.industries.filter(
        (industry, index, self) =>
          index === self.findIndex((i) => i.slug === industry.slug)
      );

      console.log(`Extracted ${this.industries.length} unique industries`);

      // Log first few results
      if (this.industries.length > 0) {
        console.log("Sample results:", this.industries.slice(0, 5));
      }
    } catch (error) {
      console.error("Error crawling industries:", error);
      throw error;
    }
  }

  async saveResults() {
    try {
      const fileName = "industry-result.json";
      await fs.writeFile(
        fileName,
        JSON.stringify(this.industries, null, 2),
        "utf8"
      );
      console.log(`✅ Results saved to ${fileName}`);
      console.log(`📊 Total industries saved: ${this.industries.length}`);
    } catch (error) {
      console.error("Error saving results:", error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("Browser closed");
    }
  }
}

// Main execution function
async function main() {
  const crawler = new ZippiaIndustryCrawler();

  try {
    await crawler.init();
    await crawler.crawlIndustries();
    await crawler.saveResults();
  } catch (error) {
    console.error("❌ Crawler failed:", error);
  } finally {
    await crawler.close();
  }
}

// Handle script termination
process.on("SIGINT", async () => {
  console.log("\n⚠️  Received SIGINT, closing browser...");
  process.exit(0);
});

// Run the crawler
main().catch(console.error);
