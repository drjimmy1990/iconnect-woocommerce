> ⛔ **HISTORICAL — no longer needed.** This escalation was resolved by removing Cloudflare
> from the store. The API is reachable today using `Cookie: humans_21909=1` + a full browser
> `User-Agent`. **Current reference:** [curls-n8n-VERIFIED.md](curls-n8n-VERIFIED.md)

# Bluehost Support Escalation Ticket

## English Version — Send This to Bluehost

**Subject:** Urgent Level-2 Escalation — Cloudflare Interactive Challenge Blocks WooCommerce REST API Despite VPS IP Allowlisting

Hello Bluehost Support,

Please escalate this case to your **Advanced / Level-2 CDN Security / Newfold Edge Team**.

The VPS public IP has reportedly been allowlisted, but the active blocking behavior has not changed. This suggests that the allowlist may have been applied at the origin layer — such as cPanel/CSF, ModSecurity, Wordfence, SiteLock, or the server firewall — while the request is still being blocked earlier by a Cloudflare/Newfold edge security layer.

## Verified Environment

- Domain: `iconnect-intl.com`
- WooCommerce path: `/store`
- Authoritative nameservers:
  - `ns1.bluehost.com`
  - `ns2.bluehost.com`
- Origin A record: `66.235.200.147`
- Origin network appears to be Bluehost/Newfold (`host77.ipowerweb.com`).

Despite this, the HTTP responses are processed by Cloudflare and include:

```text
Server: cloudflare
CF-Ray: ...
Cf-Mitigated: challenge
cType: interactive
```

## Evidence 1 — Public API Request Requiring No WooCommerce Credentials

The following public WooCommerce Store API request was executed directly from the n8n VPS terminal:

```text
GET /store/wp-json/wc/store/v1/products/categories?per_page=5
```

It returned:

```text
HTTP/2 403
Content-Type: text/html; charset=UTF-8
Server: cloudflare
Cf-Mitigated: challenge
CF-Ray: a250bdc32d7caa9c-FRA
Challenge type: interactive
UTC timestamp: 2026-08-02 23:07:52 GMT
```

This endpoint is public and does not use any WooCommerce key. Therefore, this failure cannot be caused by invalid WooCommerce credentials or an n8n Basic Authentication configuration.

## Evidence 2 — Authenticated Classic WooCommerce API Request

The following authenticated request was also executed directly from the same VPS terminal:

```text
GET /store/wp-json/wc/v3/products/8825
```

It returned:

```text
HTTP/2 403
Content-Type: text/html; charset=UTF-8
Server: cloudflare
Cf-Mitigated: challenge
CF-Ray: a250be81cdc2d412-FRA
Challenge type: interactive
UTC timestamp: 2026-08-02 23:08:22 GMT
```

Both requests were blocked before reaching WordPress/WooCommerce. The second request's WooCommerce credentials cannot be evaluated while the edge layer is returning an HTML challenge page.

## Why the Current Allowlist Is Not Working

The unchanged `Cf-Mitigated: challenge` response proves that the blocking decision is still happening at the Cloudflare/Newfold edge before the request reaches the origin server.

An allowlist applied only in one of the following locations is insufficient:

- cPanel / IP Blocker
- CSF firewall
- ModSecurity
- Wordfence
- SiteLock at the WordPress/origin layer
- Apache or PHP configuration

Please confirm exactly where the current allowlist was applied and provide the relevant change or rule ID.

## Required Actions

Please perform these actions in order:

### 1. Identify the Actual Edge Rule

Search your edge security events using these CF-Ray identifiers and UTC timestamps:

```text
a250bdc32d7caa9c-FRA — 2026-08-02 23:07:52 GMT
a250be81cdc2d412-FRA — 2026-08-02 23:08:22 GMT
```

Please report:

- The exact edge/CDN/security product handling these requests.
- The rule ID that issued the interactive challenge.
- The security action that was triggered.
- Whether it came from Bot Management, a managed/interactive challenge, a WAF rule, DDoS protection, a Bluehost/Newfold CDN feature, SiteLock, or another integration.

Please do not apply another origin-only allowlist. The required exception must be placed in the same edge layer that generated these CF-Ray responses.

### 2. Confirm the Actual VPS Egress Addresses

Please confirm that the allowlist contains the actual public egress address used by the n8n VPS and its Docker network.

Our public egress IPv4 is:

```text
109.123.240.106
```

Please also check whether an IPv6 egress address is being used. If so, it must be allowlisted too, or the integration must be forced to use the allowlisted IPv4 address.

### 3. Add an Edge-Level Bypass Rule

Please create an edge-level allow/skip rule with the following vendor-neutral logic:

```text
IF source IP is in {OUR_VPS_PUBLIC_EGRESS_IPS}
AND request path starts with "/store/wp-json/wc/"
THEN:
  skip Bot Management challenge
  skip managed challenge
  skip interactive challenge
  skip the managed WAF challenge rule currently producing Cf-Mitigated: challenge
  allow the request to continue to the origin
```

The exception must cover at least:

```text
/store/wp-json/wc/v3/*
/store/wp-json/wc/store/*
/store/wp-json/wc/store/v1/*
```

Please keep the following protections enabled:

- HTTPS
- WooCommerce authentication
- Appropriate API rate limits
- Protection for every other website path

We are **not** asking you to disable security for the whole website.

### 4. Confirm Rule Priority and Propagation

Please ensure that:

- The allow/skip rule is evaluated before any challenge or block rule.
- It is applied in the same edge product that generated the CF-Ray values.
- The configuration is published and fully propagated.
- Any stale edge/CDN configuration is purged if required.

Please provide the new allow/skip rule ID.

### 5. Forward the Authorization Header

Please confirm that the following header is forwarded unchanged from the edge to WordPress/PHP:

```text
Authorization: Basic ...
```

This is required for the WooCommerce Classic REST API.

## Required Verification After the Change

Please test from the actual VPS/n8n egress IP and provide the status code, content type, and response type for all three cases:

### Test A — Public Store API

```text
GET /store/wp-json/wc/store/v1/products/categories?per_page=1
```

Expected:

```text
HTTP 200
Content-Type: application/json
JSON body
```

### Test B — Classic API with Valid Credentials

```text
GET /store/wp-json/wc/v3/products/categories?per_page=1
```

Expected:

```text
HTTP 200
Content-Type: application/json
JSON body
```

### Test C — Classic API with Deliberately Invalid Credentials

Expected:

```text
HTTP 401
Content-Type: application/json
WooCommerce JSON error
```

None of these tests should return:

```text
Content-Type: text/html
Cf-Mitigated: challenge
Just a moment...
```

## If Your Managed Edge Product Cannot Add This Exception

If the active Bluehost/Newfold edge or bot-protection product cannot create a source-IP plus path-based bypass, please provide one of these alternatives:

1. Create a dedicated API hostname, for example:

```text
api.iconnect-intl.com
```

Route it directly to the origin or outside the managed bot-challenge layer, then secure it with:

- TLS/HTTPS
- Origin firewall allowlisting for our VPS IP
- WooCommerce REST authentication
- API rate limiting

2. Disable the managed bot/interactive challenge only for:

```text
/store/wp-json/*
```

while keeping protection enabled for the rest of the website.

## Information Requested in Your Reply

Please reply with:

1. The exact product or integration that is adding Cloudflare processing.
2. The blocking rule ID found from the two CF-Ray values.
3. The exact location where the previous IP allowlist was applied.
4. The new edge allow/skip rule ID.
5. Confirmation that the actual VPS IPv4/IPv6 egress addresses were matched.
6. Confirmation that the `Authorization` header reaches WordPress/PHP.
7. The results of the three verification tests above.

Please do not request our WooCommerce consumer key or secret. Those credentials are not necessary to identify the edge challenge using the supplied CF-Ray identifiers.

Thank you.

---

# النسخة العربية — للمراجعة أو الإرسال

**العنوان:** تصعيد عاجل إلى Level-2 — تحدي Cloudflare يحجب WooCommerce API رغم إضافة IP الخاص بالـVPS إلى القائمة البيضاء

مرحبًا فريق Bluehost،

نرجو تصعيد هذه الحالة إلى فريق **Advanced / Level-2 CDN Security / Newfold Edge Team**.

تم إبلاغنا بإضافة عنوان IP الخاص بالـVPS إلى القائمة البيضاء، لكن سلوك الحجب لم يتغير. يرجّح ذلك أن القائمة البيضاء أُضيفت في طبقة خادم الأصل فقط، مثل cPanel/CSF أو ModSecurity أو Wordfence أو SiteLock، بينما يستمر الحجب في طبقة Cloudflare/Newfold edge التي تسبق WordPress والخادم نفسه.

## البيئة المؤكدة

- النطاق: `iconnect-intl.com`
- مسار WooCommerce: `/store`
- خوادم الأسماء:
  - `ns1.bluehost.com`
  - `ns2.bluehost.com`
- سجل A: `66.235.200.147`
- شبكة الأصل: Bluehost/Newfold (`host77.ipowerweb.com`)

رغم ذلك، تحمل الردود:

```text
Server: cloudflare
CF-Ray: ...
Cf-Mitigated: challenge
cType: interactive
```

## الدليل الأول — طلب عام لا يستخدم أي مفاتيح WooCommerce

تم تنفيذ الطلب التالي مباشرة من Terminal الخاص بالـVPS الذي يعمل عليه n8n:

```text
GET /store/wp-json/wc/store/v1/products/categories?per_page=5
```

وكان الرد:

```text
HTTP/2 403
Content-Type: text/html; charset=UTF-8
Server: cloudflare
Cf-Mitigated: challenge
CF-Ray: a250bdc32d7caa9c-FRA
Challenge type: interactive
UTC timestamp: 2026-08-02 23:07:52 GMT
```

هذا endpoint عام ولا يستخدم WooCommerce credentials، ولذلك لا يمكن أن يكون سبب الفشل هو المفاتيح أو إعداد Basic Authentication في n8n.

## الدليل الثاني — طلب Classic API موثق

تم تنفيذ:

```text
GET /store/wp-json/wc/v3/products/8825
```

وكان الرد:

```text
HTTP/2 403
Content-Type: text/html; charset=UTF-8
Server: cloudflare
Cf-Mitigated: challenge
CF-Ray: a250be81cdc2d412-FRA
Challenge type: interactive
UTC timestamp: 2026-08-02 23:08:22 GMT
```

الطلبان تم حجبهما قبل وصولهما إلى WordPress/WooCommerce.

## لماذا لم تنجح القائمة البيضاء الحالية؟

استمرار `Cf-Mitigated: challenge` يثبت أن قرار الحجب ما زال يصدر في طبقة Cloudflare/Newfold edge قبل خادم الأصل. لذلك فإن whitelist في cPanel أو CSF أو ModSecurity أو Wordfence أو SiteLock داخل WordPress لا تكفي.

يرجى تحديد المكان الذي أُضيفت فيه القائمة البيضاء الحالية وتزويدنا بمعرّف التغيير أو القاعدة.

## الإجراءات المطلوبة

### 1. تحديد قاعدة الـEdge الفعلية

يرجى البحث في سجلات Edge Security باستخدام:

```text
a250bdc32d7caa9c-FRA — 2026-08-02 23:07:52 GMT
a250be81cdc2d412-FRA — 2026-08-02 23:08:22 GMT
```

ونرجو إبلاغنا بـ:

- اسم خدمة CDN/edge/security الفعلية.
- معرّف القاعدة التي أصدرت Interactive Challenge.
- نوع الإجراء الذي نُفذ.
- هل صدر من Bot Management أو Managed Challenge أو WAF أو DDoS protection أو Bluehost/Newfold CDN أو SiteLock أو تكامل آخر.

يجب تطبيق الاستثناء في نفس طبقة الـedge التي أنشأت قيم CF-Ray، وليس إضافة قائمة سماح أخرى على خادم الأصل.

### 2. التأكد من عنوان خروج الـVPS الفعلي

عنوان IPv4 العام الفعلي:

```text
109.123.240.106
```

يرجى التحقق أيضًا من IPv6 الخاص بخروج VPS أو Docker، إن كان مستخدمًا، وإضافته إلى القائمة البيضاء أو إجبار الاتصال على استخدام IPv4 المسموح.

### 3. إنشاء قاعدة استثناء في طبقة Edge

المنطق المطلوب:

```text
IF source IP is in {OUR_VPS_PUBLIC_EGRESS_IPS}
AND request path starts with "/store/wp-json/wc/"
THEN:
  skip Bot Management challenge
  skip managed challenge
  skip interactive challenge
  skip the managed WAF challenge producing Cf-Mitigated: challenge
  allow the request to continue to origin
```

المسارات المطلوبة:

```text
/store/wp-json/wc/v3/*
/store/wp-json/wc/store/*
/store/wp-json/wc/store/v1/*
```

مع إبقاء HTTPS ومصادقة WooCommerce وrate limiting وحماية باقي الموقع مفعّلة. لا نطلب تعطيل الحماية عن الموقع بالكامل.

### 4. ترتيب القاعدة ونشرها

يرجى التأكد من أن قاعدة الاستثناء:

- تسبق قواعد block/challenge.
- مطبقة في نفس طبقة edge المسؤولة عن CF-Ray.
- منشورة بالكامل وتم انتظار propagation.
- وتم مسح أي CDN/edge configuration قديم إن لزم.

ونرجو تزويدنا بمعرّف القاعدة الجديدة.

### 5. تمرير Authorization Header

يرجى تأكيد تمرير:

```text
Authorization: Basic ...
```

إلى WordPress/PHP دون حذف أو تعديل، لأنه مطلوب في WooCommerce Classic REST API.

## الاختبارات المطلوبة بعد التعديل

من عنوان خروج الـVPS نفسه:

1. Store API العام:

```text
GET /store/wp-json/wc/store/v1/products/categories?per_page=1
```

يجب أن يرجع `HTTP 200` وJSON.

2. Classic API بمفتاح صالح:

```text
GET /store/wp-json/wc/v3/products/categories?per_page=1
```

يجب أن يرجع `HTTP 200` وJSON.

3. Classic API بمفتاح غير صالح:

يجب أن يرجع `HTTP 401` وخطأ WooCommerce بصيغة JSON.

لا يجوز أن يعيد أي اختبار:

```text
Content-Type: text/html
Cf-Mitigated: challenge
Just a moment...
```

## إذا تعذّر عمل الاستثناء في طبقة الحماية

نطلب أحد البديلين:

1. نطاق API فرعي، مثل:

```text
api.iconnect-intl.com
```

يُوجه مباشرة إلى خادم الأصل أو خارج طبقة Bot Challenge، ويتم تأمينه باستخدام HTTPS وfirewall allowlist لعنوان VPS ومصادقة WooCommerce وrate limiting.

2. أو تعطيل Managed Bot/Interactive Challenge للمسار التالي فقط:

```text
/store/wp-json/*
```

مع إبقاء الحماية على باقي الموقع.

## المعلومات المطلوبة في ردكم

يرجى تزويدنا بـ:

1. اسم المنتج أو التكامل الذي يضيف Cloudflare.
2. Rule ID الخاص بالحجب من قيم CF-Ray.
3. المكان الذي طُبقت فيه القائمة البيضاء الأولى.
4. Rule ID الخاص باستثناء edge الجديد.
5. تأكيد مطابقة عناوين IPv4 وIPv6 الفعلية.
6. تأكيد وصول Authorization header إلى WordPress/PHP.
7. نتائج اختبارات التحقق الثلاثة.

لا نحتاج إلى إرسال WooCommerce consumer key أو secret لتشخيص تحدي Cloudflare، ولذلك لن نضع المفاتيح في التذكرة.

شكرًا.
