import puppeteer from "puppeteer";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

export class ZippiaCrawler {
  constructor() {
    this.browser = null;
    this.page = null;
    this.dataFile = "zippia-jobs-test.json";
    this.existingData = [];
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=VizDisplayCompositor",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--disable-default-apps",
        "--disable-popup-blocking",
        "--disable-translate",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--disable-ipc-flooding-protection",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ],
    });
    this.page = await this.browser.newPage();

    // Anti-detection measures
    await this.page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Mock plugins
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });

      // Override the `chrome` object
      window.chrome = {
        runtime: {},
      };

      // Override the `Notification` object
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });

    // Set realistic viewport
    await this.page.setViewport({ width: 1366, height: 768 });

    // Set user agent
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set extra headers
    await this.page.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Ch-Ua":
        '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    });

    // Tăng timeout mặc định cho page
    this.page.setDefaultTimeout(30000); // 30 giây

    // Load existing data if file exists
    await this.loadExistingData();
  }

  async loadExistingData() {
    try {
      const data = await fs.readFile(this.dataFile, "utf8");
      this.existingData = JSON.parse(data);
      console.log(`Loaded ${this.existingData.length} existing records`);
    } catch (error) {
      console.log("No existing data file found, starting fresh");
      this.existingData = [];
    }
  }

  // Simulate human behavior to bypass bot detection
  async simulateHumanBehavior() {
    // Random mouse movements
    await this.page.mouse.move(Math.random() * 1366, Math.random() * 768);

    // Random scroll
    await this.page.evaluate(() => {
      window.scrollTo(0, Math.random() * 500);
    });

    // Random wait time between 1-3 seconds
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000)
    );
  }

  // Navigate with anti-detection measures
  async navigateWithRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} to navigate to: ${url}`);

        // Add random delay before navigation
        await new Promise((resolve) =>
          setTimeout(resolve, 2000 + Math.random() * 3000)
        );

        await this.page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 45000,
        });

        // Simulate human behavior
        await this.simulateHumanBehavior();

        // Check if we got blocked or redirected to a captcha
        const currentUrl = this.page.url();
        const title = await this.page.title();

        console.log(`Current URL: ${currentUrl}`);
        console.log(`Page title: ${title}`);

        // Check for bot detection indicators
        if (
          title.toLowerCase().includes("just a moment") ||
          title.toLowerCase().includes("checking your browser") ||
          title.toLowerCase().includes("cloudflare") ||
          currentUrl.includes("cdn-cgi")
        ) {
          console.log("Bot detection detected, waiting and retrying...");

          // Wait for potential challenge to complete
          await new Promise((resolve) =>
            setTimeout(resolve, 10000 + Math.random() * 5000)
          );

          // Check if challenge completed
          await this.page
            .waitForNavigation({
              waitUntil: "networkidle2",
              timeout: 30000,
            })
            .catch(() => {});

          const finalUrl = this.page.url();
          if (finalUrl !== url && !finalUrl.includes("cdn-cgi")) {
            console.log("Successfully bypassed bot detection");
            return;
          }

          if (attempt === maxRetries) {
            throw new Error(
              "Unable to bypass bot detection after multiple attempts"
            );
          }

          continue;
        }

        // Successfully loaded page
        return;
      } catch (error) {
        console.log(`Navigation attempt ${attempt} failed:`, error.message);

        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retry with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 5000 * attempt + Math.random() * 5000)
        );
      }
    }
  }

  findJobId(jobName) {
    // Check if job already exists in data
    const existingJob = this.existingData.find(
      (job) =>
        job.job_name === jobName ||
        (job.nextId && job.nextId.some((next) => next.jobtitle === jobName))
    );

    if (existingJob) {
      return existingJob.job_id;
    }

    // Generate new UUID if not found
    return uuidv4();
  }

  async saveJobData(jobData) {
    // Thêm job mới vào mảng và lưu toàn bộ mảng vào file
    this.existingData.push(jobData);
    await fs.writeFile(
      this.dataFile,
      JSON.stringify(this.existingData, null, 2)
    );
    console.log(`Saved job: ${jobData.job_name}`);
  }

  async getJobsList() {
    console.log("Navigating to Zippia sales industry page...");
    await this.navigateWithRetry("https://www.zippia.com/sales-industry/");

    try {
      // Debug: Check what job-related links are available on the page
      const pageInfo = await this.page.evaluate(() => {
        const info = {
          title: document.title,
          allLinks: document.querySelectorAll("a").length,
          listLinks: document.querySelectorAll("a.list-link").length,
          jobLinks: document.querySelectorAll("a[href*='-jobs']").length,
          salesLinks: document.querySelectorAll("a[href*='sales']").length,
          // Get sample job link text and hrefs to understand the structure
          sampleJobLinks: Array.from(
            document.querySelectorAll("a[href*='-jobs']")
          )
            .slice(0, 5)
            .map((link) => ({
              text: link.textContent.trim(),
              href: link.getAttribute("href"),
              className: link.className,
            })),
          // Alternative selectors to try
          possibleSelectors: {
            "a.list-link": document.querySelectorAll("a.list-link").length,
            'a[href*="-jobs"]':
              document.querySelectorAll("a[href*='-jobs']").length,
            'a[href*="/"]': document.querySelectorAll("a[href*='/']").length,
          },
        };
        return info;
      });

      console.log(`Page debug info:`, pageInfo);

      let jobLinks = [];

      // Try multiple selectors in order of preference
      const selectors = [
        "a.list-link",
        "a[href*='-jobs']",
        "a[href*='/'][title*='job']",
        "a[href*='/'][title]",
      ];

      for (const selector of selectors) {
        console.log(`Trying selector: ${selector}`);

        jobLinks = await this.page.evaluate((sel) => {
          const links = Array.from(document.querySelectorAll(sel))
            .filter((link) => {
              const href = link.getAttribute("href");
              const text = link.textContent.trim();

              // Filter for job-related links
              return (
                href &&
                href.includes("-jobs") &&
                text.length > 2 &&
                text.length < 50
              );
            })
            .slice(0, 2) // Get first 2 jobs
            .map((link) => ({
              name: link.textContent.trim(),
              href: link.href.startsWith("http")
                ? link.href
                : `https://www.zippia.com${link.getAttribute("href")}`,
            }));

          return links;
        }, selector);

        if (jobLinks.length > 0) {
          console.log(
            `Successfully found ${jobLinks.length} jobs using selector: ${selector}`
          );
          break;
        }
      }

      // If still no jobs found, try a broader approach
      if (jobLinks.length === 0) {
        console.log("Trying broader job search approach...");
        jobLinks = await this.page.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll("a"));
          const jobLinks = [];

          for (const link of allLinks) {
            const href = link.getAttribute("href");
            const text = link.textContent.trim();

            if (
              href &&
              href.includes("-jobs") &&
              text.length > 2 &&
              text.length < 50 &&
              !text.toLowerCase().includes("show") &&
              !text.toLowerCase().includes("more") &&
              jobLinks.length < 2
            ) {
              jobLinks.push({
                name: text,
                href: href.startsWith("http")
                  ? href
                  : `https://www.zippia.com${href}`,
              });
            }
          }

          return jobLinks;
        });
      }

      if (jobLinks.length > 0) {
        console.log(
          `Found ${jobLinks.length} job links to crawl:`,
          jobLinks.map((j) => j.name)
        );
        return jobLinks;
      } else {
        throw new Error("No job links found on page");
      }
    } catch (error) {
      console.log(
        "Error getting job list from page, using fallback...",
        error.message
      );
      // Fallback to hardcoded jobs if page loading fails
      const jobLinks = [
        {
          name: "Account Executive",
          href: "https://www.zippia.com/account-executive-jobs/",
        },
        {
          name: "Sales Representative",
          href: "https://www.zippia.com/sales-representative-jobs/",
        },
        // {
        //   name: "Sales Associate",
        //   href: "https://www.zippia.com/sales-associate-jobs/",
        // },
        // {
        //   name: "Sales Manager",
        //   href: "https://www.zippia.com/sales-manager-jobs/",
        // },
        // {
        //   name: "Sales Director",
        //   href: "https://www.zippia.com/sales-director-jobs/",
        // },
        // {
        //   name: "Business Development Representative",
        //   href: "https://www.zippia.com/business-development-representative-jobs/",
        // },
        // {
        //   name: "Customer Success Manager",
        //   href: "https://www.zippia.com/customer-success-manager-jobs/",
        // },
        // {
        //   name: "Account Manager",
        //   href: "https://www.zippia.com/account-manager-jobs/",
        // },
        // {
        //   name: "Sales Engineer",
        //   href: "https://www.zippia.com/sales-engineer-jobs/",
        // },
        // {
        //   name: "Regional Sales Manager",
        //   href: "https://www.zippia.com/regional-sales-manager-jobs/",
        // },
      ];

      console.log(
        `Using fallback: Found ${jobLinks.length} job links to crawl`
      );
      return jobLinks;
    }
  }

  async extractJobDetails(jobUrl, jobName) {
    console.log(`Crawling job details for: ${jobName}`);
    await this.navigateWithRetry(jobUrl);

    // Wait for content to load and simulate human behavior
    await this.simulateHumanBehavior();

    const jobData = {
      job_id: this.findJobId(jobName),
      job_name: jobName,
      parents: [],
      children: [],
      details: [],
      nextId: [],
    };

    // Extract job details
    const details = await this.extractJobDetailsSection();
    if (details) {
      jobData.details.push(details);
    }

    // Extract education data
    const educationData = await this.extractEducationData(jobUrl);
    if (educationData && details) {
      details.education = educationData;
    }

    // Extract nextId relationships
    const nextIdData = await this.extractNextIdData();
    jobData.nextId = nextIdData;

    return jobData;
  }

  async extractJobDetailsSection() {
    try {
      const details = await this.page.evaluate(() => {
        const result = {
          overview: "",
          salary: [{ salary_us: "", salary_vn: "", salary_average: "" }],
          stability_level: 0,
          diversity: [{ race: [] }, { gender: [] }, { age: [] }],
          stress_level: 0,
          complexity_level: 0,
          work_life_balance: 0,
          skills: [],
          pros_and_cons: { pros: [], cons: [] },
          requirements: [],
          job_description: "",
          meta_data: [],
        };

        // Extract overview
        try {
          const overviewDiv = document.querySelector("div.content.no-margin p");
          if (overviewDiv) {
            result.overview = overviewDiv.textContent.trim();
          }
        } catch (e) {
          console.log("Error extracting overview:", e);
        }

        // Extract salary and other data from bg-white z-p-20 sections
        try {
          const bgWhiteSections = document.querySelectorAll(".bg-white.z-p-20");

          bgWhiteSections.forEach((section, sectionIndex) => {
            const strongElements = section.querySelectorAll("strong");

            // Check for salary data in specific sections
            strongElements.forEach((strong) => {
              let text = strong.textContent.trim();

              // Loại bỏ tất cả ký tự không phải số
              let onlyNumber = text.replace(/[^0-9]/g, "");

              // Chỉ xử lý nếu có số
              if (!onlyNumber) return;

              const parentText = section.textContent.toLowerCase();

              if (
                parentText.includes("avg") ||
                parentText.includes("average")
              ) {
                const numericValue = parseInt(onlyNumber, 10);
                result.salary[0].salary_average = numericValue;
                result.salary[0].salary_us = numericValue;
                // Tính salary_vn
                if (!isNaN(numericValue)) {
                  result.salary[0].salary_vn = Math.round(numericValue / 5);
                } else {
                  result.salary[0].salary_vn = 0;
                }
              }

              // Check for stability level (growth rate %)
              if (text.includes("%")) {
                const parentText = section.textContent.toLowerCase();
                if (parentText.includes("growth")) {
                  // Chỉ lấy số, loại bỏ ký tự %
                  const numberOnly = text.replace(/[^0-9.]/g, "");
                  result.stability_level = parseFloat(numberOnly) || 0;
                }
              }
            });

            // Extract diversity data from sections that contain race/gender/age info
            const sectionText = section.textContent.toLowerCase();
            if (
              sectionText.includes("race") &&
              sectionText.includes("gender")
            ) {
              try {
                // Find race data
                const raceStrong = Array.from(strongElements).find(
                  (s) => s.textContent.trim().toLowerCase() === "race"
                );
                if (raceStrong) {
                  const raceData = [];
                  let currentEl = raceStrong.nextElementSibling;
                  while (currentEl && currentEl.tagName === "P") {
                    const raceText = currentEl.textContent.trim();
                    if (
                      raceText &&
                      !raceText.toLowerCase().includes("gender")
                    ) {
                      // Parse race text like "American Indian and Alaska Native 3.00%"
                      const match = raceText.match(/^(.+?)\s+([\d.]+)%?$/);
                      if (match) {
                        const groupName = match[1].trim();
                        const percentage = parseFloat(match[2]);
                        raceData.push({
                          group_name: groupName,
                          percentage: percentage,
                        });
                      } else {
                        // Fallback: if parsing fails, try to extract just group name
                        const cleanText = raceText
                          .replace(/[\d.%\s]+$/, "")
                          .trim();
                        if (cleanText.length > 0) {
                          raceData.push({
                            group_name: cleanText,
                            percentage: 0,
                          });
                        }
                      }
                    } else {
                      break;
                    }
                    currentEl = currentEl.nextElementSibling;
                  }

                  // Add Vietnam group with 5% of Asian percentage
                  const asianGroup = raceData.find((group) =>
                    group.group_name.toLowerCase().includes("asian")
                  );
                  if (asianGroup && asianGroup.percentage > 0) {
                    const vietnamPercentage = parseFloat(
                      (asianGroup.percentage * 0.05).toFixed(2)
                    );
                    raceData.push({
                      group_name: "Vietnam",
                      percentage: vietnamPercentage,
                    });
                  } else {
                    // If no Asian group found, add Vietnam with default 0.35% (5% of typical 7% Asian)
                    raceData.push({
                      group_name: "Vietnam",
                      percentage: 0.35,
                    });
                  }

                  result.diversity[0].race = raceData;
                }

                // Find gender data
                const genderStrong = Array.from(strongElements).find(
                  (s) => s.textContent.trim().toLowerCase() === "gender"
                );
                if (genderStrong) {
                  const genderObj = {};
                  let currentEl = genderStrong.nextElementSibling;
                  while (currentEl && currentEl.tagName === "P") {
                    const genderText = currentEl.textContent.trim();
                    if (
                      genderText &&
                      !genderText.toLowerCase().includes("age")
                    ) {
                      // Parse gender data like "female 47.00%" -> { female: 47 }
                      const match = genderText.match(/(\w+)\s+([\d.]+)%/);
                      if (match) {
                        const genderType = match[1];
                        const percentage = parseInt(parseFloat(match[2]));
                        genderObj[genderType] = percentage;
                      }
                    } else {
                      break;
                    }
                    currentEl = currentEl.nextElementSibling;
                  }
                  result.diversity[1].gender = genderObj;
                }

                // Find age data
                const ageStrong = Array.from(strongElements).find((s) =>
                  s.textContent.trim().toLowerCase().includes("age")
                );
                if (ageStrong) {
                  // Lấy số tuổi từ chuỗi, lưu thành object { age: số }
                  const ageText = ageStrong.textContent.trim();
                  const ageMatch = ageText.match(/(\d+)/);
                  if (ageMatch) {
                    result.diversity[2].age = parseInt(ageMatch[1], 10);
                  } else {
                    result.diversity[2].age = 0;
                  }
                }
              } catch (e) {
                console.log("Error extracting diversity from section:", e);
              }
            }

            // Extract numeric values for stress, complexity, work-life balance
            const sectionTextContent = section.textContent.toLowerCase();
            if (
              sectionTextContent.includes("stress") &&
              sectionTextContent.includes("manageable")
            ) {
              // Try to find numeric stress level
              const stressMatch = section.textContent.match(/(\d+)/);
              if (stressMatch) {
                result.stress_level = parseInt(stressMatch[1]);
              }
            }

            // Look for complexity level
            if (sectionTextContent.includes("complex")) {
              const complexMatch = section.textContent.match(/(\d+)/);
              if (complexMatch) {
                result.complexity_level = parseInt(complexMatch[1]);
              }
            }

            // Look for work life balance
            if (
              sectionTextContent.includes("work") &&
              sectionTextContent.includes("life")
            ) {
              const wlbMatch = section.textContent.match(/(\d+)/);
              if (wlbMatch) {
                result.work_life_balance = parseInt(wlbMatch[1]);
              }
            }
          });

          // Extract stress_level, complexity_level, work_life_balance from specific bg-white z-p-20 sections
          const bgWhiteAllSections =
            document.querySelectorAll(".bg-white.z-p-20");

          // Extract stress_level from position 15 (index 14)
          if (bgWhiteAllSections[15] && !result.stress_level) {
            const pElement = bgWhiteAllSections[15].querySelector("p");
            if (pElement) {
              const numberMatch = pElement.textContent.match(/(\d+\.?\d*)/);
              if (numberMatch) {
                result.stress_level = parseInt(numberMatch[1]);
              }
            }
          }

          // Extract complexity_level from position 19 (index 18)
          if (bgWhiteAllSections[19] && !result.complexity_level) {
            const pElement = bgWhiteAllSections[19].querySelector("p");
            if (pElement) {
              const numberMatch = pElement.textContent.match(/(\d+\.?\d*)/);
              if (numberMatch) {
                result.complexity_level = parseInt(numberMatch[1]);
              }
            }
          }

          // Extract work_life_balance from position 23 (index 22)
          if (bgWhiteAllSections[23] && !result.work_life_balance) {
            const pElement = bgWhiteAllSections[23].querySelector("p");
            if (pElement) {
              const numberMatch = pElement.textContent.match(/(\d+\.?\d*)/);
              if (numberMatch) {
                result.work_life_balance = parseInt(numberMatch[1]);
              }
            }
          }

          // Look for specific work-life balance text indicators
          const workLifeSection = document.querySelector("*");
          const allText = document.body.textContent.toLowerCase();
          if (
            allText.includes("work life balance is poor") &&
            !result.work_life_balance
          ) {
            result.work_life_balance = 3; // Poor = 3/10
          } else if (
            allText.includes("work life balance is good") &&
            !result.work_life_balance
          ) {
            result.work_life_balance = 7; // Good = 7/10
          } else if (
            allText.includes("work life balance is manageable") &&
            !result.work_life_balance
          ) {
            result.work_life_balance = 6; // Manageable = 6/10
          }
        } catch (e) {
          console.log("Error extracting bg-white sections:", e);
        }

        return result;
      });

      // Extract skills by navigating to skills page
      try {
        // Navigate to skills page
        const currentUrl = this.page.url();
        const skillsUrl = currentUrl + "skills/";

        console.log(`Navigating to skills page: ${skillsUrl}`);
        await this.navigateWithRetry(skillsUrl);

        await this.simulateHumanBehavior();

        // Debug: Check what elements are available
        const pageInfo = await this.page.evaluate(() => {
          const info = {
            title: document.title,
            allLinks: document.querySelectorAll("a").length,
            pieChartLinks: document.querySelectorAll("a.pieChart_link__uaxuk")
              .length,
            listLinks: document.querySelectorAll("a.list-link").length,
            spans: document.querySelectorAll("span").length,
            boldSpans: document.querySelectorAll("span.openSansBlackBold")
              .length,
            allSpanClasses: Array.from(document.querySelectorAll("span"))
              .slice(0, 10)
              .map((s) => s.className),
          };
          return info;
        });

        console.log(`Page debug info:`, pageInfo);

        // Try to find skills with more generic selectors
        const skillsData = await this.page.evaluate(() => {
          const skills = [];

          // Get skill links and percentage spans separately
          const skillLinks = document.querySelectorAll(
            "a.pieChart_link__uaxuk"
          );
          const percentSpans = document.querySelectorAll(
            "span.openSansBlackBold"
          );

          console.log(
            `Found ${skillLinks.length} skill links and ${percentSpans.length} percent spans`
          );

          // Match skills with their percentages
          for (
            let i = 0;
            i < Math.min(skillLinks.length, percentSpans.length, 6);
            i++
          ) {
            const skillElement = skillLinks[i];
            const percentElement = percentSpans[i];

            if (skillElement && percentElement) {
              const skillName = skillElement.textContent.trim();
              const percentText = percentElement.textContent.trim();

              // Remove "%" symbol and convert to number
              const percentNumber =
                parseFloat(
                  percentText.replace("%", "").replace(/[^0-9.]/g, "")
                ) || 0;

              if (skillName && skillName.length > 0 && skillName.length < 50) {
                skills.push({
                  skill_name: skillName,
                  percent: percentNumber,
                  description: `${skillName} is an important skill for this role, representing ${percentNumber}% of the key competencies required.`,
                });
              }
            }
          }

          // Fallback: try other containers if no skills found
          if (skills.length === 0) {
            const possibleSkillContainers = [
              document.querySelectorAll("a.list-link"),
              document.querySelectorAll("[class*='skill']"),
              document.querySelectorAll("[class*='chart'] a"),
              document.querySelectorAll("div[class*='skill'] a"),
            ];

            for (let container of possibleSkillContainers) {
              if (container.length > 0) {
                console.log(`Found ${container.length} elements in container`);
                for (let i = 0; i < Math.min(container.length, 6); i++) {
                  const element = container[i];
                  const skillName = element.textContent.trim();

                  if (
                    skillName &&
                    skillName.length > 0 &&
                    skillName.length < 50
                  ) {
                    // Try to find percentage nearby
                    let percent = 0;

                    // Look for percentage in siblings or parent
                    const parent = element.parentElement;
                    if (parent) {
                      const percentMatch =
                        parent.textContent.match(/(\d+(?:\.\d+)?)%/);
                      if (percentMatch) {
                        percent = parseFloat(percentMatch[1]);
                      }
                    }

                    skills.push({
                      skill_name: skillName,
                      percent: percent,
                      description: `${skillName} is an important skill for this role, representing ${percent}% of the key competencies required.`,
                    });
                  }
                }

                if (skills.length > 0) break; // Use the first successful container
              }
            }
          }

          // Always add "Other Skills" as the last entry
          try {
            // Look for "Other Skills" element and get its percentage
            const otherSkillsElements = Array.from(
              document.querySelectorAll("*")
            ).filter((el) => el.textContent.trim() === "Other Skills");

            let otherSkillsPercent = 0;

            if (otherSkillsElements.length > 0) {
              const otherSkillsElement = otherSkillsElements[0];
              // Look for the next span element with percentage
              let nextElement = otherSkillsElement.nextElementSibling;
              while (nextElement) {
                if (
                  nextElement.tagName === "SPAN" &&
                  nextElement.textContent.includes("%")
                ) {
                  const percentText = nextElement.textContent.trim();
                  otherSkillsPercent =
                    parseFloat(
                      percentText.replace("%", "").replace(/[^0-9.]/g, "")
                    ) || 0;
                  break;
                }
                nextElement = nextElement.nextElementSibling;
              }

              // If not found in siblings, look in parent's next siblings
              if (otherSkillsPercent === 0) {
                const parent = otherSkillsElement.parentElement;
                if (parent && parent.nextElementSibling) {
                  const parentNext = parent.nextElementSibling;
                  const spanInParentNext = parentNext.querySelector("span");
                  if (
                    spanInParentNext &&
                    spanInParentNext.textContent.includes("%")
                  ) {
                    const percentText = spanInParentNext.textContent.trim();
                    otherSkillsPercent =
                      parseFloat(
                        percentText.replace("%", "").replace(/[^0-9.]/g, "")
                      ) || 0;
                  }
                }
              }
            }

            // Add "Other Skills" entry
            skills.push({
              skill_name: "Other Skills",
              percent: otherSkillsPercent,
              description: "Other Skills",
            });
          } catch (e) {
            console.log("Error adding Other Skills:", e);
            // Add default Other Skills entry even if extraction fails
            skills.push({
              skill_name: "Other Skills",
              percent: 0,
              description: "Other Skills",
            });
          }

          return skills;
        });

        console.log(`Found ${skillsData.length} skills on skills page`);
        details.skills = skillsData.length > 0 ? skillsData : [];

        // Navigate back to the main job page
        console.log(`Navigating back to main job page: ${currentUrl}`);
        await this.navigateWithRetry(currentUrl);

        await this.simulateHumanBehavior();
      } catch (e) {
        console.log("Error extracting skills:", e);
        // Fallback to basic skills extraction from current page
        try {
          console.log("Using fallback skills extraction...");
          const fallbackSkills = await this.page.evaluate(() => {
            const skillsArray = [];
            // Try to find skills on the current page
            const skillRows = document.querySelectorAll(
              "td.table_data__j0FRI.table-data.z-pl-20.z-py-14"
            );

            for (let i = 0; i < skillRows.length; i += 2) {
              if (skillRows[i] && skillRows[i + 1]) {
                const skillName = skillRows[i].textContent.trim();
                const percentText = skillRows[i + 1].textContent.trim();

                if (!skillName.includes("%") && percentText.includes("%")) {
                  // Remove "%" symbol and convert to number
                  const percentNumber =
                    parseFloat(
                      percentText.replace("%", "").replace(/[^0-9.]/g, "")
                    ) || 0;

                  skillsArray.push({
                    skill_name: skillName,
                    percent: percentNumber,
                    description: `${skillName} is a key skill for this position with ${percentNumber}% importance.`,
                  });
                }
              }
            }

            // Always add "Other Skills" as the last entry in fallback
            skillsArray.push({
              skill_name: "Other Skills",
              percent: 0,
              description: "Other Skills",
            });

            return skillsArray;
          });

          console.log(`Fallback found ${fallbackSkills.length} skills`);
          details.skills = fallbackSkills;
        } catch (fallbackError) {
          console.log("Fallback skills extraction failed:", fallbackError);
          details.skills = [];
        }
      }

      // Extract pros and cons
      try {
        const prosAndCons = await this.page.evaluate(() => {
          const prosConsList = document.querySelectorAll("ul.large-bullets");
          const result = { pros: [], cons: [] };

          if (prosConsList.length >= 2) {
            const prosItems = prosConsList[0].querySelectorAll("li");
            const consItems = prosConsList[1].querySelectorAll("li");

            result.pros = Array.from(prosItems).map((li) =>
              li.textContent.trim()
            );
            result.cons = Array.from(consItems).map((li) =>
              li.textContent.trim()
            );
          }
          return result;
        });

        details.pros_and_cons = prosAndCons;
      } catch (e) {
        console.log("Error extracting pros and cons:", e);
      }

      // Extract requirements
      try {
        // Try to click show more button for requirements
        const showMoreReqButton = await this.page.$(
          "button.zpShowMoreButton_stl__puwqJ.d-block.w-auto.p-0"
        );
        if (showMoreReqButton) {
          await showMoreReqButton.click();
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        const requirements = await this.page.evaluate(() => {
          const reqArray = [];
          const reqTitles = document.querySelectorAll(
            "p.horizontalChartBarSection_h-chart-bar-title__o3zSI"
          );
          const reqLevels = document.querySelectorAll(
            "div.horizontalChartBarSection_h-chart-progress-bar-value__9I8Df"
          );

          for (
            let i = 0;
            i < Math.min(reqTitles.length, reqLevels.length);
            i++
          ) {
            const levelText = reqLevels[i].textContent.trim();
            // Remove "%" symbol and convert to number
            const levelNumber =
              parseFloat(levelText.replace("%", "").replace(/[^0-9.]/g, "")) ||
              0;

            reqArray.push({
              requirement: reqTitles[i].textContent.trim(),
              level: levelNumber,
            });
          }
          return reqArray;
        });

        details.requirements = requirements;
      } catch (e) {
        console.log("Error extracting requirements:", e);
      }

      // Extract meta data
      try {
        const metaData = await this.page.evaluate(() => {
          const metaArray = [];
          const metaHeaders = document.querySelectorAll(
            "h3.z-mb-24.z-ml-40.z-ml-md-0"
          );

          metaHeaders.forEach((header) => {
            const nextDiv = header.nextElementSibling;
            if (nextDiv) {
              metaArray.push({
                info_name: header.textContent.trim(),
                info_value: nextDiv.textContent.trim(),
              });
            }
          });
          return metaArray;
        });

        details.meta_data = metaData;
      } catch (e) {
        console.log("Error extracting meta data:", e);
      }

      return details;
    } catch (error) {
      console.error("Error extracting job details:", error);
      return null;
    }
  }

  async extractEducationData(jobUrl) {
    try {
      // Navigate to education page
      const educationUrl = jobUrl + "education/";
      console.log(`Navigating to education page: ${educationUrl}`);

      await this.navigateWithRetry(educationUrl);

      await this.simulateHumanBehavior();

      const educationData = await this.page.evaluate(() => {
        const education = {
          description: "",
          degree: [],
          major: [],
          courses: [],
        };

        // Extract description from div.w-730.z-mb-48
        try {
          const descriptionDiv = document.querySelector("div.w-730.z-mb-48");
          if (descriptionDiv) {
            education.description = descriptionDiv.textContent.trim();
          }
        } catch (e) {
          console.log("Error extracting education description:", e);
        }

        // Extract degree data
        try {
          const degreeElements = document.querySelectorAll(
            "span.pieChart_separator__kqQWq.pie-chart-legend-separator.d-inline-block"
          );
          degreeElements.forEach((separator) => {
            const nameSpan = separator.nextElementSibling;
            if (
              nameSpan &&
              nameSpan.tagName === "SPAN" &&
              !nameSpan.className
            ) {
              const name = nameSpan.textContent.trim();

              // Skip generic or invalid degree names
              if (
                name.toLowerCase().includes("other majors") ||
                name.toLowerCase().includes("major") ||
                name.length < 3
              ) {
                return;
              }

              // Find the corresponding percentage span
              let percentSpan = nameSpan.nextElementSibling;
              while (
                percentSpan &&
                !percentSpan.classList.contains("openSansBlackBold")
              ) {
                percentSpan = percentSpan.nextElementSibling;
              }

              if (
                percentSpan &&
                percentSpan.classList.contains("openSansBlackBold")
              ) {
                const percentText = percentSpan.textContent.trim();
                const level =
                  parseFloat(
                    percentText.replace("%", "").replace(/[^0-9.]/g, "")
                  ) || 0;

                // Only add valid degrees with positive levels
                if (level > 0) {
                  education.degree.push({
                    name: name,
                    level: level,
                  });
                }
              }
            }
          });
        } catch (e) {
          console.log("Error extracting degree data:", e);
        }

        // Extract major data with show more functionality
        try {
          // Click show more buttons to expand major list
          const showMoreSelectors = [
            "div.list-link.z-mt-16.z-font-600.show-more-button.table_show-more__v1UoX",
            "div.show-more-button",
            "div.table_show-more__v1UoX",
            "div[class*='show-more']",
            "button[class*='show-more']",
            ".show-more-button",
            "[class*='show-more-button']",
          ];

          // Click all found show more buttons
          for (const selector of showMoreSelectors) {
            const buttons = document.querySelectorAll(selector);
            if (buttons.length > 0) {
              buttons.forEach((btn) => {
                try {
                  btn.click();
                } catch (e) {
                  // ignore click errors
                }
              });
              break; // Only try the first successful selector
            }
          }

          // Wait for content to load after clicking
          const start = Date.now();
          while (Date.now() - start < 1000) {
            // Wait 1000ms for content to fully load
          }

          // Extract major data from table rows - try different selectors
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
                const levelElement = row.querySelector(
                  "td[class*='table_data'], td"
                );

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
        } catch (e) {
          console.log("Error extracting major data:", e);
        }

        // Extract courses data with show more functionality
        try {
          // Find and click all "See more [job] courses" buttons
          let seeMoreClicked = 0;
          let maxClicks = 10; // Prevent infinite loops

          while (seeMoreClicked < maxClicks) {
            // Look for "See more" buttons with text content matching courses pattern
            const seeMoreButtons = Array.from(
              document.querySelectorAll("*")
            ).filter((el) => {
              const text = el.textContent || "";
              return (
                text.toLowerCase().includes("see more") &&
                text.toLowerCase().includes("courses") &&
                (el.tagName === "BUTTON" ||
                  el.tagName === "A" ||
                  el.tagName === "DIV")
              );
            });

            // Also try specific selectors for course show more buttons
            const courseShowMoreSelectors = [
              "button.zpButton_button__1H39q.zpButton_primary__Mhrhl.zpButton_big__j7cK3.zpButton_auto-width__152UA",
              "button[class*='zpButton']",
              "button[class*='show-more']",
              "div[class*='show-more']",
              "a[class*='show-more']",
              "*[class*='show-more-button']",
            ];

            let showMoreButton = null;

            // First try the text-based approach
            if (seeMoreButtons.length > 0) {
              showMoreButton = seeMoreButtons[0];
            } else {
              // Fallback to selector-based approach
              for (const selector of courseShowMoreSelectors) {
                const buttons = document.querySelectorAll(selector);
                if (buttons.length > 0) {
                  showMoreButton = buttons[0];
                  break;
                }
              }
            }

            // If no show more button found, break
            if (!showMoreButton) {
              break;
            }

            try {
              // Click the button
              showMoreButton.click();
              seeMoreClicked++;

              // Wait for content to load using sync approach
              const start = Date.now();
              while (Date.now() - start < 1000) {
                // Wait 1000ms for new courses to load
              }
            } catch (clickError) {
              console.log(
                "Error clicking see more courses button:",
                clickError
              );
              break;
            }
          }

          // Extract all course data after clicking all show more buttons
          const courseTitles = document.querySelectorAll(
            "p.cmpSectionh4.z-mb-9.coursesSection_course-title__68ZcW, p[class*='course-title'], h3[class*='course'], h4[class*='course'], .course-title"
          );
          const courseRanks = document.querySelectorAll(
            "span.openSansBlackBold.coursesSection_rating-number__sPIcM, span[class*='rating-number'], span[class*='rating'], .rating-number"
          );
          const reviewCounts = document.querySelectorAll(
            "span.lightTextStyle2.mx-0.coursesSection_total-rating__oVAyX, span[class*='total-rating'], span[class*='review'], .review-count"
          );

          // Try multiple selectors for course links
          let courseLinks = document.querySelectorAll(
            "a.border.z-br-pill.z-px-20.z-mr-24.z-py-6.LightTextStyle.coursesSection_see-more-link__coF75"
          );

          if (courseLinks.length === 0) {
            // Try alternative selectors
            courseLinks = document.querySelectorAll(
              "a[class*='see-more-link'], a[href*='udemy.com'], a[href*='course'], a[href*='linksynergy']"
            );
          }

          if (courseLinks.length === 0) {
            // Try even broader selectors
            courseLinks = document.querySelectorAll("a[href^='http']");
          }

          console.log(
            `Found ${courseLinks.length} course links using selectors`
          );

          // Debug: Check what links are available
          if (courseLinks.length > 0) {
            console.log("Sample course links found:");
            Array.from(courseLinks)
              .slice(0, 3)
              .forEach((link, i) => {
                console.log(
                  `${i + 1}: ${
                    link.href || link.getAttribute("href") || "NO HREF"
                  } (${link.textContent.trim().substring(0, 50)})`
                );
              });
          } else {
            // Check what kinds of links exist on the page
            const allLinks = document.querySelectorAll("a[href]");
            console.log(
              `No course-specific links found. Total links on page: ${allLinks.length}`
            );
            if (allLinks.length > 0) {
              console.log("Sample of all links:");
              Array.from(allLinks)
                .slice(0, 5)
                .forEach((link, i) => {
                  console.log(
                    `${i + 1}: ${
                      link.href || link.getAttribute("href")
                    } (${link.textContent.trim().substring(0, 30)})`
                  );
                });
            }
          }

          // Extract courses data
          for (
            let i = 0;
            i <
            Math.min(
              courseTitles.length,
              courseRanks.length,
              reviewCounts.length
            );
            i++
          ) {
            const courseTitle = courseTitles[i].textContent.trim();
            const rank = parseFloat(courseRanks[i].textContent.trim()) || 0;
            const reviewText = reviewCounts[i].textContent.trim();
            const reviewCount =
              parseInt(reviewText.replace(/[^0-9]/g, "")) || 0;

            // Get course URL - try multiple approaches
            let courseUrl = "";

            // Approach 1: Direct index match
            if (courseLinks[i]) {
              courseUrl =
                courseLinks[i].href ||
                courseLinks[i].getAttribute("href") ||
                "";
            }

            // Approach 2: Find link in same parent container as title
            if (!courseUrl) {
              const titleElement = courseTitles[i];
              const parentContainer = titleElement.closest(
                "div, section, article, li"
              );
              if (parentContainer) {
                const nearbyLink = parentContainer.querySelector(
                  'a[href*="udemy.com"], a[href*="course"], a[href*="linksynergy"], a[class*="see-more"], a[class*="link"]'
                );
                if (nearbyLink) {
                  courseUrl =
                    nearbyLink.href || nearbyLink.getAttribute("href") || "";
                }
              }
            }

            // Approach 3: Look for links in next few sibling elements
            if (!courseUrl) {
              const titleElement = courseTitles[i];
              let nextSibling = titleElement.nextElementSibling;
              let attempts = 0;
              while (nextSibling && attempts < 5) {
                const linkInSibling = nextSibling.querySelector(
                  'a[href*="udemy.com"], a[href*="course"], a[href*="linksynergy"], a[class*="see-more"], a[class*="link"]'
                );
                if (linkInSibling) {
                  courseUrl =
                    linkInSibling.href ||
                    linkInSibling.getAttribute("href") ||
                    "";
                  break;
                }
                nextSibling = nextSibling.nextElementSibling;
                attempts++;
              }
            }

            // Approach 4: Look in parent's siblings
            if (!courseUrl) {
              const titleElement = courseTitles[i];
              const parent = titleElement.parentElement;
              if (parent) {
                let parentSibling = parent.nextElementSibling;
                let attempts = 0;
                while (parentSibling && attempts < 3) {
                  const linkInParentSibling = parentSibling.querySelector(
                    'a[href*="udemy.com"], a[href*="course"], a[href*="linksynergy"], a[class*="see-more"], a[class*="link"]'
                  );
                  if (linkInParentSibling) {
                    courseUrl =
                      linkInParentSibling.href ||
                      linkInParentSibling.getAttribute("href") ||
                      "";
                    break;
                  }
                  parentSibling = parentSibling.nextElementSibling;
                  attempts++;
                }
              }
            }

            if (courseTitle && courseTitle.length > 5) {
              // Filter out empty or too short titles
              education.courses.push({
                course_title: courseTitle,
                rank: rank,
                review_count: reviewCount,
                course_url: courseUrl,
              });
            }
          }

          // If we didn't get enough courses with the above selectors, try alternative approach
          if (education.courses.length < 5) {
            // Try alternative selectors
            const altCourseTitles = document.querySelectorAll(
              "h3, h4, p, div[class*='course'], div[class*='title']"
            );

            for (
              let i = 0;
              i < altCourseTitles.length && education.courses.length < 20;
              i++
            ) {
              const title = altCourseTitles[i].textContent.trim();
              if (
                title.length > 10 &&
                (title.includes("Course") ||
                  title.includes("Training") ||
                  title.includes("Masterclass") ||
                  title.match(/^\d+\.\s/))
              ) {
                // Matches numbered lists like "1. Course Name"

                // Try to find rating and review count near this title
                let rank = 0;
                let reviewCount = 0;
                let courseUrl = "";

                // Look in next few siblings for rating data and course URL
                let nextEl = altCourseTitles[i].nextElementSibling;
                for (let j = 0; j < 5 && nextEl; j++) {
                  const text = nextEl.textContent;
                  if (text.includes("★") || text.match(/\d\.\d/)) {
                    rank = parseFloat(text.match(/\d\.\d/)?.[0]) || 0;
                  }
                  if (text.match(/\d+.*reviews?/i) || text.match(/\(\d+\)/)) {
                    reviewCount = parseInt(text.match(/\d+/)?.[0]) || 0;
                  }
                  // Look for course link in siblings with broader selectors
                  const linkInSibling = nextEl.querySelector(
                    'a[href*="udemy.com"], a[href*="course"], a[href*="linksynergy"], a[class*="see-more"], a[class*="link"], a[href]'
                  );
                  if (linkInSibling) {
                    courseUrl =
                      linkInSibling.href ||
                      linkInSibling.getAttribute("href") ||
                      "";
                    if (courseUrl) break;
                  }
                  nextEl = nextEl.nextElementSibling;
                }

                // Also try to find course URL in parent container with enhanced search
                if (!courseUrl) {
                  const parentContainer = altCourseTitles[i].closest(
                    "div, section, article, li, td, tr"
                  );
                  if (parentContainer) {
                    // Try multiple selectors for better coverage
                    const linkSelectors = [
                      'a[href*="udemy.com"]',
                      'a[href*="course"]',
                      'a[href*="linksynergy"]',
                      'a[class*="see-more"]',
                      'a[class*="link"]',
                      'a[href^="http"]',
                      "a[href]",
                    ];

                    for (const selector of linkSelectors) {
                      const nearbyLink =
                        parentContainer.querySelector(selector);
                      if (nearbyLink) {
                        const href =
                          nearbyLink.href ||
                          nearbyLink.getAttribute("href") ||
                          "";
                        if (
                          href &&
                          (href.includes("udemy.com") ||
                            href.includes("course") ||
                            href.includes("linksynergy"))
                        ) {
                          courseUrl = href;
                          break;
                        }
                      }
                    }
                  }
                }

                // If still no URL, try to find any link in the same row/container
                if (!courseUrl) {
                  const rowContainer =
                    altCourseTitles[i].closest("tr, div, li");
                  if (rowContainer) {
                    const anyLink =
                      rowContainer.querySelector('a[href^="http"]');
                    if (anyLink) {
                      courseUrl =
                        anyLink.href || anyLink.getAttribute("href") || "";
                    }
                  }
                }

                education.courses.push({
                  course_title: title,
                  rank: rank,
                  review_count: reviewCount,
                  course_url: courseUrl,
                });
              }
            }
          }
        } catch (e) {
          console.log("Error extracting courses data:", e);
        }

        return education;
      });

      console.log(
        `Found education data: ${educationData.degree.length} degrees, ${educationData.major.length} majors, ${educationData.courses.length} courses`
      );

      // Navigate back to the main job page
      console.log(`Navigating back to main job page: ${jobUrl}`);
      await this.navigateWithRetry(jobUrl);

      await this.simulateHumanBehavior();

      return educationData;
    } catch (error) {
      console.error("Error extracting education data:", error);
      // Navigate back to main page in case of error
      try {
        await this.navigateWithRetry(jobUrl);
      } catch (navError) {
        console.error("Error navigating back to main page:", navError);
      }
      return null;
    }
  }

  async extractNextIdData() {
    try {
      const nextIdData = await this.page.evaluate(() => {
        const careerPathRows = document.querySelectorAll(
          "div.d-flex.align-items-end.position-relative.careerPaths_row__kyPft.careerPaths_right__ME3vJ.z-ml-30.careerPaths_bottom__3Kj_O.careerPaths_even__xslbY"
        );
        const result = [];

        careerPathRows.forEach((row) => {
          const infoDiv = row.querySelector(
            "div.careerPaths_info__zncVb.careerPaths_right__ME3vJ.text-right"
          );
          if (infoDiv) {
            const titleElement = infoDiv.querySelector(
              "p.z-m-0.z-font-14.z-leading-14px.line-clamp-3.careerPaths_title__SY2KB.careerPaths_link__E78bU.z-mb-6"
            );
            if (titleElement) {
              const jobTitle = titleElement.textContent.trim();
              result.push({
                jobtitle: jobTitle,
                jobid: "", // Will be filled by findJobId method
              });
            }
          }
        });

        return result;
      });

      // Fill in job IDs
      const processedNextId = nextIdData.map((item) => ({
        jobtitle: item.jobtitle,
        jobid: this.findJobId(item.jobtitle),
      }));

      return processedNextId;
    } catch (error) {
      console.error("Error extracting nextId data:", error);
      return [];
    }
  }

  async crawlJobs() {
    try {
      // Get list of jobs to crawl
      const jobsList = await this.getJobsList();

      for (const job of jobsList) {
        try {
          // Extract details for each job
          const jobData = await this.extractJobDetails(job.href, job.name);

          // Save job data to file
          await this.saveJobData(jobData);

          // Wait between requests to be respectful
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (error) {
          console.error(`Error crawling job ${job.name}:`, error);
        }
      }

      console.log("Crawling completed successfully!");
    } catch (error) {
      console.error("Error in crawling process:", error);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const crawler = new ZippiaCrawler();

  try {
    await crawler.init();
    await crawler.crawlJobs();
  } catch (error) {
    console.error("Main execution error:", error);
  } finally {
    await crawler.close();
  }
}

// Run the crawler
main().catch(console.error);
