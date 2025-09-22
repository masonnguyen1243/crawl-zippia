import json
import os

def split_companies_file():
    """
    Tách file tuyen123.json thành 3 file nhỏ hơn:
    - ketquafinal-1.json: 66 companies đầu tiên
    - ketquafinal-2.json: 66 companies tiếp theo
    - ketquafinal-3.json: các companies còn lại
    """
    
    INPUT_FILE = 'tuyen123.json'
    COMPANIES_PER_FILE = 66
    OUTPUT_FILES = ['ketquafinal-1.json', 'ketquafinal-2.json', 'ketquafinal-3.json']
    
    # Đọc file input
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
    
    total_companies = len(companies_data)
    if total_companies == 0:
        print("⚠️  Không có dữ liệu để tách")
        return
    
    print(f"📊 Tổng số companies: {total_companies}")
    print(f"🔧 Sẽ tách thành {len(OUTPUT_FILES)} files với {COMPANIES_PER_FILE} companies/file")
    
    # Tách dữ liệu thành các chunks
    for i, output_file in enumerate(OUTPUT_FILES):
        start_index = i * COMPANIES_PER_FILE
        end_index = min((i + 1) * COMPANIES_PER_FILE, total_companies)
        
        # Lấy chunk dữ liệu
        chunk = companies_data[start_index:end_index]
        chunk_size = len(chunk)
        
        if chunk_size == 0:
            print(f"⚠️  File {output_file}: Không có dữ liệu để ghi")
            continue
        
        # Lưu chunk vào file
        try:
            print(f"💾 Đang lưu {output_file}: companies {start_index + 1}-{end_index} ({chunk_size} companies)")
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(chunk, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Đã lưu thành công {output_file}")
            
            # Thống kê jobs trong chunk
            total_jobs = sum(len(company.get("jobs", [])) for company in chunk)
            print(f"   📋 Tổng số jobs: {total_jobs}")
            
        except Exception as e:
            print(f"❌ Lỗi khi lưu file {output_file}: {e}")
            return
    
    print(f"\n🎉 Hoàn thành tách file!")
    print(f"📊 Thống kê cuối:")
    
    # Hiển thị thống kê tổng quát
    for i, output_file in enumerate(OUTPUT_FILES):
        start_index = i * COMPANIES_PER_FILE
        end_index = min((i + 1) * COMPANIES_PER_FILE, total_companies)
        actual_size = end_index - start_index
        
        if actual_size > 0:
            chunk = companies_data[start_index:end_index]
            total_jobs = sum(len(company.get("jobs", [])) for company in chunk)
            print(f"   - {output_file}: {actual_size} companies, {total_jobs} jobs")
    
    # Kiểm tra tổng
    total_processed = sum(min(COMPANIES_PER_FILE, max(0, total_companies - i * COMPANIES_PER_FILE)) 
                         for i in range(len(OUTPUT_FILES)))
    print(f"   - Tổng đã xử lý: {total_processed}/{total_companies} companies")

def main():
    print("🚀 Bắt đầu tách file companies...")
    split_companies_file()

if __name__ == "__main__":
    main()