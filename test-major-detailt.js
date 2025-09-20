// Test script to demonstrate major_detailt functionality
import puppeteer from "puppeteer";

async function testMajorDetailt() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Create a test HTML page with major data
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><title>Test Major Extraction</title></head>
    <body>
      <table>
        <tr class="table_row__5EKKN">
          <td><a class="list-link" href="/business-major">Business</a></td>
          <td>15%</td>
        </tr>
        <tr class="table_row__5EKKN">
          <td><a class="list-link" href="/marketing-major">Marketing</a></td>
          <td>12%</td>
        </tr>
        <tr class="table_row__5EKKN">
          <td><a class="list-link" href="/communication-major">Communication</a></td>
          <td>10%</td>
        </tr>
        <tr class="table_row__5EKKN">
          <td><a class="list-link" href="/psychology-major">Psychology</a></td>
          <td>8%</td>
        </tr>
        <tr class="table_row__5EKKN">
          <td><a class="list-link" href="/management-major">Management</a></td>
          <td>6%</td>
        </tr>
      </table>
    </body>
    </html>
  `);

  // Test the major extraction logic with major_detailt
  const majorData = await page.evaluate(() => {
    const education = { major: [] };

    const possibleMajorSelectors = [
      "tr.table_row__5EKKN", // Original specific selector
      "tr[class*='table_row']", // Class variations
      "tr", // Fallback to all table rows
    ];

    for (const selector of possibleMajorSelectors) {
      const rows = document.querySelectorAll(selector);

      if (rows.length > 0) {
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i];
          const linkElement = row.querySelector(
            "a.list-link, a[href*='major']"
          );
          const levelElement = row.querySelector("td:last-child");

          if (linkElement && levelElement) {
            const name = linkElement.textContent.trim();
            const levelText = levelElement.textContent.trim();
            const majorHref = linkElement.getAttribute("href") || "";
            // Build full URL by combining base URL with href
            const fullMajorUrl = majorHref
              ? `https://www.zippia.com${majorHref}`
              : "";

            // Filter valid majors
            if (
              (levelText.includes("%") || levelText.match(/\d+\.?\d*/)) &&
              name.length > 2 &&
              !name.toLowerCase().includes("other")
            ) {
              const level =
                parseFloat(
                  levelText.replace("%", "").replace(/[^0-9.]/g, "")
                ) || 0;

              if (level > 0 && education.major.length < 10) {
                education.major.push({
                  name: name,
                  level: level,
                  major_detailt: fullMajorUrl,
                });
              }
            }
          }
        }

        if (education.major.length > 0) break; // Stop after finding majors
      }
    }

    return education.major;
  });

  console.log("Test Major Extraction with major_detailt:");
  console.log(JSON.stringify(majorData, null, 2));

  await browser.close();
}

testMajorDetailt().catch(console.error);
