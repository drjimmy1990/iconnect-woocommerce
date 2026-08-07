# cURLs مُتحقَّق منها لـ n8n — WooCommerce (`/wc/v3` + `/wc/store/v1`)

> **تاريخ التحقّق:** 2026-08-06 — كل الطلبات هنا اختُبرت حيّاً ورجّعت `200/201` JSON.
> **المتجر:** `https://iconnect-intl.com/store`

## ⚠️ حالة الحماية بعد إزالة Cloudflare

| الطبقة | قبل | دلوقتى |
|---|---|---|
| Cloudflare (`Cf-Mitigated: challenge`) | كان يبلوك | ✅ **اتشال** — `Server: Apache`، مفيش `CF-Ray` |
| POST writes (cart/checkout) | ❌ 403 دايماً | ✅ شغّالة (`add-item` = 201) |

بس ظهرت طبقتين على مستوى Apache نفسه، ولازم **كل** طلب يرضّيهم:

### 🔑 القاعدتان الإلزاميتان لكل طلب
1. **`Cookie: humans_21909=1`** — من غيرها بترجع `409` + `<script>document.cookie="humans_21909=1"; document.location.reload(true)</script>` (تحدّي JS متقطّع). n8n مبيشغّلش JS فلازم تبعتها يدوي.
2. **User-Agent كامل واقعي** — لو بعت `Mozilla/5.0` قصير بترجع **`406 Not Acceptable`** (mod_security). استخدم UA كروم الكامل.

> **في n8n:** استخدم `-H 'Cookie: ...'` مش `-b` (الـ importer بيحوّل `-H` بموثوقية). و`--user` بيتحوّل لـ `Authorization: Basic` — انقلها لـ **HTTP Basic Auth credential** بدل ما تكون ظاهرة في النود.
> **إعدادات كل نود:** Retry On Fail = 3، Wait Between Tries = 2000ms.

المفاتيح: `ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b` / `cs_234e5af2614e76e372b33675fbcc3ea80eedba3e`
UA الكامل: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36`

> ملاحظة أمان: المفاتيح دي اتشاركت في ملفات المشروع — يُفضّل عمل **rotate** وزوج جديد بأقل صلاحية قبل الإنتاج.

---

## 🅰️ Classic REST API — `/wc/v3` (يحتاج Basic Auth)

### 1) عرض الفئات ✅
```bash
curl -i --request GET --user 'ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' 'https://iconnect-intl.com/store/wp-json/wc/v3/products/categories?per_page=5&orderby=name&order=asc'
```

### 2) البحث عن منتجات ✅
```bash
curl -i --request GET --user 'ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' 'https://iconnect-intl.com/store/wp-json/wc/v3/products?search=cat6&per_page=5'
```

### 3) تفاصيل منتج مفرد ✅
```bash
curl -i --request GET --user 'ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' 'https://iconnect-intl.com/store/wp-json/wc/v3/products/8825'
```

### 4) بوابات الدفع (Telr فقط مُفعّلة) ✅
```bash
curl -i --request GET --user 'ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' 'https://iconnect-intl.com/store/wp-json/wc/v3/payment_gateways'
```

### 5) قائمة الأوردرات (tracking) ✅
```bash
curl -i --request GET --user 'ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' 'https://iconnect-intl.com/store/wp-json/wc/v3/orders?per_page=2'
```

### 6) مناطق الشحن (السعودية فقط) ✅
```bash
curl -i --request GET --user 'ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' 'https://iconnect-intl.com/store/wp-json/wc/v3/shipping/zones'
```

### 7) إنشاء أوردر → يرجّع `payment_url` (Telr) ✅  ⚠️ write حقيقي — امسح الأوردر بعده
```bash
curl -i --request POST --user 'ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' -H 'Content-Type: application/json' --data '{"payment_method":"wctelr","payment_method_title":"Telr","status":"pending","billing":{"first_name":"Test","last_name":"n8n","address_1":"Riyadh","city":"Riyadh","country":"SA","email":"test@example.com","phone":"0500000000"},"line_items":[{"product_id":8825,"quantity":1}]}' 'https://iconnect-intl.com/store/wp-json/wc/v3/orders'
```
حذف أوردر تجريبي: `DELETE /wc/v3/orders/{id}?force=true` (بنفس الهيدرز + auth).

---

## 🅱️ Store API — `/wc/store/v1` (قراءات عامة بدون مصادقة)

### 8) منتجات عامة ✅
```bash
curl -i --request GET -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' 'https://iconnect-intl.com/store/wp-json/wc/store/v1/products?search=cat6&per_page=5'
```

### 9) فئات عامة ✅
```bash
curl -i --request GET -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' 'https://iconnect-intl.com/store/wp-json/wc/store/v1/products/categories?per_page=5'
```

### 10) منتج مفرد عام ✅
```bash
curl -i --request GET -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' 'https://iconnect-intl.com/store/wp-json/wc/store/v1/products/8825'
```

### 11) GET السلة → يرجّع `Cart-Token` + `Nonce` في response headers ✅
```bash
curl -i --request GET -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' 'https://iconnect-intl.com/store/wp-json/wc/store/v1/cart'
```

### 12) POST إضافة للسلة (كان متبلوك — دلوقتى 201) ✅
```bash
curl -i --request POST -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' -H 'Cookie: humans_21909=1' -H 'Content-Type: application/json' -H 'Nonce: PUT_NONCE_HERE' -H 'Cart-Token: PUT_CART_TOKEN_HERE' --data '{"id":8825,"quantity":1}' 'https://iconnect-intl.com/store/wp-json/wc/store/v1/cart/add-item'
```

#### ربط نودَي السلة في n8n
الـ `cart-token` و `nonce` بيرجعوا كـ **response headers** مش في الـ body:
1. نود **"GET cart"**: فعّل **"Include Response Headers and Status"**.
2. نود **"add-item"** الهيدرز:
   - `Nonce` = `{{ $node["GET cart"].json.headers.nonce }}`
   - `Cart-Token` = `{{ $node["GET cart"].json.headers["cart-token"] }}`

---

## ملاحظة معمارية مهمة
- **مسار الإنتاج للأوردر** = عن طريق الـ **wrapper (B)** `POST /api/orders` (Classic → `payment_url`)، مش مسار Store API cart.
- الـ **cart flow (11–12)** هنا للاختبار/التحقّق أو كبديل (Phase 2) لو حبينا سلة تفاعلية حيّة.
- الـ agent في الإنتاج بيكلّم **B** (`/api/*`) و **A** (`/search`) بس — مش ووكومرس مباشرة.

## جدول التحقّق (كله حي ✅)
| # | Endpoint | النتيجة |
|---|---|---|
| 1–6 | v3 categories/products/product/gateways/orders/zones | ✅ 200 |
| 8–11 | v1 products/categories/product/cart | ✅ 200 |
| 12 | v1 cart/add-item (POST) | ✅ 201 |
| — | من غير cookie | ⚠️ 409 متقطّع |
| — | UA قصير `Mozilla/5.0` | ❌ 406 |
