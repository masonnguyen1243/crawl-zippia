import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Hàm sleep dùng Promise
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Thay bằng API Key của bạn
// Danh sách API key, thêm nhiều key nếu có
const API_KEYS = ["AIzaSyACD_5UMh3p1vJN_IaxRHWKbK-jeJyHKqM"];
let currentKeyIndex = 0;
let genAI = new GoogleGenerativeAI(API_KEYS[currentKeyIndex]);

// Hàm gọi Gemini API với retry và backoff khi gặp lỗi 429
// Biến đếm số request đã gửi
let requestCount = 0;
const MAX_REQUESTS_PER_RUN = 240; // Đặt thấp hơn quota để an toàn
let quotaExceeded = false;

async function callGeminiWithRetry(
  model,
  prompt,
  maxRetries = 5,
  baseDelay = 1000
) {
  if (requestCount >= MAX_REQUESTS_PER_RUN) {
    quotaExceeded = true;
    throw new Error("Reached daily request limit, please run again tomorrow.");
  }
  let attempt = 0;
  let lastError;
  while (attempt < maxRetries) {
    try {
      requestCount++;
      const result = await model.generateContent(prompt);
      return result;
    } catch (err) {
      if (err && err.message && err.message.includes("429")) {
        // Nếu quota bị vượt, chuyển sang key tiếp theo nếu có
        if (currentKeyIndex < API_KEYS.length - 1) {
          currentKeyIndex++;
          genAI = new GoogleGenerativeAI(API_KEYS[currentKeyIndex]);
          console.warn(`Đã chuyển sang API key thứ ${currentKeyIndex + 1}`);
          // Reset biến đếm cho key mới
          requestCount = 0;
          // Thử lại với key mới
          return await callGeminiWithRetry(
            genAI.getGenerativeModel({ model: "gemini-2.5-flash" }),
            prompt,
            maxRetries,
            baseDelay
          );
        }
        const delay = baseDelay * Math.pow(2, attempt); // backoff
        console.warn(
          `429 Too Many Requests. Đợi ${delay}ms rồi thử lại lần ${
            attempt + 1
          }/${maxRetries}`
        );
        await sleep(delay);
        attempt++;
        lastError = err;
      } else {
        throw err;
      }
    }
  }
  throw lastError || new Error("Gemini API failed after retries");
}

// Hàm gọi Gemini để tóm tắt và chuyển đổi dữ liệu
async function processJob(job) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Chuyển title sang tiếng Anh
  const titleSum = await callGeminiWithRetry(
    model,
    `Translate this job title to English: "${job.title}". Only return the translated title.`
  );
  await sleep(1000); // Delay 1s giữa các request
  // Chuyển location sang tiếng Anh
  const locationSum = await callGeminiWithRetry(
    model,
    `Translate this job location to English: "${job.location}". Only return the translated location.`
  );
  await sleep(1000); // Delay 1s giữa các request
  // Chuyển skills array sang tiếng Anh và thành string
  let skillsText = Array.isArray(job.skills)
    ? job.skills.join(", ")
    : job.skills;
  const skillsSum = await callGeminiWithRetry(
    model,
    `Translate these skills to English and return as a comma-separated string: "${skillsText}".`
  );
  await sleep(1000); // Delay 1s giữa các request

  // Chuyển createdAt sang timestamp nếu là string, giữ nguyên nếu đã là số
  // Chuyển application_deadline sang timestamp nếu là string, giữ nguyên nếu đã là số
  // Tạo bản sao job và xóa updatedAt nếu có
  // Đổi tên trường description thành descriptionRaw
  const jobCopy = { ...job };
  if ("description" in jobCopy) {
    jobCopy.descriptionRaw = jobCopy.description;
    delete jobCopy.description;
  }
  // Đổi tên trường createdAt thành jobCreatedAt và chuyển sang timestamp nếu là string
  if ("createdAt" in jobCopy) {
    let createdAtValue = jobCopy.createdAt;
    if (typeof createdAtValue === "string") {
      const parts = createdAtValue.split("/");
      if (parts.length === 3) {
        const [day, month, year] = parts;
        createdAtValue = new Date(`${year}-${month}-${day}`).getTime();
      }
    }
    jobCopy.jobCreatedAt = createdAtValue;
    // Xóa trường createdAt
    delete jobCopy.createdAt;
  }
  if (jobCopy.application_deadline) {
    if (typeof jobCopy.application_deadline === "string") {
      let value = jobCopy.application_deadline;
      if (value.includes("/")) {
        // dd/mm/yyyy
        const parts = value.split("/");
        if (parts.length === 3) {
          const [day, month, year] = parts;
          value = `${year}-${month}-${day}`;
        }
      }
      // yyyy-mm-dd hoặc đã chuyển đổi ở trên
      jobCopy.application_deadline = new Date(value).getTime();
    }
    // Nếu đã là số thì giữ nguyên
  }
  if ("updatedAt" in jobCopy) {
    delete jobCopy.updatedAt;
  }

  // Thêm trường budgetRaw và chuyển budget thành object {min, max}
  if ("budget" in jobCopy) {
    jobCopy.budgetRaw = jobCopy.budget;
    let min = "";
    let max = "";
    if (typeof jobCopy.budget === "string") {
      // Tìm số tiền bằng regex
      const matches = jobCopy.budget.match(/(\d+[.,]?\d*)/g);
      if (matches && matches.length >= 1) {
        min = matches[0];
        max = matches.length > 1 ? matches[1] : matches[0];
      }
    }
    jobCopy.budget = { min, max };
  }

  // Tóm tắt requirements thành requirementsSum (string keywords) và dịch sang tiếng Anh
  let requirementsSum = "";
  if (Array.isArray(jobCopy.requirements)) {
    const keywords = [
      "kinh nghiệm",
      "bằng cấp",
      "quản lý",
      "giao tiếp",
      "kỹ năng",
      "trách nhiệm",
      "đội nhóm",
      "tin học",
      "ngoại ngữ",
      "độc lập",
      "áp lực",
      "chuyên ngành",
      "ưu tiên",
      "trung thực",
      "siêng năng",
      "thuyết phục",
      "call center",
      "collection",
      "python",
      "excel",
      "word",
      "powerpoint",
      "ai",
      "it",
      "teamwork",
      "leadership",
      "chủ động",
      "phân tích",
      "báo cáo",
      "nam",
      "nữ",
      "full-time",
      "part-time",
      "thực tập",
      "tốt nghiệp",
      "giám sát",
      "quản trị",
      "luật",
      "tài chính",
      "ngân hàng",
      "chăm chỉ",
      "cẩn thận",
      "chi tiết",
      "cam kết",
      "độc lập",
      "trách nhiệm cao",
    ];
    const reqText = jobCopy.requirements.join(" ").toLowerCase();
    const found = keywords.filter((k) => reqText.includes(k));
    const summary = found.join(", ");
    if (summary) {
      // Dịch sang tiếng Anh bằng Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const translateRes = await callGeminiWithRetry(
        model,
        `Translate these job requirement keywords to English, return as a comma-separated string: "${summary}".`
      );
      requirementsSum = translateRes.response.text();
      await sleep(1000);
    }
  }
  return {
    ...jobCopy,
    titleSum: titleSum.response.text(),
    locationSum: locationSum.response.text(),
    skillsSum: skillsSum.response.text(),
    // requirementsSum,
  };
}

async function main() {
  // Đọc file dataen.json
  const companies = JSON.parse(
    fs.readFileSync("./jobsgo/data-com.json", "utf8")
  );
  const results = [];
  // Chỉ xử lý 10 company một lần, có thể chỉnh startIndex để xử lý batch tiếp theo
  const startIndex = 10; // Đổi thành 10, 20... để xử lý batch tiếp theo
  const batchSize = 5;
  const endIndex = Math.min(startIndex + batchSize, companies.length);
  for (let i = startIndex; i < endIndex; i++) {
    const company = companies[i];
    if (Array.isArray(company.jobs)) {
      for (let j = 0; j < company.jobs.length; j++) {
        // Xóa company_info và company_url trong từng job
        if (company.jobs[j].company_info) {
          delete company.jobs[j].company_info;
        }
        if (company.jobs[j].company_url) {
          delete company.jobs[j].company_url;
        }
        try {
          const processedJob = await processJob(company.jobs[j]);
          // Đảm bảo xóa updatedAt và createdAt khỏi job
          const jobNoUpdatedAt = { ...company.jobs[j], ...processedJob };
          delete jobNoUpdatedAt.updatedAt;
          delete jobNoUpdatedAt.createdAt;
          company.jobs[j] = jobNoUpdatedAt;
          // Ghi ra file sau mỗi lần xử lý job để tránh mất dữ liệu nếu bị gián đoạn
          fs.writeFileSync(
            "./jobsgo/dataentrans_processed.json",
            JSON.stringify(results.concat([company]), null, 2),
            "utf8"
          );
          console.log(
            `Đã xử lý job thứ ${j + 1}/${company.jobs.length} của company thứ ${
              i + 1
            }/${companies.length}`
          );
        } catch (err) {
          console.error(
            `Lỗi ở job thứ ${j + 1} của company thứ ${i + 1}:`,
            err
          );
        }
      }
      // Đảm bảo xóa createdAt khỏi mọi job (kể cả job chưa qua processJob)
      for (let j = 0; j < company.jobs.length; j++) {
        if (company.jobs[j].createdAt) {
          delete company.jobs[j].createdAt;
        }
      }
      // Thêm tất cả location của từng job vào mảng location của company
      const jobLocations = company.jobs
        .map((job) => job.location)
        .filter((loc) => typeof loc === "string" && loc.length > 0);
      // Gộp với location cũ, loại trùng lặp
      const allLocations = Array.isArray(company.location)
        ? company.location.concat(jobLocations)
        : jobLocations;
      company.location = Array.from(new Set(allLocations));
    }
    results.push(company);
    // Ghi ra file sau mỗi lần xử lý company
    fs.writeFileSync(
      "./jobsgo/dataentrans_processed.json",
      JSON.stringify(results, null, 2),
      "utf8"
    );
  }
}

main();
