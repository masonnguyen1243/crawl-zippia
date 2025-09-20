import puppeteer from "puppeteer";
import { writeFile } from "fs/promises";

async function crawlCompanies() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://jobsgo.vn/cong-ty-san-xuat-trang-8.html", {
    waitUntil: "networkidle2",
  });

  // Lấy danh sách link chi tiết công ty trên trang đầu tiên
  const companyLinks = await page.$$eval(".grid-item", (links) =>
    links.map((link) => link.href)
  );
  //   .slice(0, 2);

  const results = [];
  for (const link of companyLinks) {
    await page.goto(link, { waitUntil: "networkidle2" });
    // Lấy thông tin công ty
    const companyData = await page.evaluate(() => {
      const companyName =
        document
          .querySelector(".fw-bolder.text-dark.fs-3.mb-2.w-100")
          ?.innerText?.trim() || "";
      const description =
        document
          .querySelector("#company-description")
          ?.innerText?.replace(/\n/g, " ")
          ?.trim() || "";
      const industry =
        document
          .querySelector("span.company-category-list")
          ?.innerText?.replace(/\n/g, " ")
          ?.trim() || "";
      let size = "";
      let location = [];
      let companyEmail = "";
      let companyPhone = "";
      let companyUrl = "";

      // Tìm tất cả các thẻ a có rel="nofollow"
      document.querySelectorAll('a[rel="nofollow"]').forEach((el) => {
        const text = el.innerText?.trim() || el.textContent?.trim() || "";
        if (text.includes("@")) companyEmail = text;
        if (/\d{8,}/.test(text)) companyPhone = text;
        if (text.includes(".com")) companyUrl = text;
      });
      const locationElements = document.querySelectorAll(
        "span.text-primary.fw-bold.detail"
      );
      location = Array.from(locationElements).map((el) => {
        // Loại bỏ text trong các thẻ a con
        const clone = el.cloneNode(true);
        Array.from(clone.querySelectorAll("a")).forEach((a) => a.remove());
        return clone.innerText.trim();
      });
      return {
        companyName,
        companyEmail,
        description,
        companyPhone,
        companyUrl,
        size,
        industry,
        location,
      };
    });

    // Lấy danh sách job của công ty
    const jobLinks = await page.$$eval(
      "a.text-decoration-none.text-dark.d-block.h-100",
      (els) => els.map((e) => e.href)
    );
    const jobs = [];
    for (const jobUrl of jobLinks) {
      await page.goto(jobUrl, { waitUntil: "networkidle2" });
      const jobData = await page.evaluate((companyUrl) => {
        const title =
          document
            .querySelector("h1.job-title.mb-2.mb-sm-3.fs-4")
            ?.innerText?.trim() || "";
        const company_info =
          document
            .querySelector("h6.fw-semibold.pe-3.mb-0.pt-4.mt-2")
            ?.innerText?.trim() || "";
        const company_url = companyUrl;
        const location =
          document
            .querySelector("div.location-extra.mt-2")
            ?.innerText?.trim() || "";

        //Budget
        let budget = null;
        const budgetSpan = document.querySelector(
          "span.text-truncate.d-inline-block"
        );
        if (budgetSpan) {
          const strong = budgetSpan.querySelector("strong");
          if (strong) {
            budget = strong.innerText.trim();
          }
        }

        //work arrangement
        let work_arrangement = document
          .querySelector(".work-type")
          ?.innerText?.trim();
        if (!work_arrangement) work_arrangement = "Onsite";
        // let job_type = document.querySelector(".job-type")?.innerText?.trim();
        let job_type = "";
        const jobDivs = document.querySelectorAll(
          "div.col-6.col-md-4.d-flex.align-items-start"
        );
        jobDivs.forEach((div) => {
          if (div.innerText.includes("Loại hình")) {
            const strong = div.querySelector("strong");
            if (strong) {
              job_type = strong.innerText.trim();
            }
          }
        });
        if (!job_type) job_type = "Fulltime";

        // Lấy thẻ div đầu tiên bên trong div.job-detail-card
        const descEls = document.querySelectorAll("div.job-detail-card");
        let description = "";
        if (descEls[0]) {
          const firstInnerDiv = descEls[0].querySelector("div");
          if (firstInnerDiv) {
            description =
              firstInnerDiv.innerText?.replace(/\n/g, " ")?.trim() || "";
          }
        }

        // Lấy requirements (nếu có)
        const jobDetailCard = document.querySelector("div.job-detail-card");
        let requirements = [];
        if (jobDetailCard) {
          const innerDivs = jobDetailCard.querySelectorAll("div");
          if (innerDivs[1]) {
            requirements = innerDivs[1].innerText
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.length > 0);
          }
        }

        // Lấy skills (nếu có)
        // Hàm lấy ra các keyword quan trọng từ description và requirements
        function extractSkills(description, requirements) {
          // Danh sách các từ khóa kỹ năng phổ biến, có thể mở rộng thêm
          const keywords = [
            "excel",
            "word",
            "powerpoint",
            "photoshop",
            "canva",
            "tiktok",
            "capcut",
            "adobe",
            "marketing",
            "sales",
            "bán hàng",
            "tư vấn",
            "giao tiếp",
            "làm việc nhóm",
            "lập kế hoạch",
            "quản lý",
            "tiếng anh",
            "english",
            "kỹ năng mềm",
            "kỹ năng giao tiếp",
            "kỹ năng lãnh đạo",
            "cầu tiến",
            "chủ động",
            "sáng tạo",
            "phân tích",
            "sql",
            "python",
            "javascript",
            "nodejs",
            "java",
            "c#",
            "html",
            "css",
            "react",
            "vue",
            "angular",
            "ai",
            "machine learning",
            "seo",
            "google ads",
            "facebook ads",
            "crm",
            "erp",
            "autocad",
            "solidworks",
            "qa",
            "qc",
            "qa/qc",
            "thiết kế",
            "quản trị",
            "phân tích dữ liệu",
            "data analysis",
            "project management",
            "scrum",
            "kanban",
            "git",
            "github",
            "gitlab",
            "docker",
            "kubernetes",
            "linux",
            "windows",
            "macos",
            "bán vé",
            "chăm sóc khách hàng",
            "telesales",
            "bảo trì",
            "bảo dưỡng",
            "bảo mật",
            "network",
            "phần mềm",
            "phần cứng",
            "công nghệ thông tin",
            "it",
            "erp",
            "sap",
            "oracle",
            "sql server",
            "python",
            "java",
            "c++",
            "typescript",
            "reactjs",
            "vuejs",
            "angularjs",
            "node.js",
            "express",
            "mongodb",
            "mysql",
            "postgresql",
            "firebase",
            "aws",
            "azure",
            "gcp",
            "cloud",
            "docker",
            "ci/cd",
          ];
          const text = (
            description +
            " " +
            (requirements || []).join(" ")
          ).toLowerCase();
          // Lọc ra các từ khóa xuất hiện trong text
          return keywords.filter((kw) => text.includes(kw));
        }

        let skills = Array.from(document.querySelectorAll(".tag-skill")).map(
          (e) => e.innerText.trim()
        );
        // Nếu không có .tag-skill thì tự động lấy từ description và requirements
        if (!skills.length) {
          skills = extractSkills(description, requirements);
        }

        const status = "Open";
        let createdAt = "";
        const divs = document.querySelectorAll(
          "div.col-6.col-md-4.d-flex.align-items-start"
        );
        divs.forEach((div) => {
          if (div.innerText.includes("Ngày đăng tuyển")) {
            const strong = div.querySelector("strong");
            if (strong) {
              createdAt = strong.innerText.trim();
            }
          }
        });

        let application_deadline = null;
        const deadlineLi = document.querySelector(
          "li.col-md-auto.col-date.d-flex.align-items-center.mb-2.mb-md-0"
        );
        if (deadlineLi) {
          const strong = deadlineLi.querySelector("strong");
          if (strong) {
            application_deadline = strong.innerText.trim();
          }
        }

        return {
          title,
          company_info,
          company_url,
          location,
          work_arrangement,
          job_type,
          description,
          budget,
          skills,
          requirements,
          status,
          createdAt,
          updatedAt: null,
          job_url: window.location.href,
          application_deadline,
        };
      }, companyData.companyUrl);
      jobs.push(jobData);
      // Đợi 1s để tránh bị chặn
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Đưa về đúng format mẫu
    results.push({
      companyName: companyData.companyName,
      companyUrl: companyData.companyUrl,
      description: companyData.description,
      size: companyData.size,
      industry: companyData.industry,
      location: companyData.location,
      companyEmail: companyData.companyEmail,
      companyPhone: companyData.companyPhone,
      jobs,
    });
    // Đợi 1s để tránh bị chặn
    await new Promise((r) => setTimeout(r, 1000));
  }

  await browser.close();
  await writeFile("jobsgo.json", JSON.stringify(results, null, 2), "utf-8");
  console.log(
    `Đã lưu kết quả vào jobsgo.json. Số lượng công ty đã cào: ${results.length}`
  );
  return results;
}

// Chạy thử
crawlCompanies();
