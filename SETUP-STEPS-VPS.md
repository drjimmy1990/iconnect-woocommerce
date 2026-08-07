# خطوات التجهيز — VPS + Supabase + n8n (asra3.com)

> **المعمارية المختارة:** Supabase = قاعدة بيانات فقط (Postgres + pgvector). الـ VPS يشغّل **Backend A** (بحث، :8080) + **Backend B** (wrapper ووكومرس، :8081) جنب n8n. الـ agent يكلّم A و B فقط — مش ووكومرس مباشرة.

```
n8n (n8n.asra3.com)
   │  POST /search            GET/POST /api/*
   ▼                              ▼
Backend A (:8080) ◄── /index ── Backend B (:8081) ── Basic auth + Cookie + UA ──► WooCommerce
   │                                                                              (iconnect-intl.com/store)
   ▼
Supabase (Postgres + pgvector)  ◄── EMBEDDING API (OpenAI/custom)
```

---

## المرحلة 0 — تعديل الكود الإلزامي (قبل أي حاجة)

`wc-client.ts` بيبعت الـ User-Agent بس **مش بيبعت الكوكي `humans_21909`**، فالـ sync/bulk هيفشل بـ `409`. لازم نضيف الكوكي.

**في [`woocommerce-api-wrapper/src/wc-client.ts`](woocommerce-api-wrapper/src/wc-client.ts):** أضف متغيّر واقرأه في هيدرز الـ axios client:
```ts
const WC_COOKIE = process.env.WC_COOKIE || "humans_21909=1";
// ...
const client = axios.create({
  baseURL: WC_URL,
  timeout: 30000,
  headers: {
    "User-Agent": USER_AGENT,
    Cookie: WC_COOKIE,            // ← السطر الجديد
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: "Basic " + Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64"),
  },
});
```
وكمان في منطق الـ retry: خلّي الشرط يتعامل مع `409` زي `403` (السطر `if (res.status === 403 ...)` → `if ([403,406,409].includes(res.status) ...)`).

> لو هتستخدم مسار Supabase Edge Functions بدلاً من B، نفس التعديل لازم في [`supabase/functions/_shared/wc.ts`](supabase/functions/_shared/wc.ts).

---

## المرحلة 1 — Supabase (انت بتعملها)

1. اعمل **مشروع Supabase** جديد (الخطة المجانية تكفي ~180 منتج).
2. من **Settings → API** انسخ:
   - `Project URL` → `https://xxxx.supabase.co`
   - `service_role` secret key (مش الـ anon).
3. **SQL Editor → New query** → الصق كامل [`semantic-search-backend/sql/001_init.sql`](semantic-search-backend/sql/001_init.sql) → **Run**.
   - بيعمل: جدول `documents` (بـ `embedding vector(512)` + عمود FTS عربي + `content_hash`) + الفهارس + 3 دوال بحث.
4. ✅ تحقّق: `select count(*) from documents;` = `0`.

> **مفتاح الـ embeddings:** محتاج `EMBEDDING_API_KEY` (OpenAI `text-embedding-3-large`) — أو endpoint متوافق (خصّص `EMBEDDING_BASE_URL`). لازم **نفس الموديل + الأبعاد (512)** للفهرسة والبحث.

---

## المرحلة 2 — Backend A (بحث دلالي) على الـ VPS

```bash
cd semantic-search-backend
cp .env.example .env
```
عدّل `.env`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role
EMBEDDING_API_KEY=sk-...            # أو مفتاح الـ endpoint المخصّص
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMS=512
FTS_CONFIG=arabic
DOCUMENTS_TABLE=documents
PORT=8080
```
```bash
npm install
npm run build && pm2 start "npm run start" --name backend-a   # أو npm run dev للتجربة
curl http://localhost:8080/health     # {"status":"ok"}
```

---

## المرحلة 3 — Backend B (wrapper ووكومرس) على الـ VPS

```bash
cd ../woocommerce-api-wrapper
cp .env.example .env
```
عدّل `.env` (لاحظ `WC_COOKIE` الجديد + UA كامل):
```
WC_URL=https://iconnect-intl.com/store/wp-json/wc/v3
WC_KEY=ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b
WC_SECRET=cs_234e5af2614e76e372b33675fbcc3ea80eedba3e
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36
WC_COOKIE=humans_21909=1
SEMANTIC_BACKEND_URL=http://localhost:8080
WC_WEBHOOK_SECRET=<اكتب-سترينج-عشوائي-قوي>
PORT=8081
SYNC_ENABLED=true
SYNC_INTERVAL_MIN=5
```
```bash
npm install
npm run build && pm2 start "npm run start" --name backend-b
curl http://localhost:8081/health
curl "http://localhost:8081/api/products?per_page=2&search=cat6"   # منتجين trimmed
```

---

## المرحلة 4 — فهرسة الكاتالوج (مرة واحدة)

```bash
curl -X POST http://localhost:8081/sync/bulk
```
B بيجيب كل المنتجات ويدفعها لـ A اللي بيعملها embeddings ويخزّنها في Supabase (~1–2 دقيقة لـ ~180 منتج). راقب لوجات B: `pm2 logs backend-b`.

✅ تحقّق:
```bash
# في Supabase SQL editor:  select count(*) from documents;   → ~180
curl -X POST http://localhost:8080/search -H "Content-Type: application/json" \
  -d '{"query":"كاميرا","top_k":3,"mode":"hybrid"}'
```

---

## المرحلة 5 — n8n (على asra3.com)

**وصول n8n للـ backends:**
- لو n8n **native** على نفس السيرفر → `http://localhost:8080` و `http://localhost:8081`.
- لو n8n في **Docker** → `localhost` مش هيوصل للـ host؛ استخدم `http://host.docker.internal:8080/:8081`، أو اعمل subdomains بـ nginx:
  - `search.asra3.com` → :8080، `api.asra3.com` → :8081 (وريّحك في الوصول + HTTPS).

**Environment في n8n:**
```
SEMANTIC_BACKEND_URL=http://localhost:8080     # أو https://search.asra3.com
WOO_WRAPPER_URL=http://localhost:8081          # أو https://api.asra3.com
```
بعدين اتبع [`n8n-tools-setup.md`](n8n-tools-setup.md) لتوصيل أدوات الـ AI Agent:
- `semantic_search` → `POST {{$env.SEMANTIC_BACKEND_URL}}/search`
- catalog/orders/track → `{{$env.WOO_WRAPPER_URL}}/api/*`

> الـ agent **مش** بيحتاج مفاتيح ووكومرس ولا الكوكي ولا الـ UA — كله جوه B.

---

## المرحلة 6 — تحديث الفهرس تلقائياً (بعد ما يشتغل)

- **Delta-sync** تلقائي كل 5 دقايق (`SYNC_ENABLED=true`).
- **Webhook فوري** — سجّله في ووكومرس عشان التحديثات اللحظية (B لازم يكون public — استخدم `https://api.asra3.com/webhook/wc`):
```bash
curl -X POST 'https://iconnect-intl.com/store/wp-json/wc/v3/webhooks' \
  --user 'ck_...:cs_...' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' \
  -H 'Cookie: humans_21909=1' -H 'Content-Type: application/json' \
  -d '{"name":"Supabase sync","topic":"product.updated","delivery_url":"https://api.asra3.com/webhook/wc","secret":"<same-as-WC_WEBHOOK_SECRET>"}'
# كرّر لـ product.created / product.deleted / product.restored
```

---

## استكشاف الأخطاء
| العرض | الحل |
|---|---|
| `/sync/bulk` يرجّع 403/409/HTML | المرحلة 0 مش متعملة — الكوكي مش بتتبعت في `wc-client.ts` |
| `406 Not Acceptable` | الـ USER_AGENT قصير — استخدم UA كروم الكامل |
| `/search` يرجّع `[]` | شغّل المرحلة 4 (bulk). اتأكد `count(*) > 0` |
| `function match_documents does not exist` | المرحلة 1.3 مش متعملة — شغّل `001_init.sql` |
| `dimensions must be 512` | `EMBEDDING_DIMS` مش مطابق لـ `vector(512)` |
| n8n مبيوصلش للـ backends | Docker: استخدم `host.docker.internal` أو subdomains |

## ملخّص سطر واحد
تعديل الكوكي (م0) → Supabase + SQL (م1) → شغّل A ‏(:8080) → شغّل B ‏(:8081) → `POST /sync/bulk` → وصّل n8n بـ A و B.
