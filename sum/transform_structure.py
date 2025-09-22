import json
import os

def transform_company_structure(companies_data):
    """
    Transform company structure according to requirements:
    - companyName -> name
    - companyUrl -> website  
    - companyEmail -> email
    - companyPhone -> phone
    - work_arrangement -> workArrangement
    - job_type -> jobType
    - budget object -> budgetMin, budgetMax
    - job_url -> jobUrl
    - application_deadline -> applicationDeadline
    - jobCreatedAt -> postedDate
    """
    
    transformed_companies = []
    
    for company in companies_data:
        # Transform company fields
        transformed_company = {}
        
        # Required field mappings
        transformed_company["name"] = company.get("companyName", "")
        transformed_company["nameEmbedding"] = []  # Empty array as per requirements
        transformed_company["website"] = company.get("companyUrl", "")
        transformed_company["description"] = company.get("description", "")
        transformed_company["size"] = company.get("size", "")
        transformed_company["industry"] = company.get("industry", "")
        transformed_company["location"] = company.get("location", [])
        transformed_company["email"] = company.get("companyEmail", "")
        transformed_company["phone"] = company.get("companyPhone", "")
        
        # Transform jobs
        transformed_jobs = []
        if "jobs" in company and company["jobs"]:
            for job in company["jobs"]:
                transformed_job = {}
                
                # Basic job fields
                transformed_job["title"] = job.get("title", "")
                transformed_job["source"] = job.get("source", "")
                transformed_job["location"] = job.get("location", "")
                
                # Field name transformations
                transformed_job["workArrangement"] = job.get("work_arrangement", "")
                transformed_job["jobType"] = job.get("job_type", "")
                
                transformed_job["description"] = job.get("description", "")
                
                # Transform budget from object to separate fields
                budget = job.get("budget", {})
                # Set budget field from budgetRaw
                transformed_job["budget"] = job.get("budgetRaw", "")
                
                if isinstance(budget, dict):
                    transformed_job["budgetMin"] = budget.get("min", "")
                    transformed_job["budgetMax"] = budget.get("max", "")
                else:
                    # If budget is not a dict, set empty values for min/max
                    transformed_job["budgetMin"] = ""
                    transformed_job["budgetMax"] = ""
                
                transformed_job["skills"] = job.get("skills", [])
                transformed_job["requirements"] = job.get("requirements", [])
                transformed_job["status"] = job.get("status", "")
                
                # Field name transformations
                transformed_job["jobUrl"] = job.get("job_url", "")
                transformed_job["applicationDeadline"] = job.get("application_deadline", 1758067200000)  # Default from requirements
                
                # Keep existing fields
                transformed_job["descriptionRaw"] = job.get("descriptionRaw", "")
                
                # Transform jobCreatedAt to postedDate
                transformed_job["postedDate"] = job.get("jobCreatedAt", 1701369600000)  # Default from requirements
                
                # Keep summary fields
                transformed_job["titleSum"] = job.get("titleSum", "")
                transformed_job["locationSum"] = job.get("locationSum", "")
                transformed_job["skillsSum"] = job.get("skillsSum", "")
                transformed_job["requirementsSum"] = job.get("requirementsSum", "")
                transformed_job["descriptionSum"] = job.get("descriptionSum", "")
                
                # Add embedding fields as empty arrays
                transformed_job["titleEmbedding"] = []
                transformed_job["locationEmbedding"] = []
                transformed_job["skillsEmbedding"] = []
                transformed_job["requirementsEmbedding"] = []
                transformed_job["descriptionEmbedding"] = []
                
                transformed_jobs.append(transformed_job)
        
        transformed_company["jobs"] = transformed_jobs
        transformed_companies.append(transformed_company)
    
    return transformed_companies

def main():
    # Input and output file paths
    INPUT_FILE = 'summarized_companies.json'
    OUTPUT_FILE = 'transformed_companies.json'
    TEMP_FILE = 'transformed_companies_temp.json'
    
    # Read input file
    try:
        print(f"🔄 Đang đọc file input: {INPUT_FILE}")
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            companies_data = json.load(f)
        print(f"✅ Đã đọc thành công {len(companies_data)} companies")
    except FileNotFoundError:
        print(f"❌ Lỗi: Không tìm thấy file '{INPUT_FILE}'")
        return
    except json.JSONDecodeError as e:
        print(f"❌ Lỗi: File '{INPUT_FILE}' không đúng định dạng JSON: {e}")
        return
    
    # Transform data
    print("🔄 Đang chuyển đổi cấu trúc dữ liệu...")
    
    # Check for temporary file (resume capability)
    start_index = 0
    transformed_companies = []
    
    if os.path.exists(TEMP_FILE):
        try:
            with open(TEMP_FILE, 'r', encoding='utf-8') as f:
                transformed_companies = json.load(f)
            start_index = len(transformed_companies)
            print(f"📁 Tìm thấy file tạm thời với {start_index} companies đã xử lý. Tiếp tục...")
        except:
            print("⚠️  Không thể đọc file tạm thời. Bắt đầu lại từ đầu...")
            transformed_companies = []
            start_index = 0
    
    # Process companies in batches
    BATCH_SIZE = 10
    total_companies = len(companies_data)
    
    for i in range(start_index, total_companies, BATCH_SIZE):
        end_index = min(i + BATCH_SIZE, total_companies)
        batch = companies_data[i:end_index]
        
        print(f"🔄 Xử lý companies {i+1}-{end_index}/{total_companies}")
        
        # Transform batch
        transformed_batch = transform_company_structure(batch)
        transformed_companies.extend(transformed_batch)
        
        # Save temporary file
        try:
            with open(TEMP_FILE, 'w', encoding='utf-8') as f:
                json.dump(transformed_companies, f, ensure_ascii=False, indent=2)
            print(f"💾 Đã lưu tiến trình: {len(transformed_companies)}/{total_companies} companies")
        except Exception as e:
            print(f"⚠️  Lỗi khi lưu file tạm thời: {e}")
    
    # Save final output
    try:
        print(f"💾 Đang lưu file kết quả: {OUTPUT_FILE}")
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(transformed_companies, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Hoàn thành! Đã chuyển đổi {len(transformed_companies)} companies")
        print(f"📂 File đầu ra: {OUTPUT_FILE}")
        
        # Clean up temporary file
        if os.path.exists(TEMP_FILE):
            os.remove(TEMP_FILE)
            print("🗑️  Đã xóa file tạm thời")
            
    except Exception as e:
        print(f"❌ Lỗi khi lưu file kết quả: {e}")
        return
    
    # Display statistics
    total_jobs = sum(len(company.get("jobs", [])) for company in transformed_companies)
    print(f"\n📊 Thống kê:")
    print(f"   - Tổng số companies: {len(transformed_companies)}")
    print(f"   - Tổng số jobs: {total_jobs}")
    
    # Show sample of transformed structure
    if transformed_companies and transformed_companies[0].get("jobs"):
        print(f"\n🔍 Mẫu cấu trúc đã chuyển đổi:")
        sample_job = transformed_companies[0]["jobs"][0]
        print("   Company fields:")
        print(f"   - name: {transformed_companies[0].get('name', 'N/A')}")
        print(f"   - website: {transformed_companies[0].get('website', 'N/A')}")
        print(f"   - email: {transformed_companies[0].get('email', 'N/A')}")
        print(f"   - phone: {transformed_companies[0].get('phone', 'N/A')}")
        print("   Job fields:")
        print(f"   - workArrangement: {sample_job.get('workArrangement', 'N/A')}")
        print(f"   - jobType: {sample_job.get('jobType', 'N/A')}")
        print(f"   - budget: {sample_job.get('budget', 'N/A')}")
        print(f"   - budgetMin: {sample_job.get('budgetMin', 'N/A')}")
        print(f"   - budgetMax: {sample_job.get('budgetMax', 'N/A')}")
        print(f"   - jobUrl: {sample_job.get('jobUrl', 'N/A')}")
        print(f"   - applicationDeadline: {sample_job.get('applicationDeadline', 'N/A')}")
        print(f"   - postedDate: {sample_job.get('postedDate', 'N/A')}")

if __name__ == "__main__":
    main()