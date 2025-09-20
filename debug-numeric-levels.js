import puppeteer from "puppeteer";

async function debugNumericLevels() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log(
      "Navigating to Account Executive page for numeric levels debug..."
    );
    await page.goto("https://www.zippia.com/account-executive-jobs/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\n=== DEBUGGING STRESS, COMPLEXITY, WORK-LIFE BALANCE ===");

    const numericDebug = await page.evaluate(() => {
      const results = [];

      // Search all sections for stress, complexity, work-life related content
      const allSections = document.querySelectorAll("div, section, p, span");

      allSections.forEach((element, index) => {
        const text = element.textContent.toLowerCase();
        const hasNumbers = /\b\d+\b/.test(element.textContent);

        // Look for stress-related content
        if (text.includes("stress") && hasNumbers) {
          results.push({
            type: "STRESS",
            index: index,
            tagName: element.tagName,
            classList: Array.from(element.classList),
            textContent: element.textContent.trim(),
            numbers: element.textContent.match(/\d+/g),
            parentClassList: element.parentElement
              ? Array.from(element.parentElement.classList)
              : [],
          });
        }

        // Look for complexity-related content
        if (
          (text.includes("complex") || text.includes("difficulty")) &&
          hasNumbers
        ) {
          results.push({
            type: "COMPLEXITY",
            index: index,
            tagName: element.tagName,
            classList: Array.from(element.classList),
            textContent: element.textContent.trim(),
            numbers: element.textContent.match(/\d+/g),
            parentClassList: element.parentElement
              ? Array.from(element.parentElement.classList)
              : [],
          });
        }

        // Look for work-life balance content
        if (
          (text.includes("work") && text.includes("life")) ||
          (text.includes("balance") && hasNumbers)
        ) {
          results.push({
            type: "WORK_LIFE_BALANCE",
            index: index,
            tagName: element.tagName,
            classList: Array.from(element.classList),
            textContent: element.textContent.trim(),
            numbers: element.textContent.match(/\d+/g),
            parentClassList: element.parentElement
              ? Array.from(element.parentElement.classList)
              : [],
          });
        }
      });

      return results;
    });

    console.log("Numeric levels debug results:");
    numericDebug.forEach((result, i) => {
      console.log(`\n--- ${result.type} #${i + 1} ---`);
      console.log("Tag:", result.tagName);
      console.log("Classes:", result.classList);
      console.log("Parent Classes:", result.parentClassList);
      console.log("Numbers found:", result.numbers);
      console.log("Text:", result.textContent.substring(0, 150) + "...");
    });

    // Also check for any section with just numbers (might be rating sections)
    console.log("\n=== LOOKING FOR RATING/SCORE SECTIONS ===");
    const ratingDebug = await page.evaluate(() => {
      const ratings = [];

      // Look for elements that might contain ratings (1-10 scale)
      const possibleRatings = document.querySelectorAll("*");

      possibleRatings.forEach((element) => {
        const text = element.textContent.trim();
        const onlyNumbers = /^\d{1,2}$/.test(text); // Only 1-2 digits
        const isRatingRange = /^[1-9]|10$/.test(text); // 1-10 range

        if (onlyNumbers && isRatingRange && element.children.length === 0) {
          const context = element.parentElement
            ? element.parentElement.textContent
            : "";

          ratings.push({
            number: text,
            tagName: element.tagName,
            classList: Array.from(element.classList),
            parentClasses: element.parentElement
              ? Array.from(element.parentElement.classList)
              : [],
            context: context.substring(0, 200),
          });
        }
      });

      return ratings.slice(0, 20); // Limit to first 20 results
    });

    console.log("Rating sections found:");
    ratingDebug.forEach((rating, i) => {
      console.log(`\n--- Rating #${i + 1}: ${rating.number} ---`);
      console.log("Tag:", rating.tagName);
      console.log("Classes:", rating.classList);
      console.log("Parent Classes:", rating.parentClasses);
      console.log("Context:", rating.context);
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error) {
    console.error("Debug error:", error);
  } finally {
    await browser.close();
  }
}

debugNumericLevels();
