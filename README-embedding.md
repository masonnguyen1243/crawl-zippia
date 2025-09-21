# Script Chuyển đổi Text sang Vector Embeddings

Các script này được tạo để chuyển đổi các trường text trong file `summarized_companies.json` thành vector embeddings sử dụng API của Talio.

## Files

1. **`convert-to-embeddings-with-config.js`** - Script chính (khuyên dùng) ⭐
2. **`convert-to-embeddings.js`** - Script cũ (hardcoded config)
3. **`create-config.js`** - Tạo file cấu hình
4. **`test-embedding-api.js`** - Script test API đơn giản
5. **`test-auth-methods.js`** - Test nhiều phương thức authentication
6. **`embedding-config.json`** - File cấu hình (được tạo tự động)
7. **`README-embedding.md`** - File hướng dẫn này

## Cách sử dụng (Khuyên dùng)

### Bước 1: Tạo file cấu hình

```bash
node create-config.js
```

### Bước 2: Cập nhật API key

Mở file `embedding-config.json` và cập nhật:

- `api.key`: API key thật của bạn
- `api.authMethod`: Phương thức authentication ('bearer', 'api-key', 'x-api-key', 'body', 'plain')

### Bước 3: Chạy conversion

```bash
node convert-to-embeddings-with-config.js
```

## Cách sử dụng (Phiên bản cũ)

### Bước 1: Test nhiều phương thức auth

```bash
node test-auth-methods.js
```

### Bước 2: Cập nhật script và chạy

```bash
# Sửa API_KEY và AUTH_METHOD trong convert-to-embeddings.js
node convert-to-embeddings.js
```

## Chức năng

Script sẽ:

1. **Đọc file input**: `./emb/summarized_companies.json`
2. **Chuyển đổi các trường sau thành embeddings**:
   - `titleSum` → `titleEmbed`
   - `locationSum` → `locationEmbed`
   - `skillsSum` → `skillsEmbed`
   - `requirementsSum` → `requirementsEmbed`
3. **Lưu kết quả**: `./emb/summarized_companies_with_embeddings.json`

## Cấu hình

### API Configuration

- **URL**: `https://embeds.talio.vn/embeds`
- **API Key**: `talio`
- **Method**: POST

### Rate Limiting

- **Batch Size**: 10 requests đồng thời
- **Delay giữa batches**: 1000ms
- **Delay giữa fields**: 200ms
- **Timeout**: 30 giây

## Cấu trúc dữ liệu output

Mỗi job sẽ được thêm các trường mới:

```json
{
  "title": "Software Engineer",
  "titleSum": "Software Engineer",
  "titleEmbed": [0.1, 0.2, 0.3, ...], // Vector embedding

  "location": "Ho Chi Minh City",
  "locationSum": "Ho Chi Minh City",
  "locationEmbed": [0.4, 0.5, 0.6, ...], // Vector embedding

  "skills": ["JavaScript", "Python"],
  "skillsSum": "JavaScript, Python",
  "skillsEmbed": [0.7, 0.8, 0.9, ...], // Vector embedding

  "requirements": ["3+ years experience"],
  "requirementsSum": "3+ years experience",
  "requirementsEmbed": [0.1, 0.4, 0.7, ...] // Vector embedding
}
```

## Error Handling

- **Null/empty text**: Sẽ set embedding field = null
- **API errors**: Log chi tiết và continue với null
- **Network errors**: Retry logic có thể được thêm vào
- **Graceful shutdown**: Ctrl+C để dừng và lưu partial results

## Logs

Script sẽ hiển thị:

- Progress của từng company và job
- Thành công/thất bại của từng embedding
- Summary cuối cùng với success rate
- Tổng thời gian thực hiện

## Lưu ý

1. **Backup dữ liệu** trước khi chạy
2. **Test API** trước khi chạy script chính
3. **Kiểm tra network** - script cần internet để gọi API
4. **Dung lượng** - file output sẽ lớn hơn đáng kể do thêm vectors
5. **Thời gian** - Có thể mất vài giờ với dataset lớn

## Troubleshooting

### API không hoạt động

```bash
# Test API trước
node test-embedding-api.js
```

### Rate limiting

- Giảm `BATCH_SIZE` trong script
- Tăng `DELAY_BETWEEN_BATCHES`

### Memory issues

- Xử lý từng company một thay vì load toàn bộ
- Tăng Node.js memory limit: `node --max-old-space-size=4096 convert-to-embeddings.js`

### Partial results

- Script lưu toàn bộ khi hoàn thành
- Thêm checkpoint logic nếu cần lưu giữa chừng
