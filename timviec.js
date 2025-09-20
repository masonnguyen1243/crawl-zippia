import puppeteer from "puppeteer";
import { writeFile } from "fs/promises";

async function crawlCompanies() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://timviec.com.vn/cong-ty", {
    waitUntil: "networkidle2",
  });

  // Lấy danh sách link chi tiết công ty trên trang đầu tiên
  const companyLinks = await page.$$eval(".show_html_xac_minh", (links) =>
    links.map((link) => link.href)
  );

  const results = [];
  for (const link of companyLinks) {
    await page.goto(link, { waitUntil: "networkidle2" });
    // Lấy thông tin công ty
    const companyData = await page.evaluate(() => {
      const companyName =
        document.querySelector(".company-name")?.innerText?.trim() || "";
      const description =
        document
          .querySelector(".content-about-text")
          ?.innerText?.replace(/\n/g, " ")
          ?.trim() || "";
      let size = "";
      let industry = "";
      let location = [];
      let companyEmail = "";
      let companyPhone = "";
      let companyUrl = "";

      // Tìm tất cả các thẻ span có rel="nofollow"
      document.querySelectorAll('span[rel="nofollow"]').forEach((el) => {
        const text = el.innerText?.trim() || el.textContent?.trim() || "";
        if (text.includes("@")) companyEmail = text;
        if (/\d{8,}/.test(text)) companyPhone = text;
        if (text.startsWith("http")) companyUrl = text;
      });
      const locationElements = document.querySelectorAll("p.address");
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
      ".text-ellipsis.color-555.titleItemJob",
      (els) => els.map((e) => e.href)
    );
    const jobs = [];
    for (const jobUrl of jobLinks) {
      await page.goto(jobUrl, { waitUntil: "networkidle2" });
      const jobData = await page.evaluate((companyUrl) => {
        const title = document.querySelector(".fs-24")?.innerText?.trim() || "";
        const company_info =
          document.querySelector(".company-name")?.innerText?.trim() || "";
        const company_url = companyUrl;
        const locationDivs = document.querySelectorAll("div.mb-10.lh-30");
        const location =
          locationDivs[locationDivs.length - 1]?.innerText?.trim() || "";
        let work_arrangement = document
          .querySelector(".work-type")
          ?.innerText?.trim();
        if (!work_arrangement) work_arrangement = "Onsite";
        let job_type = document.querySelector(".job-type")?.innerText?.trim();
        if (!job_type) job_type = "Fulltime";
        const descEls = document.querySelectorAll("div.mb-10.lh-30");
        const description =
          descEls[0]?.innerText?.replace(/\n/g, " ")?.trim() || "";
        // Lấy requirements (nếu có)
        // Tìm div chứa text đặc trưng như 'Yêu cầu', 'Kinh nghiệm', ...
        const divs = document.querySelectorAll("div.mb-10.lh-30");
        const div = divs[2];
        let requirements = [];
        if (div) {
          requirements = div.innerText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
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
        const createdAt = new Date()
          .toISOString()
          .replace("T", " ")
          .substring(0, 19);
        return {
          title,
          company_info,
          company_url,
          location,
          work_arrangement,
          job_type,
          description,
          budget: null,
          skills,
          requirements,
          status,
          createdAt,
          updatedAt: null,
          job_url: window.location.href,
          application_deadline: null,
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
  await writeFile("output.json", JSON.stringify(results, null, 2), "utf-8");
  console.log(
    `Đã lưu kết quả vào output.json. Số lượng công ty đã cào: ${results.length}`
  );
  return results;
}

// Chạy thử
crawlCompanies();
