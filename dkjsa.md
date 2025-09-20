thêm logic để key sau như sau khi đến key skills
đoạn này sẽ truy cập link với logic sau
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
    });đoạn này khi truy cập thẻ a.list-link thì sẽ dc 1 url(gọi đây là web2) và m hãy truy cập tiếp url/skills/

(gọi đây là web skill)
và làm việc trên web này
"skills": [
{
"skill_name": lấy thông tin ở thẻ a.pieChart_link**uaxuk list-link
"percent": láy thông tin của thẻ span ngay dưới span.openSansBlackBold
"description":thực hiện hành động click vào thẻ a.pieChart_link**uaxuk list-link lấy ở skill name và lấy toàn bộ nội dung ở thẻ div.topSkills_topSkillContainer\_\_2Z_jY z-pt-48 w-730 trừ thẻ h3 đầu tiên
},
các bản ghi khác trong skill làm tương tự
sau khi hoàn thành bên webskill thì quay về web 2 để tiếp tục lấy dữ liệu phần dưới
