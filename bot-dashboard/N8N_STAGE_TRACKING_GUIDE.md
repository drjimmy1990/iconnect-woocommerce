# دليل تتبع حالات ودورات حياة العملاء في n8n (iConnect CRM Client Lifecycle)

هذا الدليل يوضح بنية ودورة حياة العميل (Client Lifecycle Status) وتصنيف اهتماماته بالمنتجات (11 Product Categories) وتحديثها تلقائياً بين n8n وقاعدة بيانات Supabase ولوحة التحكم (Dashboard).

---

## 🧭 دورة حياة العميل المعتمدة (Client Lifecycle Statuses)

| الحالة (`client_type`) | المعنى | متى يتم تعيينها؟ |
|---|---|---|
| **`new`** | عميل جديد | الحالة الافتراضية عند إنشاء العميل أول مرة في Supabase |
| **`interested`** | مهتم بالشراء | عندما يسأل العميل عن منتجات أو مواصفات أو أسعار أو تصنيف معين |
| **`customer`** | مشتري / عميل دفع | عندما يكتمل إنشاء الطلب بنجاح (`intent: "order_created"`) |
| **`repeat_customer`** | عميل متكرر | عندما يقوم العميل بإنشاء أكثر من طلب شراء ناجح |
| **`support`** | خدمة عملاء / دعم | عند الشكاوى أو طلب التحدث لموظف أو تأخر الشحن أو الإرجاع والإلغاء |
| **`inactive`** | غير نشط | للعملاء غير المتفاعلين لفترة طويلة |

---

## 🏷️ تصنيفات المنتجات الرسمية الـ 11 (Product Categories Taxonomy)

يتم تخزين اهتمامات العميل داخل مصفوفة `tags: text[]` في جدول `crm_clients`:

1. `Computers & Computing` 💻
2. `Printers & Scanners` 🖨️
3. `Ink, Toner & Printing Supplies` 🖋️
4. `Networking & Connectivity` 🌐
5. `CCTV & Surveillance` 📹
6. `Access Control Systems` 🔐
7. `Security & Alarm Systems` 🚨
8. `IP Telephony & Communication` 📞
9. `Time Attendance & Biometric Systems` ⏱️
10. `Power & Electrical Protection` ⚡
11. `Storage & Backup` 💾

---

## ⚙️ كيف يتم التحديث في n8n؟

### 1. في مسار المحادثة العادية (`conversation` & `product_details`):
* يتم استخراج `category` من الـ AI agent.
* يتم دمج الكاتجوري الجديد مع وسوم العميل السابقة (`tags`) بدون تكرار.
* يتم تحديث `client_type = 'interested'`.

### 2. في مسار إنشاء الطلب (`order_created`):
* يتم تحديث `crm_clients.client_type = 'customer'`.
* يتم إرسال إشعار فوري للداشبورد في جدول `system_notifications` من نوع `order_created`.

### 3. في مسار خدمة العملاء (`customer_service` & `complaint`):
* يتم تحديث `crm_clients.client_type = 'support'`.
* يتم إيقاف الرد الآلي: `contacts.ai_enabled = false`.
* يتم إرسال إشعار فوري للداشبورد في جدول `system_notifications` من نوع `customer_service`.
