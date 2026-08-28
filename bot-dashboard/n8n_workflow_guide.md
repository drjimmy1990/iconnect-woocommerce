# دليل تطبيق وتحديث ورك فلو n8n (n8n Workflow Guide)

هذا الدليل يشرح لك خطوة بخطوة كل ما تحتاجه لتطبيق الميزات الجديدة (مؤشر الكتابة Typing Indicator عبر Zernio و Meta، أقصى توفير للـ Tokens بحقلين فقط في المحادثة العادية، تصنيف وتراكم الكاتجوريز الـ 11 في الـ Tags، وحالات خدمة العملاء والتحويل لموظف) داخل منصة **n8n**.

---

## 📑 فهرس الخطوات

1. [الخطوة 1: إضافة مؤشر الكتابة (Typing Indicator) عبر Zernio أو Meta API](#1-الخطوة-1-إضافة-مؤشر-الكتابة-typing-indicator)
2. [الخطوة 2: تحديث الـ System Prompt في عقدة AI Agent](#2-الخطوة-2-تحديث-الـ-system-prompt)
3. [الخطوة 3: كود عقدة المعالجة الذكية (Code in JavaScript2)](#3-الخطوة-3-كود-عقدة-المعالجة-الذكية-code-in-javascript2)
4. [الخطوة 4: توجيه مسارات الـ Switch (Switch1 Routing)](#4-الخطوة-4-توجيه-مسارات-الـ-switch)
5. [الخطوة 5: مسار خدمة العملاء وإيقاف الرد الآلي (Customer Service & Escalation)](#5-الخطوة-5-مسار-خدمة-العملاء-وإيقاف-الرد-الآلي)
6. [الخطوة 6: تراكم وحفظ الكاتجوريز (Tags) في Supabase بدون تكرار](#6-الخطوة-6-تراكم-وحفظ-الكاتجوريز-tags-في-supabase-بدون-تكرار)

---

## 1. الخطوة 1: إضافة مؤشر الكتابة (Typing Indicator)

الهدف من هذه العقدة هو إرسال إشعار فوري للعميل في إنستجرام/واتساب/ماسنجر بأن البوت **"يكتب الآن... / Typing..."** بمجرد استقبال الرسالة، لكي لا يشعر العميل ببطء أثناء قيام الذكاء الاصطناعي بالبحث والمعالجة.

### 📍 أين تضع العقدة في الـ Canvas؟
* ضع عقدة **`HTTP Request`** جديدة بعد استلام الـ Webhook مباشرة (مثلاً بعد `Supabase7` أو `Code in JavaScript6`) **وقبل** إرسال الرسالة إلى عقدة `AI Agent`.

---

### 🚀 الخيار الأول: عبر Zernio API (الرسمي الموصى به)

يدعم Zernio مؤشر الكتابة لـ **Instagram** و **Facebook Messenger** و **WhatsApp** و **Telegram** عبر Endpoint موحد:

* **Node Type:** `HTTP Request`
* **Method:** `POST`
* **URL:**
  ```text
  https://api.zernio.com/v1/inbox/conversations/{{ $json.conversationId || $json.conversation_id || $json.data?.conversationId }}/typing
  ```
* **Authentication / Headers:**
  * `Authorization`: `Bearer YOUR_ZERNIO_API_KEY`
  * `Content-Type`: `application/json`
* **Body Parameters (JSON):**
  ```json
  {
    "accountId": "={{ $json.accountId || $json.account_id || $json.data?.accountId }}"
  }
  ```

---

### 🌐 الخيار الثاني: عبر Meta / Instagram Graph API المباشر

* **Method:** `POST`
* **URL:** `https://graph.facebook.com/v21.0/me/messages`
* **Headers:**
  * `Authorization`: `Bearer YOUR_PAGE_ACCESS_TOKEN`
  * `Content-Type`: `application/json`
* **JSON Body:**
```json
{
  "recipient": {
    "id": "={{ $('Code in JavaScript6').item.json.SenderJid }}"
  },
  "sender_action": "typing_on"
}
```

---

## 2. الخطوة 2: تحديث الـ System Prompt

1. افتح عقدة **`AI Agent`** في n8n.
2. انتقل إلى قسم **`Options`** $\rightarrow$ **`System Message`**.
3. قم بنسخ محتوى الملف المحدّث كاملاً من:
   📄 **[system_message.txt](file:///c:/Users/LOQ/Desktop/CLI/emirates%20mostafa/woocommerce/bot-dashboard/system_message.txt)**
4. الصق المحتوى في حقل **`System Message`** واضغط **Save**.

> 💡 **مزايا البرومبت المحدث (Ultra-Compact Token Optimization):**
> * **توليد حقلين فقط في 85% من المحادثات العادية (`intent` و `reply` فقط!):** تم الاستغناء تماماً عن إخراج `client_status: "new"` لأن العميل ينشأ بحالة `new` في قاعدة البيانات افتراضياً.
> * **إخراج الحقول الإضافية عند تغيير الحالة فقط:**
>   * عند الاهتمام بمنتج/كاتجوري $\rightarrow$ يخرج `"category": "..."`.
>   * عند إنشاء طلب $\rightarrow$ يخرج `"client_status": "customer"`.
>   * عند الشكوى والدعم $\rightarrow$ يخرج `"client_status": "support"`.

---

## 3. الخطوة 3: كود عقدة المعالجة الذكية (Code in JavaScript2)

افتح عقدة **`Code in JavaScript2`** واستبدل الكود الموجود فيها بهذا الكود الذكي:

```javascript
// ============================================================================
// Parse AI Agent Output — Ultra-Compact Schema
// Automatically infers missing keys and maps client_status smartly
// ============================================================================

const VALID_INTENTS = [
  'conversation',
  'product_details',
  'complaint',
  'customer_service',
  'order_created',
];

const VALID_CATEGORIES = [
  'Computers & Computing',
  'Printers & Scanners',
  'Ink, Toner & Printing Supplies',
  'Networking & Connectivity',
  'CCTV & Surveillance',
  'Access Control Systems',
  'Security & Alarm Systems',
  'IP Telephony & Communication',
  'Time Attendance & Biometric Systems',
  'Power & Electrical Protection',
  'Storage & Backup',
];

const VALID_CLIENT_STATUSES = [
  'new',
  'interested',
  'customer',
  'repeat_customer',
  'support',
  'inactive',
];

const FALLBACK_REPLY = 'أهلاً بك 🙏 كيف أقدر أساعدك اليوم في منتجات وخدمات آي كونكت؟';

function ok(intent, reply, extra = {}, parseNote = 'ok') {
  return [{
    json: {
      intent,
      reply: reply || FALLBACK_REPLY,
      product_id: extra.product_id ?? null,
      complaint: extra.complaint ?? null,
      order: extra.order ?? null,
      detected_category: extra.detected_category ?? null,
      category: extra.detected_category ?? null,
      client_status: extra.client_status ?? (extra.detected_category ? 'interested' : 'new'),
      _parse: parseNote,
    },
  }];
}

// 0. استلام مخرج الـ Agent
const input = $input.first().json;
const raw = input.output ?? input.text ?? input.response ?? '';

if (!raw || typeof raw !== 'string') {
  return ok('conversation', FALLBACK_REPLY, {}, 'no-output-field');
}

// 1. استخراج الـ JSON من Code Block أو أقواس {}
let jsonString = null;
const fence = raw.match(/```{3,}(?:json)?\s*([\s\S]*?)\s*```{3,}/);
if (fence && fence[1]) jsonString = fence[1].trim();

if (!jsonString) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start > -1 && end > start) jsonString = raw.slice(start, end + 1).trim();
}

if (!jsonString) {
  return ok('conversation', raw.trim(), {}, 'plain-text-fallback');
}

// 2. عمل Parse مع معالجة الأسطر الجديدة
let parsed = null;
try {
  parsed = JSON.parse(jsonString);
} catch (e) {
  try {
    parsed = JSON.parse(
      jsonString.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    );
  } catch (e2) {
    return ok('conversation', raw.trim(), {}, 'parse-failed');
  }
}

if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
  return ok('conversation', raw.trim(), {}, 'not-an-object');
}

// 3. تطبيع الحقول
let intent = typeof parsed.intent === 'string' ? parsed.intent.trim() : '';
let note = 'ok';

if (!VALID_INTENTS.includes(intent)) {
  note = `unknown-intent:${intent || 'empty'}`;
  intent = 'conversation';
}

let reply = parsed.reply ?? parsed.botResponse ?? parsed.response ?? '';
if (typeof reply !== 'string' || !reply.trim()) {
  reply = raw.trim() || FALLBACK_REPLY;
  note = 'missing-reply';
}
reply = reply.trim();

let productId = null;
if (parsed.product_id !== null && parsed.product_id !== undefined) {
  const n = Number(parsed.product_id);
  if (Number.isFinite(n) && n > 0) productId = Math.trunc(n);
}

const complaint =
  typeof parsed.complaint === 'string' && parsed.complaint.trim()
    ? parsed.complaint.trim()
    : null;

const order =
  parsed.order && typeof parsed.order === 'object' && !Array.isArray(parsed.order)
    ? parsed.order
    : null;

// مطابقة الكاتجوري (يدعم category أو detected_category)
const rawCategory = parsed.category ?? parsed.detected_category ?? null;
let detectedCategory = null;
if (typeof rawCategory === 'string' && rawCategory.trim()) {
  const trimmed = rawCategory.trim();
  const matched = VALID_CATEGORIES.find(c => c.toLowerCase() === trimmed.toLowerCase());
  if (matched) detectedCategory = matched;
}

// استنتاج حالة العميل تلقائياً بذكاء إذا لم يرسلها الـ Agent
let clientStatus = 'new';
if (typeof parsed.client_status === 'string' && parsed.client_status.trim()) {
  const s = parsed.client_status.trim().toLowerCase();
  if (VALID_CLIENT_STATUSES.includes(s)) clientStatus = s;
} else {
  // الاستنتاج التلقائي لتوفير الـ Tokens
  if (detectedCategory || intent === 'product_details') clientStatus = 'interested';
  else if (intent === 'order_created') clientStatus = 'customer';
  else if (intent === 'complaint' || intent === 'customer_service') clientStatus = 'support';
  else clientStatus = 'new';
}

// حراس الأمان (Guards)
if (intent === 'product_details' && productId === null) {
  return ok('conversation', reply, { detected_category: detectedCategory, client_status: clientStatus }, 'product_details-without-product_id');
}

if (intent === 'complaint' && !complaint) {
  return ok('complaint', reply, { complaint: reply, detected_category: detectedCategory, client_status: 'support' }, 'complaint-body-defaulted');
}

if (intent === 'order_created' && (!order || !order.order_number)) {
  return ok('conversation', reply, { detected_category: detectedCategory, client_status: clientStatus }, 'order_created-without-order');
}

return ok(intent, reply, {
  product_id: productId,
  complaint,
  order,
  detected_category: detectedCategory,
  client_status: clientStatus,
}, note);
```

---

## 4. الخطوة 4: توجيه مسارات الـ Switch (Switch1 Routing)

داخل عقدة **`Switch1`**، تأكد من وجود المسارات التالية:

* **المسار 0 (Output 0):** `intent` يساوي `conversation`
* **المسار 1 (Output 1):** `intent` يساوي `product_details` (لإرسال صور وتفاصيل المنتج تلقائياً)
* **المسار 2 (Output 2):** `intent` يساوي `order_created` (لإرسال رابط الدفع وتأكيد الطلب)
* **المسار 3 (Output 3):** `intent` يساوي `customer_service` أو `complaint` (لمسار التحويل البشري)

---

## 5. الخطوة 5: مسار خدمة العملاء وإيقاف الرد الآلي

عند خروج الرسالة من مسار **`customer_service` / `complaint`** في `Switch1`:

1. **إيقاف الرد الآلي للعميل (`ai_enabled = false`):**
   * **Node Type:** `Supabase` $\rightarrow$ `Update` على جدول `contacts`
   * **Filter:** `id` **eq** `={{ $('Edit Fields4').item.json.contact_uuid }}`
   * **Field:** `ai_enabled` = `false`

2. **تحديث حالة العميل إلى `support`:**
   * **Node Type:** `Supabase` $\rightarrow$ `Update` على جدول `crm_clients`
   * **Filter:** `contact_id` **eq** `={{ $('Edit Fields4').item.json.contact_uuid }}`
   * **Field:** `client_type` = `support`

3. **إرسال رد الاعتذار/التحويل للعميل** عبر واتساب أو إنستجرام.

4. **إرسال تنبيه للموظفين (Telegram / WhatsApp Alert):**
   > 🚨 **تنبيه خدمة عملاء ومحادثة جديدة بحاجة لتدخل بشري**  
   > 👤 **العميل:** `{{ $('Code in JavaScript6').item.json.SenderName }}`  
   > 📱 **الرقم/المعرف:** `{{ $('Code in JavaScript6').item.json.SenderJid }}`  
   > 📝 **السبب:** `{{ $('Code in JavaScript2').item.json.complaint || 'طلب تحويل لموظف / استفسار خاص' }}`

---

## 6. الخطوة 6: تراكم وحفظ الكاتجوريز (Tags) في Supabase بدون تكرار

لكي تتراكم اهتمامات العميل تلقائياً في `crm_clients.tags`:

### 1. في عقدة إعداد البيانات قبل تحديث Supabase:
أضف عقدة **`Code`** لدمج الكاتجوري الجديد مع الـ Tags السابقة:

```javascript
// جلب الـ Tags الحالية للعميل من العقدة السابقة في الـ Workflow
const currentTags = $('Get Client').item.json?.tags || [];
const newCategory = $('Code in JavaScript2').item.json?.category;
const newStatus = $('Code in JavaScript2').item.json?.client_status || 'new';

let updatedTags = Array.isArray(currentTags) ? [...currentTags] : [];

// دمج الكاتجوري الجديد إذا كان موجوداً وغير مكرر
if (newCategory && typeof newCategory === 'string' && !updatedTags.includes(newCategory)) {
  updatedTags.push(newCategory);
}

return [{
  json: {
    ...$input.first().json,
    merged_tags: updatedTags,
    client_status: newStatus
  }
}];
```

### 2. في عقدة `Supabase` (نوع Update على جدول `crm_clients`):
* **Table:** `crm_clients`
* **Filter Conditions:**
  * `contact_id` **eq** `={{ $('Edit Fields4').item.json.contact_uuid }}`
* **Fields to Update:**
  * `client_type` = `={{ $json.client_status }}`
  * `tags` = `={{ $json.merged_tags }}`
