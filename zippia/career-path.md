## Career Path Module

Mục tiêu: Lưu trữ và hiển thị lộ trình nghề nghiệp (career path) như biểu đồ gồm các node Job Title và các cạnh chuyển đổi có hướng. Thiết kế tối ưu cho đọc theo tầng (depth) sử dụng closure collection (transitive closure) trong MongoDB qua Prisma.

### 1) Data model (Prisma + Mongo)

Các collection và vai trò:

- Industry: Ngành nghề. `slug` unique. Dùng để scope Job Title theo ngành (tránh trùng tên khác ngành).
- JobTitle: Node. Thông tin job, thuộc một industry, kèm adjacency list `nextIds` để duyệt cạnh trực tiếp nhanh.
- JobTitleAlias: Map tên crawl/đồng nghĩa theo từng industry → JobTitle. Tránh tạo trùng khi nhập dữ liệu từng phần.
- JobEdge: Cạnh A→B có thuộc tính (vd likelihood, minYears...). Không bắt buộc cho render nhưng hữu ích để xếp hạng/lọc.
- JobClosure: Bảng transitive closure. Mỗi record là cặp `ancestorId` → `descendantId` và `depth` (0 là chính nó). Dùng để truy vấn nhanh depth N, chống cycle khi insert.
- JobEdgeStats (tuỳ chọn): Lưu thống kê tần suất từ crawler để tính likelihood.
- CareerCache (tuỳ chọn): Lưu payload đã build sẵn cho FE theo `(rootId, depth[, industryId])` để phản hồi cực nhanh.

Schema (rút gọn, chú ý unique keys theo industry):

```prisma
model Industry {
  id   String @id @default(auto()) @map("_id")
  slug String @unique
  name String
}

model JobTitle {
  id         String  @id @default(auto()) @map("_id")
  industryId String  @db.ObjectId
  slug       String
  name       String
  family     String?
  levelBand  String?
  nextIds    String[] @db.ObjectId
  meta       Json?
  @@index([industryId])
  @@unique([industryId, slug])
}

model JobTitleAlias {
  id         String @id @default(auto()) @map("_id")
  jobTitleId String @db.ObjectId
  industryId String @db.ObjectId
  nameNorm   String
  source     String?
  @@index([jobTitleId])
  @@unique([industryId, nameNorm])
}

model JobEdge {
  id          String  @id @default(auto()) @map("_id")
  fromId      String  @db.ObjectId
  toId        String  @db.ObjectId
  likelihood  Decimal? @db.Decimal(3,2)
  minYears    Int?
  salaryDelta Int?
  notes       String?
  meta        Json?
  @@index([fromId])
  @@index([toId])
  @@unique([fromId, toId])
}

model JobClosure {
  id           String @id @default(auto()) @map("_id")
  ancestorId   String @db.ObjectId
  descendantId String @db.ObjectId
  depth        Int
  @@unique([ancestorId, descendantId])
  @@index([ancestorId, depth])
  @@index([descendantId])
}

model JobEdgeStats {
  id      String @id @default(auto()) @map("_id")
  fromId  String @db.ObjectId
  toId    String @db.ObjectId
  count   Int
  wcount  Float
  @@unique([fromId, toId])
  @@index([fromId])
}

model CareerCache {
  id        String   @id @default(auto()) @map("_id")
  rootId    String   @db.ObjectId
  depth     Int
  payload   Json
  updatedAt DateTime @default(now())
  @@unique([rootId, depth])
}
```

Ghi chú trường quan trọng:

- JobTitle.slug: slug duy nhất trong phạm vi một industry. Nên chuẩn hoá theo `slugify(lower, strict)`.
- JobTitle.nextIds: adjacency để duyệt cạnh trực tiếp (hữu ích cho `$graphLookup` nếu cần). FE không bắt buộc dùng.
- JobEdge.likelihood: tuỳ chọn, 0..1. Không cần cho render, dùng để gợi ý/sort.
- JobClosure.depth: khoảng cách ngắn nhất. Dùng để lấy đúng tầng k, group nhánh và chặn cycle.

### 2) API – Import snapshot (một request, có industry)

Use-case: bạn crawl/nhập một “ảnh chụp” quanh 1 job (center) với các cạnh trực tiếp ở depth 1–2. API sẽ upsert Industry → Titles → Aliases → Edges, và cập nhật Closure cục bộ. Idempotent, chống tạo trùng.

Endpoint: `POST /api/career-path/import-snapshot`

Request body:

```json
{
  "industry": {
    "name": "Production and Manufacturing",
    "slug": "production-and-manufacturing"
  },
  "center": { "name": "QA Technician", "slug": "qa-technician" },
  "source": "indeed-2025-09",
  "nodes": [
    { "name": "QA Technician", "slug": "qa-technician" },
    { "name": "QA Analyst" },
    { "name": "Tester" },
    { "name": "QA Engineer" },
    { "name": "QA Specialist" },
    { "name": "Team Leader" }
  ],
  "edges": [
    { "from": "QA Technician", "to": "QA Analyst" },
    { "from": "QA Technician", "to": "Tester" },
    { "from": "QA Analyst", "to": "QA Engineer" },
    { "from": "QA Analyst", "to": "QA Specialist" },
    { "from": "Tester", "to": "QA Specialist" },
    { "from": "QA Specialist", "to": "Team Leader" }
  ]
}
```

Quy tắc nhập:

- Industry: upsert theo `slug` (tạo nếu chưa có, cập nhật tên nếu đã có).
- Map node theo `(industryId, nameNorm)` hoặc `(industryId, slug)`. Nếu chưa có, tạo mới và tạo alias `nameNorm`.
- Upsert edges A→B. Chặn cycle: nếu đã có đường đi B→A trong `JobClosure` thì bỏ qua cạnh để giữ DAG.
- Cập nhật `nextIds` của from.
- Cập nhật `JobClosure`: thêm self-pair (X,X,0) và mọi cặp ancestor(from) × descendant(to) với `depth = depth(a,u)+1+depth(v,d)`, đồng thời cạnh trực tiếp depth=1.

Response (rút gọn):

```json
{ "ok": true, "industry": "production-and-manufacturing" }
```

Log mẫu (ở cấp DEBUG) khi chạy server:

```json
{
  "stage": "upsert-industry",
  "slug": "production-and-manufacturing",
  "id": "64f..."
}
{
  "stage": "upsert-title",
  "industryId": "64f...",
  "name": "QA Analyst",
  "slug": "qa-analyst",
  "action": "created",
  "id": "64g..."
}
{
  "stage": "upsert-edge",
  "fromId": "64fA...",
  "toId": "64fB...",
  "action": "upserted"
}
{
  "stage": "closure-updates",
  "pairsUpserted": 7
}
```

### 3) API – Get chart từ một job cụ thể

Endpoint: `GET /api/career-path/chart?industrySlug=production-and-manufacturing&rootSlug=qa-technician&maxDepth=2`

Ý nghĩa:

- Chỉ trả về nodes và edges trong phạm vi depth ≤ N (N mặc định 2) của root. Edges được ràng buộc giữa các tầng k→k+1 để giữ đúng nhánh.
- Sử dụng `JobClosure` cho danh sách node và `JobEdge` để xác định cạnh trực tiếp.

Response example:

```json
{
  "root": { "id": "jt_root", "slug": "qa-technician", "name": "QA Technician" },
  "nodes": [
    { "id": "jt_analyst", "name": "QA Analyst", "depth": 1 },
    { "id": "jt_tester", "name": "Tester", "depth": 1 },
    { "id": "jt_engineer", "name": "QA Engineer", "depth": 2 },
    { "id": "jt_specialist", "name": "QA Specialist", "depth": 2 },
    { "id": "jt_teamlead", "name": "Team Leader", "depth": 2 }
  ],
  "edges": [
    { "from": "jt_root", "to": "jt_analyst" },
    { "from": "jt_root", "to": "jt_tester" },
    { "from": "jt_analyst", "to": "jt_engineer" },
    { "from": "jt_analyst", "to": "jt_specialist" },
    { "from": "jt_tester", "to": "jt_specialist" }
  ],
  "edgesByParent": {
    "jt_analyst": [{ "to": "jt_engineer" }, { "to": "jt_specialist" }],
    "jt_tester": [{ "to": "jt_specialist" }]
  }
}
```

Log mẫu:

```json
{ "stage": "chart-query", "rootId": "jt_root", "depth": 2, "d1": 2, "d2": 3 }
{ "stage": "chart-build", "nodes": 5, "edges": 5 }
```

Ghi chú hiển thị:

- FE group các node depth 2 theo `edgesByParent[parentId]` để hiện đúng nhánh của từng node depth 1.
- Nếu một node depth 2 có nhiều parent (vd QA Specialist), nó sẽ nằm trong nhiều group, đúng với branching thật.

### 4) Truy vấn lõi (tham khảo logic)

Pseudocode (TypeScript) cho get chart bằng closure:

```ts
// Resolve root by (industrySlug, rootSlug)
const industry = await prisma.industry.findUnique({
  where: { slug: industrySlug },
});
const root = await prisma.jobTitle.findFirst({
  where: { industryId: industry.id, slug: rootSlug },
});

const d1 = await prisma.jobClosure.findMany({
  where: { ancestorId: root.id, depth: 1 },
  select: { descendantId: true },
});
const d2 = await prisma.jobClosure.findMany({
  where: { ancestorId: root.id, depth: 2 },
  select: { descendantId: true },
});

const ids = [
  root.id,
  ...d1.map((x) => x.descendantId),
  ...d2.map((x) => x.descendantId),
];
const titles = await prisma.jobTitle.findMany({
  where: { id: { in: ids } },
  select: { id: true, name: true, slug: true },
});

const edges12 = await prisma.jobEdge.findMany({
  where: {
    fromId: { in: d1.map((x) => x.descendantId) },
    toId: { in: d2.map((x) => x.descendantId) },
  },
  select: { fromId: true, toId: true },
});

// build edges (root->depth1)
const edges01 = await prisma.jobEdge.findMany({
  where: { fromId: root.id, toId: { in: d1.map((x) => x.descendantId) } },
  select: { fromId: true, toId: true },
});

const edges = [...edges01, ...edges12];
const edgesByParent = edges12.reduce((acc, e) => {
  (acc[e.fromId] ||= []).push({ to: e.toId });
  return acc;
}, {} as Record<string, { to: string }[]>);
```

### 5) Test cases (QC)

- Insert snapshot lần đầu một industry mới

  - Kỳ vọng: tạo industry, tạo titles, tạo aliases, edges, closure self-pairs và depth=1; trả `ok: true`.
  - Kiểm: `JobTitle` có `@@unique([industryId, slug])` đảm bảo không trùng.

- Insert snapshot lặp lại (idempotent)

  - Gửi cùng payload 2–3 lần.
  - Kỳ vọng: không tạo thêm node trùng, `nextIds` không duplicate, `JobEdge` giữ unique, `JobClosure` không phình vô hạn.

- Tên giống nhau ở industry khác

  - Tạo industry A và B, cùng node name "QA Engineer".
  - Kỳ vọng: 2 JobTitle khác id; alias unique theo `[industryId, nameNorm]`; không chồng chéo.

- Branching depth 2

  - Root có 2 node depth1; một node depth2 chung cho cả hai.
  - Kỳ vọng: response `edgesByParent` chứa node depth2 dưới cả hai parent; tổng số edges đúng.

- Cycle guard

  - Sau khi có A→B, B→C, thử thêm C→A trong cùng industry.
  - Kỳ vọng: API reject hoặc silently skip cạnh gây cycle; không xuất hiện closure (A,C,?) mới theo chiều ngược.

- Cross‑industry edge (nếu cấm)

  - Tạo 2 industry, cố ý map cạnh từ node của A sang node của B.
  - Kỳ vọng: API từ chối; không có `JobEdge` hoặc `Closure` cross‑industry.

- Get chart với root không tồn tại

  - Kỳ vọng: 404/400 tuỳ design, message rõ ràng.

- Get chart với depth > 2

  - Kỳ vọng: trả đủ tầng ≤ depth; hiệu năng ổn định (p95 < ~12ms) với dataset trung bình.

- Unicode/alias
  - Node name có dấu/viết hoa khác nhau ("Kỹ sư QA", "ky su qa").
  - Kỳ vọng: alias `nameNorm` map về cùng JobTitle trong industry.

### 6) Ghi chú hiệu năng

- Read path (closure):

  - `JobClosure` theo `{ancestorId, depth}` có index → ~0.5–1.5ms p50 / 2–3ms p95 (Atlas M10–M20) cho depth ≤ 2.
  - `JobTitle.findMany(id ∈ set)` 5–30 tài liệu → 1–3ms.
  - `JobEdge` filter theo `from ∈ d1` và `to ∈ d2` → 1–3ms.

- Write path:
  - Mỗi cạnh có thể sinh 5–200 record closure tuỳ số ancestor/descendant.
  - Dùng `bulkWrite`/`$runCommandRaw` với upsert; nhóm theo từng cạnh để giữ tính cục bộ.

### 7) Minh hoạ dữ liệu nhỏ (sample)

```json
// JobTitle (trích)
[
  { "_id": "jt_root", "industryId": "ind_1", "slug": "qa-technician", "name": "QA Technician", "nextIds": ["jt_analyst","jt_tester"] },
  { "_id": "jt_analyst", "industryId": "ind_1", "slug": "qa-analyst", "name": "QA Analyst", "nextIds": ["jt_engineer","jt_specialist"] },
  { "_id": "jt_tester", "industryId": "ind_1", "slug": "tester", "name": "Tester", "nextIds": ["jt_specialist"] }
]

// JobClosure (trích)
[
  { "ancestorId": "jt_root", "descendantId": "jt_root", "depth": 0 },
  { "ancestorId": "jt_root", "descendantId": "jt_analyst", "depth": 1 },
  { "ancestorId": "jt_root", "descendantId": "jt_tester", "depth": 1 },
  { "ancestorId": "jt_root", "descendantId": "jt_engineer", "depth": 2 },
  { "ancestorId": "jt_root", "descendantId": "jt_specialist", "depth": 2 }
]
```

Từ sample này, API chart depth=2 sẽ trả đúng node/tầng và edges k→k+1 như ở phần 3.
