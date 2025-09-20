import puppeteer from "puppeteer";

async function debugZippiaStructure() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log("Navigating to Account Executive page...");
    await page.goto("https://www.zippia.com/account-executive-jobs/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Debug salary sections
    console.log("\n=== DEBUGGING SALARY SECTIONS ===");
    const salaryDebug = await page.evaluate(() => {
      const results = [];

      // Check all bg-white sections
      const bgWhiteSections = document.querySelectorAll(".bg-white");
      console.log(`Found ${bgWhiteSections.length} bg-white sections`);

      bgWhiteSections.forEach((section, index) => {
        const strongElements = section.querySelectorAll("strong");
        const hasZp20 = section.classList.contains("z-p-20");

        strongElements.forEach((strong, strongIndex) => {
          const text = strong.textContent.trim();
          if (text.includes("$") || text.includes("%")) {
            results.push({
              sectionIndex: index,
              strongIndex: strongIndex,
              hasZp20: hasZp20,
              text: text,
              classList: Array.from(section.classList),
              html: section.outerHTML.substring(0, 200) + "...",
            });
          }
        });
      });

      return results;
    });

    console.log("Salary debug results:", JSON.stringify(salaryDebug, null, 2));

    // Debug diversity sections
    console.log("\n=== DEBUGGING DIVERSITY SECTIONS ===");
    const diversityDebug = await page.evaluate(() => {
      const results = [];

      // Look for diversity-related content
      const bgWhiteSections = document.querySelectorAll(".bg-white");

      bgWhiteSections.forEach((section, index) => {
        const text = section.textContent.toLowerCase();
        if (
          text.includes("race") ||
          text.includes("gender") ||
          text.includes("age") ||
          text.includes("diversity") ||
          text.includes("demographics")
        ) {
          const strongElements = section.querySelectorAll("strong");
          const paragraphs = section.querySelectorAll("p");

          results.push({
            sectionIndex: index,
            hasZp20: section.classList.contains("z-p-20"),
            strongCount: strongElements.length,
            paragraphCount: paragraphs.length,
            classList: Array.from(section.classList),
            textPreview: text.substring(0, 300),
            strongTexts: Array.from(strongElements).map((s) =>
              s.textContent.trim()
            ),
            paragraphTexts: Array.from(paragraphs)
              .map((p) => p.textContent.trim())
              .slice(0, 5),
          });
        }
      });

      return results;
    });

    console.log(
      "Diversity debug results:",
      JSON.stringify(diversityDebug, null, 2)
    );

    // Check all sections with specific patterns
    console.log(
      "\n=== CHECKING ALL SECTIONS FOR SALARY/DIVERSITY PATTERNS ==="
    );
    const allSections = await page.evaluate(() => {
      const allDivs = document.querySelectorAll("div");
      const patterns = [];

      allDivs.forEach((div, index) => {
        const text = div.textContent.toLowerCase();
        const hasImportantData =
          text.includes("$") ||
          text.includes("salary") ||
          text.includes("diversity") ||
          text.includes("race") ||
          text.includes("gender") ||
          text.includes("age");

        if (hasImportantData && div.children.length > 0) {
          patterns.push({
            index: index,
            classList: Array.from(div.classList),
            childrenCount: div.children.length,
            textPreview: text.substring(0, 200),
          });
        }
      });

      return patterns.slice(0, 10); // Limit to first 10 matches
    });

    console.log(
      "Pattern matching results:",
      JSON.stringify(allSections, null, 2)
    );

    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error) {
    console.error("Debug error:", error);
  } finally {
    await browser.close();
  }
}

debugZippiaStructure();
