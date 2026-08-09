> ⛔ **HISTORICAL (2026-08-02) — RESOLVED.** Cloudflare has since been removed from the store.
> The origin now needs `Cookie: humans_21909=1` + a full browser `User-Agent` (else 409/406),
> which Backend B sends automatically.
> **Current reference:** [curls-n8n-VERIFIED.md](curls-n8n-VERIFIED.md)

# تشخيص حجب WooCommerce API بين Bluehost وCloudflare

**النطاق:** `https://iconnect-intl.com/store`  
**نوع الاختبارات:** قراءة فقط (`GET` و`HEAD` و`OPTIONS`)؛ لم تُعدَّل أي بيانات في المتجر.  
**فترة أدلة HTTP:** 2026-08-02، من 22:41:38 إلى 22:43:01 UTC.  
**ملاحظة:** لم يتبع `curl` أي إعادة توجيه.

## الخلاصة التنفيذية

**نعم، يمكن أن يكون Bluehost هو خادم الأصل ويدير DNS، بينما تمر حركة HTTP الفعلية عبر Cloudflare. الأدلة الحالية تثبت هذا الترتيب بالفعل، حتى مع عدم استخدام nameservers الخاصة بـCloudflare:**

- DNS السلطوي هو Bluehost: `ns1.bluehost.com` و`ns2.bluehost.com` في المحاولات الثلاث.
- سجل `A` أعاد `66.235.200.147` ثلاث مرات، وPTR هو `host77.ipowerweb.com`، والعنوان ضمن `IPOWERWEB-NET`؛ أي شبكة استضافة وليست عنوان Cloudflare anycast تقليدياً.
- مع ذلك، **كل استجابات HTTP الـ87 في مصفوفة curl** حملت `Server: cloudflare` و`CF-Ray`، كما ظهرت هذه الرؤوس في الاستجابات الناجحة والفاشلة.
- الاستجابات المحجوبة حملت `Cf-Mitigated: challenge`، وأنشأت cookie باسم `__cf_bm`، وأعادت صفحة HTML بعنوان `Just a moment...`.
- حتى الاستجابة الناجحة حملت `cf-cache-status: BYPASS`، وظهر cookie باسم `nfd-enable-cf-opt`. هذا قرينة على تكامل/تحسين تديره جهة الاستضافة، لكنه **لا يثبت اسم المنتج أو الخيار الذي فعّله**.

إذن Cloudflare يعالج الطلب قبل WordPress/WooCommerce. الأكثر اتساقاً مع الأدلة هو وجود طبقة edge/CDN/WAF/bot protection مُدارة من مزود الاستضافة أو تكامل قديم، وليس إعداد Cloudflare التقليدي الذي يغيّر nameservers. يجب على Bluehost تحديد الطبقة الفعلية من سجلاتهم؛ لا تكفي أسماء المنتجات المحتملة لإثبات أي منها.

## لماذا ليست المشكلة مفتاح WooCommerce خاطئاً؟

هناك توقيعان مختلفان بوضوح:

| الحالة | ما يُتوقع/شوهد |
|---|---|
| رفض اعتماد من WooCommerce أو عدم وصول Basic auth إلى المسار الصحيح | `HTTP 401`، و`Content-Type: application/json; charset=UTF-8`، وجسم JSON يحوي `woocommerce_rest_cannot_view`، مع غياب `Cf-Mitigated` |
| الحجب الحالي عند الحافة | `HTTP 403`، و`Content-Type: text/html; charset=UTF-8`، و`Server: cloudflare`، و`Cf-Mitigated: challenge`، و`CF-Ray`، وجسم HTML بعنوان `Just a moment...` |

المسار القانوني نفسه مع Basic auth أعاد بيانات الفئات بصيغة JSON مرتين، ثم تحدي Cloudflare في المحاولة الثالثة. هذا يثبت أن الطلب يستطيع الوصول إلى WooCommerce وأن بيانات الاعتماد تعمل عندما تسمح طبقة الحافة بالمرور. لذلك **سبب خطأ n8n الموثق هو تحدي Cloudflare التفاعلي قبل WordPress، وليس خطأ مصادقة WooCommerce**.

ظهور `E401` في بعض صيغ `rest_route` البديلة لا يغيّر هذا الاستنتاج؛ فهو رد JSON من التطبيق، بخلاف `CH403` الصادر من Cloudflare.

## أدلة DNS وTLS المختصرة

| الفحص | المحاولة 1 | المحاولة 2 | المحاولة 3 |
|---|---|---|---|
| `iconnect-intl.com A` عبر `8.8.8.8` | `66.235.200.147` | `66.235.200.147` | `66.235.200.147` |
| `AAAA` | NOERROR/NODATA | NOERROR/NODATA | NOERROR/NODATA |
| `CNAME` | NOERROR/NODATA | NOERROR/NODATA | NOERROR/NODATA |
| `NS` | Bluehost | Bluehost | Bluehost |
| `www` A/AAAA/CNAME | NXDOMAIN | NXDOMAIN | NXDOMAIN |

- SOA: `ns1.bluehost.com`، والمسؤول `root.box2538.bluehost.com`، والرقم التسلسلي `2025111000`.
- ARIN RDAP نجح في محاولتين من ثلاث وأعاد `IPOWERWEB-NET`، النطاق `66.235.195.0–66.235.200.255`؛ المحاولة الأولى أُعيد ضبط اتصالها.
- شهادة TLS كانت متطابقة في المحاولات الثلاث: `CN=iconnect-intl.com`، الجهة المصدرة `Google Trust Services, CN=WE1`، الصلاحية 2026-07-24 إلى 2026-10-22، وبصمة SHA-256:
  `6B:93:69:B7:63:EF:48:C3:89:19:2C:76:17:64:11:5E:5C:7F:5B:9F:AB:8D:0E:E8:B5:F1:97:5C:B2:9C:E9:B7`.

## مصفوفة curl الكاملة: 29 صيغة × 3 محاولات

### مفتاح النتائج

كل الخانات أدناه هي `النتيجة / CF-Ray`. في جميع الطلبات الـ87:

- `Server: cloudflare`.
- رأس `Location` **غائب**؛ لم تحدث إعادة توجيه.

| الرمز | Status | Content-Type | Cf-Mitigated | الجسم |
|---|---:|---|---|---|
| `J200` | `200` | `application/json; charset=UTF-8` | غائب | JSON صالح يبدأ بـ`[` ويحتوي مصفوفة فئات بعنصر واحد |
| `E401` | `401` | `application/json; charset=UTF-8` | غائب | JSON يبدأ بـ`{` ويحوي `woocommerce_rest_cannot_view` |
| `CH403` | `403` | `text/html; charset=UTF-8` | `challenge` | HTML تحدي Cloudflare يبدأ بـ`<` وعنوانه `Just a moment...` |
| `HH403` | `403` | `text/html; charset=UTF-8` | `challenge` | رد `HEAD` بلا جسم تمثيلي |

`Basic` يعني HTTP Basic auth. و`query auth` يعني تمرير `consumer_key` و`consumer_secret` في عنوان URL. والصيغ `D1/D2/D3` اختبرت Basic auth مع ملفات رؤوس مختلفة كما هو موضح.

| الصيغة | شكل الطلب | المحاولة 1 | المحاولة 2 | المحاولة 3 | نجاح JSON |
|---|---|---|---|---|---:|
| A1 | Canonical + Basic + curl UA | `CH403 / a2509756ce6b658b-MRS` | `CH403 / a2509759ad4e5d43-MRS` | `CH403 / a250975c79ebc0fb-MRS` | 0/3 |
| B1 | Root `rest_route` + Basic | `CH403 / a250975f1f463072-MRS` | `CH403 / a25097619db2376c-MRS` | `CH403 / a2509765bcc8762f-MRS` | 0/3 |
| B2 | `index.php?rest_route` + Basic | `CH403 / a25097691e629822-MRS` | `CH403 / a250976c2c4e26d8-MRS` | `CH403 / a250976edf88e1f1-MRS` | 0/3 |
| C1 | Canonical + query auth | `CH403 / a25097719a4a078b-MRS` | `CH403 / a25097742e1c1ed5-MRS` | `CH403 / a25097774e14e195-MRS` | 0/3 |
| C2 | Root `rest_route` + query auth | `CH403 / a250977a0e2be274-MRS` | `CH403 / a250977d0a5ffb98-MRS` | `CH403 / a250977fdfe76cb1-MRS` | 0/3 |
| C3 | Index `rest_route` + query auth | `CH403 / a2509782aca9e214-MRS` | `CH403 / a25097855960e189-MRS` | `CH403 / a2509787de8be1fd-MRS` | 0/3 |
| D1.1 | Canonical + default headers | `CH403 / a250978a9c8d37a8-MRS` | `CH403 / a250978d594f531c-MRS` | `CH403 / a25097901ffba9cc-MRS` | 0/3 |
| D1.2 | Canonical + browser UA فقط | `CH403 / a2509792eaed53a8-MRS` | `CH403 / a25097954c98e19e-MRS` | `CH403 / a25097974dfbe23f-MRS` | 0/3 |
| **D1.3** | **Canonical + Basic + full browser-ish headers** | **`J200 / a25097996def0ba3-MRS`** | **`J200 / a25097a8b9c88ada-MRS`** | **`CH403 / a25097b9ef1c2e37-MRS`** | **2/3** |
| D1.4 | Canonical + n8n/minimal | `CH403 / a25097bcad4ce219-MRS` | `CH403 / a25097bf3d0bb6c4-MRS` | `J200 / a25097c1e8984348-MRS` | 1/3 |
| D2.1 | Root route + default headers | `CH403 / a25097d188dfe159-MRS` | `CH403 / a25097d44cf8e243-MRS` | `CH403 / a25097d6c957aead-MRS` | 0/3 |
| D2.2 | Root route + browser UA | `E401 / a25097d96e6f277f-MRS` | `CH403 / a25097e7bfdee1a6-MRS` | `CH403 / a25097ea3e55d746-MRS` | 0/3 |
| D2.3 | Root route + full browser-ish | `E401 / a25097ecdf7ae177-MRS` | `E401 / a25097fb2d2dc611-MRS` | `E401 / a25098073b9ec84f-MRS` | 0/3 |
| D2.4 | Root route + n8n/minimal | `CH403 / a250981368728749-MRS` | `CH403 / a25098163f9d9d99-MRS` | `E401 / a25098191fee61ee-MRS` | 0/3 |
| D3.1 | Index route + default headers | `CH403 / a25098265cc6e1dd-MRS` | `CH403 / a2509828f96fe240-MRS` | `CH403 / a250982b4e8bfc1f-MRS` | 0/3 |
| D3.2 | Index route + browser UA | `E401 / a250982dec5873ab-MRS` | `CH403 / a250983b78f64c05-MRS` | `CH403 / a250983e48cffb6d-MRS` | 0/3 |
| D3.3 | Index route + full browser-ish | `E401 / a2509840c873078b-MRS` | `E401 / a250984edf389d86-MRS` | `E401 / a250985dfc67fb6d-MRS` | 0/3 |
| D3.4 | Index route + n8n/minimal | `CH403 / a250986a1920e28d-MRS` | `CH403 / a250986cba0eb24a-MRS` | `CH403 / a250986f4d05aead-MRS` | 0/3 |
| E1 | Canonical + cache buster | `CH403 / a25098721a2ae191-MRS` | `CH403 / a25098749d4f89c7-MRS` | `CH403 / a25098773962e229-MRS` | 0/3 |
| E2 | Root route + cache buster | `CH403 / a250987a0fa98749-MRS` | `CH403 / a250987d7b90ae33-MRS` | `CH403 / a250987fcea3ad93-MRS` | 0/3 |
| E3 | Index route + cache buster | `CH403 / a25098820c86cac8-MRS` | `CH403 / a2509885df24e1e8-MRS` | `CH403 / a250988868932503-MRS` | 0/3 |
| F1 | Canonical `HEAD` | `HH403 / a250988b084a70e7-MRS` | `HH403 / a250988c7b966488-MRS` | `HH403 / a250988e1ad01ed5-MRS` | 0/3 |
| F2 | Canonical `OPTIONS` | `CH403 / a250988f9f42b416-MRS` | `CH403 / a2509891dcb9e167-MRS` | `CH403 / a25098948aa39a42-MRS` | 0/3 |
| G1 | Public Store API v1 canonical | `CH403 / a25098973ee8acfb-MRS` | `CH403 / a2509899e8b8f31b-MRS` | `CH403 / a250989cef67f4f6-MRS` | 0/3 |
| G2 | Public Store API unversioned canonical | `CH403 / a250989f8cacb416-MRS` | `CH403 / a25098a22b384b31-MRS` | `CH403 / a25098a4adb09d86-MRS` | 0/3 |
| G3 | Public Store API v1 root route | `CH403 / a25098a75d584e0f-MRS` | `CH403 / a25098a9f965e187-MRS` | `CH403 / a25098ac982be28e-MRS` | 0/3 |
| G4 | Public Store API unversioned root route | `CH403 / a25098af4b0caa1e-MRS` | `CH403 / a25098b53915e1fd-MRS` | `CH403 / a25098bb384753a8-MRS` | 0/3 |
| G5 | Public Store API v1 index route | `CH403 / a25098c17e264a32-MRS` | `CH403 / a25098c3b9d0e1f9-MRS` | `CH403 / a25098c66aa997eb-MRS` | 0/3 |
| G6 | Public Store API unversioned index route | `CH403 / a25098c90a08a65d-MRS` | `CH403 / a25098cb990c6488-MRS` | `CH403 / a25098ce7b0ee221-MRS` | 0/3 |

### نتيجة المصفوفة

- الصيغة الوحيدة التي حققت شرط **نجاح JSON في محاولتين على الأقل من ثلاث** هي `D1.3`: نجاحان ثم تحدٍّ، أي `2/3`.
- `D1.4` نجحت `1/3` فقط.
- جميع صيغ query-string auth كانت `0/3`.
- لم تُرجع أي صيغة بديلة للمسار، أو cache buster، أو `HEAD`/`OPTIONS`، أو Store API العامة بيانات فئات في `2/3`.
- إجمالاً، لا توجد صيغة موثوقة للإنتاج: حتى أفضل صيغة فشلت في المحاولة الثالثة. تغيير User-Agent والرؤوس ليس تجاوزاً موثوقاً لتحدي تفاعلي، ولا ينبغي بناء workflow إنتاجي عليه.

## أمر curl الوحيد الجاهز للاستيراد في n8n الذي حقق 2/3

هذا هو **الطلب الوحيد** الذي اجتاز عتبة الاختبار، لكنه لا يزال متقطعاً وليس حلاً إنتاجياً نهائياً:

```bash
curl --request GET \
  --user 'ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' \
  --header 'Accept: application/json,text/plain,*/*' \
  --header 'Accept-Language: ar,en-US;q=0.9,en;q=0.8' \
  --header 'Referer: https://iconnect-intl.com/store/' \
  --header 'Origin: https://iconnect-intl.com' \
  --header 'Sec-Fetch-Site: same-origin' \
  --header 'Sec-Fetch-Mode: cors' \
  --header 'Sec-Fetch-Dest: empty' \
  'https://iconnect-intl.com/store/wp-json/wc/v3/products/categories?per_page=1'
```

لا يوجد curl آخر ثبت نجاحه `>=2/3`، ولذلك لا تُقدَّم أوامر بديلة غير مختبرة ولا يُدّعى وجود bypass.

## curl تشخيصي يُظهر الرؤوس والجسم

هذا الأمر للتشخيص من الطرفية، وليس bypass. الخيار `--include` يُظهر status والرؤوس قبل الجسم، بحيث يمكن التمييز فوراً بين JSON من WooCommerce وصفحة التحدي:

```bash
curl --request GET \
  --include --silent --show-error \
  --user 'ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e' \
  --header 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' \
  --header 'Accept: application/json,text/plain,*/*' \
  --header 'Accept-Language: ar,en-US;q=0.9,en;q=0.8' \
  --header 'Referer: https://iconnect-intl.com/store/' \
  --header 'Origin: https://iconnect-intl.com' \
  --header 'Sec-Fetch-Site: same-origin' \
  --header 'Sec-Fetch-Mode: cors' \
  --header 'Sec-Fetch-Dest: empty' \
  'https://iconnect-intl.com/store/wp-json/wc/v3/products/categories?per_page=1'
```

## ما يُطلب من دعم Bluehost

يُفضّل أن تكون المعالجة في طبقة الحافة، وبأضيق نطاق ممكن:

1. تحديد اسم ومالك طبقة CDN/WAF/bot protection/reverse proxy التي تعالج HTTP للنطاق، رغم أن DNS السلطوي لدى Bluehost.
2. التحقق، كاحتمالات لا كحقائق مثبتة، من:
   - Bluehost CDN أو أي ميزة CDN/security مُدارة من Newfold/Bluehost.
   - تكامل Cloudflare في لوحة الاستضافة.
   - SiteLock أو طبقة حماية مرتبطة به.
   - Cloudflare zone قديمة أو تكامل edge قديم ما زال فعالاً.
3. إنشاء استثناء من **bot/interactive challenge** للمسار `https://iconnect-intl.com/store/wp-json/*`، مع إبقاء HTTPS ومصادقة WooCommerce وضوابط المعدل المناسبة.
4. و/أو allowlist لعناوين خروج n8n الثابتة، إذا كانت خطة n8n توفرها، على هذا المسار فقط.
5. التحقق من أن `Authorization: Basic …` يصل إلى WordPress/PHP للمسار القانوني ولا يُحذف بواسطة proxy.
6. إعادة الاختبار ثلاث مرات على الأقل؛ النتيجة المقبولة هي JSON من التطبيق (`200` عند نجاح الاعتماد أو `401` JSON عند رفضه)، لا HTML مع `Cf-Mitigated: challenge`.

## ملاحظة أمنية مهمة

- إرسال `consumer_key` و`consumer_secret` في query string عبر HTTPS يعني أنهما **مشفّران أثناء النقل** بين العميل والنقطة التي تنهي TLS.
- لكنهما يظهران في عنوان URL، وقد يتسربان إلى سجل تنفيذ n8n، وسجلات proxy/CDN/WAF، وسجلات الوصول، وواجهات المراقبة أو لقطات الشاشة. لذلك يُستخدم query-string auth فقط كتشخيص قصير؛ وقد فشل هنا `0/3` في كل المسارات المختبرة.
- الأفضل في n8n هو حفظ المفتاح والسر في Credentials واستخدام **HTTP Basic auth**، لا وضعهما في URL أو في عقدة كنص ظاهر.
- لأن المفتاح والسر تمت مشاركتهما وظهرا في هذا التقرير، يجب **تدوير/إلغاء المفتاحين بعد اكتمال التشخيص** وإنشاء زوج جديد بأقل صلاحيات لازمة. لا تُرسل المفاتيح في تذكرة الدعم.

## نص تذكرة جاهز إلى Bluehost — العربية

**العنوان:** طلب تحديد وتعطيل تحدي Cloudflare على WooCommerce REST API

> مرحباً فريق Bluehost،
>
> نملك وندير النطاق `iconnect-intl.com` والمتجر الموجود في `/store`. نحتاج مساعدتكم في تحديد طبقة edge/CDN/WAF/bot protection الفعالة أمام الموقع.
>
> DNS السلطوي يستخدم `ns1.bluehost.com` و`ns2.bluehost.com`، وسجل A هو `66.235.200.147`، وPTR هو `host77.ipowerweb.com`. رغم ذلك، كل طلبات HTTP الاختبارية وعددها 87 أعادت `Server: cloudflare` و`CF-Ray`.
>
> طلب قراءة فقط إلى:
> `GET https://iconnect-intl.com/store/wp-json/wc/v3/products/categories?per_page=1`
> نجح مرتين كـHTTP 200 JSON (`CF-Ray: a25097996def0ba3-MRS` و`a25097a8b9c88ada-MRS`)، ثم أعاد في المحاولة الثالثة HTTP 403 و`Content-Type: text/html; charset=UTF-8` و`Server: cloudflare` و`Cf-Mitigated: challenge` و`CF-Ray: a25097b9ef1c2e37-MRS`، مع cookie باسم `__cf_bm` وصفحة بعنوان `Just a moment...`.
>
> هذا تحدٍّ تفاعلي متقطع يحدث قبل WordPress، وليس خطأ اعتماد WooCommerce؛ رد اعتماد WooCommerce يكون JSON 401 مثل `woocommerce_rest_cannot_view`.
>
> يرجى:
> 1. تحديد المنتج أو التكامل الفعلي الذي يضيف Cloudflare لهذه الحركة رغم أن nameservers لدى Bluehost؛ وقد يكون، كاحتمالات تحتاج فحصكم، Bluehost/Newfold CDN أو security feature أو Cloudflare integration أو SiteLock أو Cloudflare zone/تكامل قديم.
> 2. تعطيل bot/interactive challenge للمسار `/store/wp-json/*` فقط، أو إنشاء bypass rule مناسبة لهذا المسار.
> 3. السماح بعناوين خروج n8n الثابتة لهذا المسار إذا زودناكم بها.
> 4. التأكد من تمرير رأس `Authorization` إلى WordPress/PHP.
> 5. تزويدنا باسم الطبقة التي عالجت `CF-Ray: a25097b9ef1c2e37-MRS` والإجراء الذي سيمنع التحدي على REST API.
>
> لا نطلب تعطيل الحماية عن الموقع كله؛ المطلوب استثناء API محدود مع بقاء HTTPS والمصادقة وضوابط المعدل. يمكننا تقديم التوقيت الكامل والـCF-Ray values، لكن لن نرسل مفاتيح WooCommerce في التذكرة.
>
> شكراً.

## Ready-to-send Bluehost ticket — English

**Subject:** Identify and disable Cloudflare challenge on WooCommerce REST API

> Hello Bluehost Support,
>
> We own and control `iconnect-intl.com` and the WooCommerce installation under `/store`. Please help us identify the active edge/CDN/WAF/bot-protection layer in front of this site.
>
> Authoritative DNS uses `ns1.bluehost.com` and `ns2.bluehost.com`; the A record is `66.235.200.147`, and PTR is `host77.ipowerweb.com`. Nevertheless, all 87 test HTTP responses contained `Server: cloudflare` and a `CF-Ray` header.
>
> A read-only request to:
> `GET https://iconnect-intl.com/store/wp-json/wc/v3/products/categories?per_page=1`
> returned HTTP 200 JSON twice (`CF-Ray: a25097996def0ba3-MRS` and `a25097a8b9c88ada-MRS`), then returned HTTP 403 on the third attempt with `Content-Type: text/html; charset=UTF-8`, `Server: cloudflare`, `Cf-Mitigated: challenge`, `CF-Ray: a25097b9ef1c2e37-MRS`, a `__cf_bm` cookie, and an HTML page titled `Just a moment...`.
>
> This is an intermittent interactive edge challenge before WordPress, not a WooCommerce credential rejection. A WooCommerce authentication rejection is an HTTP 401 JSON response such as `woocommerce_rest_cannot_view`.
>
> Please:
> 1. Identify the exact product/integration adding Cloudflare processing even though the nameservers are hosted by Bluehost. Possibilities to investigate—not asserted facts—include a Bluehost/Newfold CDN or security feature, a Cloudflare integration, SiteLock, or an old Cloudflare zone/edge integration.
> 2. Disable bot/interactive challenges for `/store/wp-json/*` only, or add a narrowly scoped bypass rule for that REST path.
> 3. Allowlist our fixed n8n egress IP address(es) for that path once supplied.
> 4. Confirm that the `Authorization` header is forwarded to WordPress/PHP.
> 5. Tell us which active edge layer handled `CF-Ray: a25097b9ef1c2e37-MRS` and what change will prevent REST API challenges.
>
> We are not asking to disable protection for the entire website. We need a narrow API exception while retaining HTTPS, WooCommerce authentication, and appropriate rate limits. We can provide the full timestamps and CF-Ray values, but we will not include WooCommerce keys in the support ticket.
>
> Thank you.

## ملف الأدلة الخام

التفاصيل المضغوطة الكاملة، بما فيها عناوين URL الدقيقة والأحجام وقيم cache-buster، موجودة في:

`C:\Users\LOQ\Desktop\CLI\emirates mostafa\woocommerce\responses\cloudflare-curl-matrix.txt`
