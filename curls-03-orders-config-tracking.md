# 03 — Orders, Tracking & Store Config (Phase 4 chatbot)

Test the endpoints the chatbot needs to **track orders, show order history, list payment/shipping options, and read store configuration**.

All read-only GET (Classic API `/wc/v3/`, with `--user`). Safe to run anytime — they will NOT modify the store.

---

## How to use these in n8n

1. HTTP Request node → **Import cURL** → paste a command.
2. **Mandatory Cloudflare header:** keep `-H "User-Agent: …"` (n8n's default UA is blocked → 403).
3. **Retry On Fail:** node Settings → ON, Max Tries = 6, Wait = 2000 ms (Cloudflare intermittent challenges).
4. All these use **Basic Auth** (`--user ck_…:cs_…`) — server-side only, never expose to the client.

**Credentials (read/write):**
- Key: `ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b`
- Secret: `cs_234e5af2614e76e372b33675fbcc3ea80eedba3e`

**Live reference:** order `6587` (processing, 13728.00 SAR, customer Mohamed Hussein).

---

## A. List recent orders

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/orders?per_page=10&orderby=date&order=desc" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
Inspect per order: `id`, `status`, `total`, `currency`, `payment_method`, `payment_method_title`, `customer_id`, `billing`, `shipping`, `line_items`, `customer_note`, `order_key`, `date_created`.

---

## B. Get a single order (full detail)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/orders/6587" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

---

## C. Order status notes / timeline

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/orders/6587/notes?per_page=50" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
Use this to build an order-status timeline for the chatbot (e.g. "paid → processing → shipped").

---

## D. Order refunds

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/orders/6587/refunds" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Returns `[]` if no refunds (typical).

---

## E. Track order by billing email (chatbot "where is my order?" lookup)

```bash
# Replace the email — this is how the chatbot finds an order for a guest who only knows their email
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/orders?billing_email=mohamed.hussein@iconnect-intl.com&per_page=10" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Chatbot flow: look up by email, then verify the caller also knows the matching phone number before returning details (PII protection).

---

## F. Filter orders by status (e.g. show only "processing")

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/orders?status=processing&per_page=20" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
Status values: `pending`, `processing`, `on-hold`, `completed`, `cancelled`, `refunded`, `failed`.

---

## G. List customers (note: empty on this guest-checkout store)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/customers?per_page=20" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Expect `[]` — this store uses guest checkout, no registered customers. For order history, query orders by `customer` or `billing_email`.

---

## H. List payment gateways  (CRITICAL for checkout)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/payment_gateways" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Inspect `enabled` per gateway. On this store only **`wctelr` (Telr — online card)** is enabled; `cod`, `bacs`, `cheque`, `wc_telr_apple_pay` are disabled. The chatbot should read this live, not hardcode.

---

## I. List shipping zones

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/shipping/zones" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

---

## J. List shipping methods for a zone (Zone 1 = Saudi Arabia)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/shipping/zones/1/methods" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Zone 1 has `free_shipping` + `flat_rate` enabled. Zone 0 (Rest of World) has no methods → delivery is Saudi Arabia only.

---

## K. List coupons (note: none configured)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/coupons?per_page=20" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Expect `[]`.

---

## L. Taxes (classes)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/taxes/classes" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Returns `standard`, `reduced-rate`, `zero-rate`. No rates are configured → all orders are 0% tax.

---

## M. Countries / states (for checkout address forms)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/data/countries" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> ~218 KB. Use to populate country/state dropdowns and validate addresses. Arabic names included.

---

## N. Webhooks (OTO shipping integration)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/webhooks?per_page=20" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> 6 active webhooks → all sync to OTO (tryoto.com). Orders placed via the chatbot auto-flow to OTO fulfillment.

---

## O. Reports (order status overview)

```bash
# Order totals by status
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/reports/orders/totals" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

```bash
# Product totals (simple vs variable counts)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/reports/products/totals" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

---

## P. System status (store environment)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/system_status" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Large response. Confirms: WooCommerce 10.9.4, language `ar`, currency SAR, PHP 8.3.32, MySQL 5.7.23, store_id, etc.

---

## What this tells you for the chatbot

- **Order tracking** has two paths: Store API `GET /wc/store/order/{id}?key={key}` (no admin auth, key proves ownership) OR Classic `GET /wc/v3/orders?billing_email=...` (backend verifies phone match).
- **Payment options** must be read live from `/wc/v3/payment_gateways` — currently only Telr (`wctelr`) is enabled.
- **Shipping** is Saudi-Arabia-only (Zone 1: free + flat rate). The chatbot should reject non-KSA delivery addresses.
- **PII**: order responses contain email/phone/address — strip/mask before showing to unverified users.
- Orders auto-sync to **OTO** via webhooks, so the chatbot doesn't need its own shipping integration.
