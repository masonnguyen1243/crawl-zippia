import json
import re
import os

# Hàm tóm tắt văn bản nếu vượt quá max_length ký tự
def summarize_text(text, max_length=200):
    if len(text) <= max_length:
        return text
    
    # Split text into sentences using multiple delimiters ('. ', '; ', ' - ')
    sentences = re.split(r'[.;]\s+|- |\n', text.strip())  # Thêm '\n' để xử lý ngắt dòng
    sentences = [s.strip() for s in sentences if s.strip()]  # Loại bỏ chuỗi rỗng hoặc chỉ có khoảng trắng
    
    summary = ''
    for sentence in sentences:
        if len(summary + sentence) < max_length - 2:  # Dành chỗ cho dấu '. '
            summary += sentence + '. '
        else:
            break
    
    # Fallback: Nếu không tóm tắt được (summary rỗng), cắt ngắn đến max_length
    if not summary:
        summary = text[:max_length].rsplit(' ', 1)[0]  # Cắt ở khoảng trắng gần nhất trước max_length
    
    return summary.rstrip('. ')  # Loại bỏ dấu chấm và khoảng trắng thừa

# Đọc JSON từ file
try:
    with open('summarized_companies.json', 'r', encoding='utf-8') as f:
        companies_data = json.load(f)
except FileNotFoundError:
    print("Lỗi: Không tìm thấy file 'input.json'. Vui lòng kiểm tra lại.")
    exit(1)
except json.JSONDecodeError:
    print("Lỗi: File 'input.json' không đúng định dạng JSON. Vui lòng kiểm tra cú pháp.")
    exit(1)

print(f"🚀 Bắt đầu xử lý {len(companies_data)} companies...")

# File output tạm thời và cuối cùng
OUTPUT_FILE = 'summarized_companies.json'
TEMP_FILE = 'summarized_companies_temp.json'

# Khởi tạo danh sách kết quả
processed_companies = []

# Kiểm tra xem có file tạm thời từ lần chạy trước không
start_index = 0
if os.path.exists(TEMP_FILE):
    try:
        with open(TEMP_FILE, 'r', encoding='utf-8') as f:
            processed_companies = json.load(f)
        start_index = len(processed_companies)
        print(f"📁 Tìm thấy file tạm thời với {start_index} companies đã xử lý. Tiếp tục từ company {start_index + 1}...")
    except:
        print("⚠️  Không thể đọc file tạm thời. Bắt đầu lại từ đầu...")
        processed_companies = []
        start_index = 0

# Xử lý từng company
for company_index in range(start_index, len(companies_data)):
    company = companies_data[company_index]
    company_name = company.get('companyName', f'Company {company_index + 1}')
    
    print(f"\n📋 Đang xử lý company {company_index + 1}/{len(companies_data)}: {company_name}")
    
    # Đếm số job cần xử lý
    jobs_count = len(company.get('jobs', []))
    print(f"   Tìm thấy {jobs_count} jobs")
    
    processed_jobs = 0
    
    # Xử lý các trường có hậu tố 'Sum' và tạo trường descriptionSum trong từng job
    if 'jobs' in company and company['jobs']:
        for job_index, job in enumerate(company['jobs']):
            # Xử lý các trường có hậu tố 'Sum' hiện có
            for key in list(job.keys()):  # Sử dụng list() để tránh lỗi khi thay đổi dict trong loop
                if key.endswith('Sum') and isinstance(job[key], str):
                    if len(job[key]) > 50:
                        old_length = len(job[key])
                        job[key] = summarize_text(job[key])
                        new_length = len(job[key])
                        print(f"     Job {job_index + 1}: Tóm tắt '{key}' từ {old_length} xuống {new_length} ký tự")
            
            # Tạo trường descriptionSum từ trường description (nếu có và dài hơn 50 ký tự)
            if 'description' in job and isinstance(job['description'], str) and len(job['description']) > 50:
                if 'descriptionSum' not in job:  # Chỉ tạo mới nếu chưa có
                    old_length = len(job['description'])
                    job['descriptionSum'] = summarize_text(job['description'])
                    new_length = len(job['descriptionSum'])
                    print(f"     Job {job_index + 1}: Tạo 'descriptionSum' từ 'description' - từ {old_length} xuống {new_length} ký tự")
            
            processed_jobs += 1
    
    print(f"   ✅ Hoàn thành {processed_jobs}/{jobs_count} jobs")
    
    # Thêm company đã xử lý vào danh sách
    processed_companies.append(company)
    
    # Lưu file tạm thời sau mỗi company
    try:
        with open(TEMP_FILE, 'w', encoding='utf-8') as f:
            json.dump(processed_companies, f, ensure_ascii=False, indent=2)
        print(f"   💾 Đã lưu tiến trình: {len(processed_companies)}/{len(companies_data)} companies")
    except Exception as e:
        print(f"   ⚠️  Lỗi khi lưu file tạm thời: {e}")

print(f"\n🎉 Hoàn thành xử lý tất cả {len(processed_companies)} companies!")

# Lưu file kết quả cuối cùng
try:
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(processed_companies, f, ensure_ascii=False, indent=2)
    print(f"✅ Đã lưu kết quả cuối cùng vào file: {OUTPUT_FILE}")
    
    # Xóa file tạm thời sau khi hoàn thành
    if os.path.exists(TEMP_FILE):
        os.remove(TEMP_FILE)
        print("🗑️  Đã xóa file tạm thời")
        
except Exception as e:
    print(f"❌ Lỗi khi lưu file kết quả: {e}")

# Thống kê tổng quan
total_jobs = sum(len(company.get('jobs', [])) for company in processed_companies)
print(f"\n📊 Thống kê:")
print(f"   - Tổng số companies đã xử lý: {len(processed_companies)}")
print(f"   - Tổng số jobs đã xử lý: {total_jobs}")
print(f"   - File đầu ra: {OUTPUT_FILE}")