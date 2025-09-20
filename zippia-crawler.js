import puppeteer from "puppeteer";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

export class ZippiaCrawler {
  constructor() {
    this.browser = null;
    this.page = null;
    this.dataFile = "zippia-jobs.json";
    this.existingData = [];
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });

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
    // Add to existing data array
    this.existingData.push(jobData);

    // Save to file
    await fs.writeFile(
      this.dataFile,
      JSON.stringify(this.existingData, null, 2)
    );
    console.log(`Saved job: ${jobData.job_name}`);
  }

  async getJobsList() {
    console.log("Navigating to Zippia sales industry page...");
    await this.page.goto("https://www.zippia.com/sales-industry/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for job links to load
    await this.page.waitForSelector("a.list-link", { timeout: 10000 });

    // Get first 5 job links
    const jobLinks = await this.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a.list-link")).slice(
        0,
        5
      );
      return links.map((link) => ({
        name: link.textContent.trim(),
        href: link.href,
      }));
    });

    console.log(`Found ${jobLinks.length} job links to crawl`);
    return jobLinks;
  }

  async extractJobDetails(jobUrl, jobName) {
    console.log(`Crawling job details for: ${jobName}`);
    await this.page.goto(jobUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for content to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

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
          stability_level: [{ stability_level_average: "" }],
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
              const text = strong.textContent.trim();

              if (text.includes("$")) {
                // Check if this is average salary or specific salary
                const parentText = section.textContent.toLowerCase();

                if (
                  parentText.includes("avg") ||
                  parentText.includes("average")
                ) {
                  result.salary[0].salary_average = text;
                  result.salary[0].salary_us = text;
                  // Calculate VN salary (divide by 5)
                  const numericValue = parseFloat(text.replace(/[$,]/g, ""));
                  if (!isNaN(numericValue)) {
                    result.salary[0].salary_vn = (numericValue / 5).toString();
                  }
                }
              }

              // Check for stability level (growth rate %)
              if (text.includes("%")) {
                const parentText = section.textContent.toLowerCase();
                if (parentText.includes("growth")) {
                  result.stability_level[0].stability_level_average = text;
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
                      raceData.push(raceText);
                    } else {
                      break;
                    }
                    currentEl = currentEl.nextElementSibling;
                  }
                  result.diversity[0].race = raceData;
                }

                // Find gender data
                const genderStrong = Array.from(strongElements).find(
                  (s) => s.textContent.trim().toLowerCase() === "gender"
                );
                if (genderStrong) {
                  const genderData = [];
                  let currentEl = genderStrong.nextElementSibling;
                  while (currentEl && currentEl.tagName === "P") {
                    const genderText = currentEl.textContent.trim();
                    if (
                      genderText &&
                      !genderText.toLowerCase().includes("age")
                    ) {
                      genderData.push(genderText);
                    } else {
                      break;
                    }
                    currentEl = currentEl.nextElementSibling;
                  }
                  result.diversity[1].gender = genderData;
                }

                // Find age data
                const ageStrong = Array.from(strongElements).find((s) =>
                  s.textContent.trim().toLowerCase().includes("age")
                );
                if (ageStrong) {
                  result.diversity[2].age = [ageStrong.textContent.trim()];
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

          // Additional extraction from summary table for numeric ratings
          const summaryTable = document.querySelector(
            ".summaryTable_table__pE4KH"
          );
          if (summaryTable) {
            const summaryText = summaryTable.textContent;

            // Extract salary rating (like 5.4)
            const salaryMatch = summaryText.match(/Salary\s*(\d+\.?\d*)/i);
            if (salaryMatch && !result.stress_level) {
              // Use salary rating as stress level if not found elsewhere
              result.stress_level = Math.round(parseFloat(salaryMatch[1]));
            }

            // Extract stability level rating (like 6.4)
            const stabilityMatch = summaryText.match(
              /Stability\s*level\s*(\d+\.?\d*)/i
            );
            if (stabilityMatch && !result.complexity_level) {
              result.complexity_level = Math.round(
                parseFloat(stabilityMatch[1])
              );
            }

            // Extract diversity rating (like 7.0)
            const diversityMatch = summaryText.match(
              /Diversity\s*(\d+\.?\d*)/i
            );
            if (diversityMatch && !result.work_life_balance) {
              result.work_life_balance = Math.round(
                parseFloat(diversityMatch[1])
              );
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

      // Extract skills with show more button handling
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Try to click show more button for skills
        const showMoreButton = await this.page.$(
          "div.list-link.z-mt-16.z-font-600.show-more-button.table_show-more__v1UoX"
        );
        if (showMoreButton) {
          await showMoreButton.click();
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        const skills = await this.page.evaluate(() => {
          const skillsArray = [];
          const skillRows = document.querySelectorAll(
            "td.table_data__j0FRI.table-data.z-pl-20.z-py-14"
          );

          for (let i = 0; i < skillRows.length; i += 2) {
            if (skillRows[i] && skillRows[i + 1]) {
              const skillName = skillRows[i].textContent.trim();
              const percentText = skillRows[i + 1].textContent.trim();

              if (!skillName.includes("%") && percentText.includes("%")) {
                skillsArray.push({
                  skill_name: skillName,
                  percent: parseInt(percentText.replace("%", "")) || 0,
                });
              }
            }
          }
          return skillsArray;
        });

        details.skills = skills;
      } catch (e) {
        console.log("Error extracting skills:", e);
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
            reqArray.push({
              requirement: reqTitles[i].textContent.trim(),
              level: reqLevels[i].textContent.trim(),
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
