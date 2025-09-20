import puppeteer from "puppeteer";
import { writeFile } from "fs/promises";

async function crawlCompanies() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(
    "https://www.vietnamworks.com/danh-sach-cong-ty?utm_source_navi=header&utm_medium_navi=allcompanies",
    {
      waitUntil: "networkidle2",
      timeout: 60000,
    }
  );

  // Bấm vào nút "Xem thêm" liên tục cho đến khi không còn nút hoặc không còn dữ liệu mới
  let loadMoreCount = 0;
  while (true) {
    try {
      await page.waitForSelector(
        "button.sc-fqkvVR.BsUMj.btn-default.btn-md.clickable",
        { visible: true, timeout: 2000 }
      );
    } catch (e) {
      // Không còn nút hoặc nút không hiển thị
      break;
    }
    const loadMoreBtn = await page.$(
      "button.sc-fqkvVR.BsUMj.btn-default.btn-md.clickable"
    );
    if (!loadMoreBtn) break;
    try {
      await loadMoreBtn.click();
      loadMoreCount++;
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      // Nếu không click được thì dừng
      break;
    }
  }
  if (loadMoreCount > 0) {
    console.log(
      `Đã bấm nút Xem thêm ${loadMoreCount} lần để load thêm dữ liệu.`
    );
  }

  // Lấy danh sách link chi tiết công ty trên trang đầu tiên (sau khi đã load thêm)
  const companyLinks = (
    await page.$$eval(".sc-iaJaUu.gwWXhn", (links) =>
      links.map((link) => link.href)
    )
  ).slice(20, 30);

  const results = [];
  for (const link of companyLinks) {
    await page.goto(link, { waitUntil: "networkidle2" });
    // Lấy thông tin công ty
    const companyData = await page.evaluate(() => {
      const companyName =
        document.querySelector("#cp_company_name")?.innerText?.trim() || "";
      const description =
        document
          .querySelector(".custom-story-item-content")
          ?.innerText?.replace(/\n/g, " ")
          ?.trim() || "";
      let size = "";
      let industry = "";
      let location = [];
      let companyEmail = "";
      let companyPhone = "";
      let companyUrl = "";

      // Tìm tất cả các thẻ span có rel="nofollow"
      document.querySelectorAll("a.website-company").forEach((el) => {
        const text = el.innerText?.trim() || el.textContent?.trim() || "";
        if (text.includes("@")) companyEmail = text;
        if (/\d{8,}/.test(text)) companyPhone = text;
        if (text.startsWith("http")) companyUrl = text;
      });

      //location
      const firstLocation = document.querySelector("span.li-items-limit");
      location = firstLocation ? [firstLocation.innerText.trim()] : [];
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
      'a[target="_blank"][data-new-job="New"]',
      (els = []) => Array.from(els).map((e) => e.href)
    );
    const jobs = [];
    for (const jobUrl of jobLinks) {
      await page.goto(jobUrl, { waitUntil: "networkidle2" });
      const btn = await page.$(
        "button.sc-bd699a4b-0.kBdTlY.btn-info.btn-md.sc-1671001a-2.galMaY.clickable"
      );
      if (btn) {
        await btn.click();
      }
      const jobData = await page.evaluate((companyUrl) => {
        const title =
          document.querySelector(".sc-ab270149-0.hAejeW")?.innerText?.trim() ||
          "";
        const company_info =
          document
            .querySelector(".sc-ab270149-0.egZKeY.sc-f0821106-0.gWSkfE")
            ?.innerText?.trim() || "";
        const company_url = companyUrl;
        const locationDivs = document.querySelectorAll(".sc-ab270149-0.cLLblL");
        const location =
          locationDivs[locationDivs.length - 1]?.innerText?.trim() || "";
        let work_arrangement = document
          .querySelector(".work-type")
          ?.innerText?.trim();
        if (!work_arrangement) work_arrangement = "Onsite";
        let job_type = document.querySelector(".job-type")?.innerText?.trim();
        if (!job_type) job_type = "Fulltime";
        // Lấy thông tin mô tả công việc
        const description = (() => {
          const descEl = document.querySelectorAll(".sc-1671001a-4.gDSEwb")[0];
          if (!descEl || !descEl.innerText) return "";
          return descEl.innerText
            .split("\n")
            .map((line) => line.trim())
            .filter(
              (line) =>
                line.length > 0 && line.toLowerCase() !== "mô tả công việc"
            )
            .join(" ");
        })();
        // Lấy requirements (nếu có)
        // Tìm div chứa text đặc trưng như 'Yêu cầu', 'Kinh nghiệm', ...
        let requirements = [];
        const reqEl = document.querySelectorAll(".sc-1671001a-4.gDSEwb")[1];
        if (reqEl && reqEl.innerText) {
          requirements = reqEl.innerText
            .split("\n")
            .map((line) => line.trim())
            .filter(
              (line) =>
                line.length > 0 && line.toLowerCase() !== "yêu cầu công việc"
            );
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
  await writeFile(
    "vietnamwork2.json",
    JSON.stringify(results, null, 2),
    "utf-8"
  );
  console.log(
    `Đã lưu kết quả vào vietnamwork2.json. Số lượng công ty đã cào: ${results.length}`
  );
  return results;
}

// Chạy thử
crawlCompanies();
