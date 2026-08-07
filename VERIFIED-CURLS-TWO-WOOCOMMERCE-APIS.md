# طلبات cURL المتحقَّق منها لعائلتَي WooCommerce API

تغطي الاختبارات عائلتين:

- **Classic REST API — `/wc/v3`**: تستخدم **Basic Auth** عبر `--user`.
- **Store API — `/wc/store/v1`**: قراءات المنتجات العامة، بلا مصادقة.

أُجريت **3 محاولات GET مستقلة لكل URL** من البيئة الحالية. نجحت الطلبات أدناه بالنسبة المبينة وأعادت HTTP 200 وبيانات WooCommerce JSON المقصودة، لكن هذه عينة اختبار محدودة وليست ضمانًا للاستمرارية.

## Classic REST API — `/wc/v3`

### C1 — عرض فئات المنتجات

- **الغرض:** جلب أول 5 فئات، مرتبة بالاسم تصاعديًا.
- **نسبة النجاح المختبرة:** `3/3`.

```bash
curl --request GET \
  --url 'https://iconnect-intl.com/store/wp-json/wc/v3/products/categories?per_page=5&orderby=name&order=asc' \
  --user '<CONSUMER_KEY>:<CONSUMER_SECRET>' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' \
  --header 'Accept: application/json,text/plain,*/*' \
  --header 'Accept-Language: ar,en-US;q=0.9,en;q=0.8' \
  --header 'Referer: https://iconnect-intl.com/store/' \
  --header 'Origin: https://iconnect-intl.com' \
  --header 'Sec-Fetch-Site: same-origin' \
  --header 'Sec-Fetch-Mode: cors' \
  --header 'Sec-Fetch-Dest: empty'
```

**الاستجابة المتوقعة:** مصفوفة JSON لفئات المنتجات؛ تضمنت العينة الفئتين ذواتَي المعرّفين `392` و`358`.

### C2 — البحث عن المنتجات

- **الغرض:** البحث عن `cat6` وإرجاع حتى 5 منتجات.
- **نسبة النجاح المختبرة:** `3/3`.

```bash
curl --request GET \
  --url 'https://iconnect-intl.com/store/wp-json/wc/v3/products?search=cat6&per_page=5' \
  --user '<CONSUMER_KEY>:<CONSUMER_SECRET>' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' \
  --header 'Accept: application/json,text/plain,*/*' \
  --header 'Accept-Language: ar,en-US;q=0.9,en;q=0.8' \
  --header 'Referer: https://iconnect-intl.com/store/' \
  --header 'Origin: https://iconnect-intl.com' \
  --header 'Sec-Fetch-Site: same-origin' \
  --header 'Sec-Fetch-Mode: cors' \
  --header 'Sec-Fetch-Dest: empty'
```

**الاستجابة المتوقعة:** مصفوفة JSON لمنتجات مطابقة؛ تضمنت العينة المنتجين `8825` و`8822`.

### C3 — تفاصيل منتج

- **الغرض:** جلب المنتج ذي المعرّف `8825`.
- **نسبة النجاح المختبرة:** `3/3`.

```bash
curl --request GET \
  --url 'https://iconnect-intl.com/store/wp-json/wc/v3/products/8825' \
  --user '<CONSUMER_KEY>:<CONSUMER_SECRET>' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' \
  --header 'Accept: application/json,text/plain,*/*' \
  --header 'Accept-Language: ar,en-US;q=0.9,en;q=0.8' \
  --header 'Referer: https://iconnect-intl.com/store/' \
  --header 'Origin: https://iconnect-intl.com' \
  --header 'Sec-Fetch-Site: same-origin' \
  --header 'Sec-Fetch-Mode: cors' \
  --header 'Sec-Fetch-Dest: empty'
```

**الاستجابة المتوقعة:** كائن JSON للمنتج `8825` باسم «كابل شبكة هيكفيجن CAT6 UTP نحاس DS-1LN6-UU».

## Store API — `/wc/store/v1`

نجح الشكلان المختبران للـ namespace بالتساوي، لذلك اختير الشكل ذي الإصدار `/wc/store/v1` للطلبات الجاهزة أدناه.

### S1 — عرض فئات المنتجات

- **الغرض:** جلب أول 5 فئات عامة.
- **URL المختار:** `https://iconnect-intl.com/store/wp-json/wc/store/v1/products/categories?per_page=5`
- **نسب النجاح المختبرة:** `/wc/store/v1`: `3/3`؛ `/wc/store`: `3/3`.

```bash
curl --request GET \
  --url 'https://iconnect-intl.com/store/wp-json/wc/store/v1/products/categories?per_page=5' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' \
  --header 'Accept: application/json,text/plain,*/*' \
  --header 'Accept-Language: ar,en-US;q=0.9,en;q=0.8' \
  --header 'Referer: https://iconnect-intl.com/store/' \
  --header 'Origin: https://iconnect-intl.com' \
  --header 'Sec-Fetch-Site: same-origin' \
  --header 'Sec-Fetch-Mode: cors' \
  --header 'Sec-Fetch-Dest: empty'
```

**الاستجابة المتوقعة:** مصفوفة JSON لفئات المنتجات؛ تضمنت العينة الفئتين ذواتَي المعرّفين `392` و`358`.

### S2 — البحث عن المنتجات

- **الغرض:** البحث العام عن `cat6` وإرجاع حتى 5 منتجات.
- **URL المختار:** `https://iconnect-intl.com/store/wp-json/wc/store/v1/products?search=cat6&per_page=5`
- **نسب النجاح المختبرة:** `/wc/store/v1`: `3/3`؛ `/wc/store`: `3/3`.

```bash
curl --request GET \
  --url 'https://iconnect-intl.com/store/wp-json/wc/store/v1/products?search=cat6&per_page=5' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' \
  --header 'Accept: application/json,text/plain,*/*' \
  --header 'Accept-Language: ar,en-US;q=0.9,en;q=0.8' \
  --header 'Referer: https://iconnect-intl.com/store/' \
  --header 'Origin: https://iconnect-intl.com' \
  --header 'Sec-Fetch-Site: same-origin' \
  --header 'Sec-Fetch-Mode: cors' \
  --header 'Sec-Fetch-Dest: empty'
```

**الاستجابة المتوقعة:** مصفوفة JSON لمنتجات مطابقة؛ تضمنت العينة المنتجين `8825` و`8822`.

### S3 — تفاصيل منتج

- **الغرض:** جلب التفاصيل العامة للمنتج `8825`.
- **URL المختار:** `https://iconnect-intl.com/store/wp-json/wc/store/v1/products/8825`
- **نسب النجاح المختبرة:** `/wc/store/v1`: `3/3`؛ `/wc/store`: `3/3`.

```bash
curl --request GET \
  --url 'https://iconnect-intl.com/store/wp-json/wc/store/v1/products/8825' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' \
  --header 'Accept: application/json,text/plain,*/*' \
  --header 'Accept-Language: ar,en-US;q=0.9,en;q=0.8' \
  --header 'Referer: https://iconnect-intl.com/store/' \
  --header 'Origin: https://iconnect-intl.com' \
  --header 'Sec-Fetch-Site: same-origin' \
  --header 'Sec-Fetch-Mode: cors' \
  --header 'Sec-Fetch-Dest: empty'
```

**الاستجابة المتوقعة:** كائن JSON للمنتج `8825` باسم «كابل شبكة هيكفيجن CAT6 UTP نحاس DS-1LN6-UU».

## الطلبات الفاشلة أو غير الموثوقة

لا توجد ضمن النتائج المقدمة طلبات دون حد التحقق `2/3`؛ جميع الطلبات المدرجة أعلاه حققت `3/3` في بيئة الاختبار الحالية.

## ملاحظات الاستيراد إلى n8n

- عند استيراد cURL، يتحول `--user` إلى ترويسة `Authorization: Basic …`؛ لا تضع المفاتيح في query string.
- احتفظ بجميع الترويسات كما هي في الطلبات أعلاه.
- اضبط **Retry On Fail = 6** و **Wait Between Tries = 3000 ms**.
- إعادة المحاولة لا تستطيع حل تحدٍّ تفاعلي من Cloudflare بصورة موثوقة.
- الاختبار تم من **البيئة الحالية**؛ قد تتصرف عناوين IP الخاصة بـ **n8n Cloud** بصورة مختلفة.

## مقارنة مختصرة

| العائلة | المصادقة | الاستخدام المختبر | القيود |
|---|---|---|---|
| Classic `/wc/v3` | Basic Auth بالمفتاح والسر | قراءة الفئات، البحث، وتفاصيل منتج | تتطلب بيانات اعتماد؛ النجاح المقاس `3/3` لكل طلب من البيئة الحالية فقط |
| Store `/wc/store/v1` | بلا مصادقة للقراءات المختبرة | قراءات عامة للفئات، البحث، وتفاصيل منتج | قراءات منتجات عامة فقط ضمن هذا الاختبار؛ كلا شكلي namespace حقق `3/3`، وقد تختلف n8n Cloud |
