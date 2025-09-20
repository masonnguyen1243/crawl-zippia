import fs from "fs";
import OpenAI from "openai";

// Hàm sleep dùng Promise
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Thay bằng API Key của bạn
// Danh sách API key DeepSeek, thêm nhiều key nếu có
const API_KEYS = [
  "sk-7f809b21172b4adcb7d4ce62a6133c75",
  "sk-sk-5f42fbebac7f4a52b2c2d6cc310e972d",
  "sk-743803e8e6734e74b54a45631ba94ec0",
];
let currentKeyIndex = 0;
let openai = new OpenAI({
  apiKey: API_KEYS[currentKeyIndex],
  baseURL: "https://api.deepseek.com/v1",
});

// Hàm gọi Gemini API với retry và backoff khi gặp lỗi 429
// Biến đếm số request đã gửi
let requestCount = 0;
const MAX_REQUESTS_PER_RUN = 1000; // Tăng giới hạn nếu quota API cho phép
let quotaExceeded = false;

async function callDeepSeekWithRetry(prompt, maxRetries = 5, baseDelay = 1000) {
  if (requestCount >= MAX_REQUESTS_PER_RUN) {
    quotaExceeded = true;
    throw new Error("Reached daily request limit, please run again tomorrow.");
  }
  let attempt = 0;
  let lastError;
  while (attempt < maxRetries) {
    try {
      requestCount++;
      const response = await openai.chat.completions.create({
        model: "deepseek-chat", // hoặc model phù hợp
        messages: [{ role: "user", content: prompt }],
      });
      return response.choices[0].message.content;
    } catch (err) {
      if (err && err.response && err.response.status === 429) {
        // Nếu quota bị vượt, chuyển sang key tiếp theo nếu có
        if (currentKeyIndex < API_KEYS.length - 1) {
          currentKeyIndex++;
          openai = new OpenAI({
            apiKey: API_KEYS[currentKeyIndex],
            baseURL: "https://api.deepseek.com/v1",
          });
          console.warn(`Đã chuyển sang API key thứ ${currentKeyIndex + 1}`);
          requestCount = 0;
          return await callDeepSeekWithRetry(prompt, maxRetries, baseDelay);
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
  throw lastError || new Error("DeepSeek API failed after retries");
}

// Hàm gọi Gemini để tóm tắt và chuyển đổi dữ liệu
async function processJob(job) {
  // Chuyển title sang tiếng Anh
  const titleSum = await callDeepSeekWithRetry(
    `Translate this job title to English: "${job.title}". Only return the translated title.`
  );
  await sleep(1000); // Delay 1s giữa các request
  // Chuyển location sang tiếng Anh
  const locationSum = await callDeepSeekWithRetry(
    `Translate this job location to English: "${job.location}". Only return the translated location.`
  );
  await sleep(1000); // Delay 1s giữa các request
  // Chuyển skills array sang tiếng Anh và thành string
  let skillsText = Array.isArray(job.skills)
    ? job.skills.join(", ")
    : job.skills;
  const skillsSum = await callDeepSeekWithRetry(
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
      const parts = jobCopy.application_deadline.split("/");
      if (parts.length === 3) {
        const [day, month, year] = parts;
        jobCopy.application_deadline = new Date(
          `${year}-${month}-${day}`
        ).getTime();
      }
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
      // Dịch sang tiếng Anh bằng DeepSeek
      const translateRes = await callDeepSeekWithRetry(
        `Translate these job requirement keywords to English, return as a comma-separated string: "${summary}".`
      );
      requirementsSum = translateRes;
      await sleep(1000);
    }
  }
  return {
    ...jobCopy,
    titleSum,
    locationSum,
    skillsSum,
    requirementsSum,
  };
}

async function main() {
  // Đọc file dataen.json
  const companies = JSON.parse(fs.readFileSync("./jobsgo/dataen.json", "utf8"));
  const results = [];
  // Xử lý toàn bộ company và toàn bộ job bên trong
  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    if (Array.isArray(company.jobs)) {
      for (let j = 0; j < company.jobs.length; j++) {
        try {
          const processedJob = await processJob(company.jobs[j]);
          // Đảm bảo xóa updatedAt và createdAt khỏi job
          const jobNoUpdatedAt = { ...company.jobs[j], ...processedJob };
          delete jobNoUpdatedAt.updatedAt;
          delete jobNoUpdatedAt.createdAt;
          company.jobs[j] = jobNoUpdatedAt;
          // Ghi ra file sau mỗi lần xử lý job để tránh mất dữ liệu nếu bị gián đoạn
          fs.writeFileSync(
            "./jobsgo/dataen_processed.json",
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
      "./jobsgo/dataen_processed.json",
      JSON.stringify(results, null, 2),
      "utf8"
    );
  }
}

main();
