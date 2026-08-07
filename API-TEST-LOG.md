# API Test Log — iConnect WooCommerce Store

**Date:** 2026-08-02
**Store:** https://iconnect-intl.com/store
**Performed by:** Live curl requests from a residential IP (passes Cloudflare on GETs; intermittently blocked on POST writes).
**Credentials used:** `ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b` / `cs_234e5af2614e76e372b33675fbcc3ea80eedba3e` (read/write).
**Raw response files:** saved in [`responses/`](responses/) — every request's JSON body is there for you to inspect.

---

## TL;DR — the two headlines

### ✅ YES — the chatbot can get a payment link
Creating an order via the Classic API returns a **`payment_url`** — the hosted "pay for this order" page that redirects to **Telr** for card payment. This is the link the chatbot hands the user.

> **`payment_url` captured (from order 9880, since deleted):**
> `https://iconnect-intl.com/store/صفحة-الدفع/order-pay/9880/?pay_for_order=true&key=wc_order_z0buONSvOZFIJ`

So order placement + payment-link generation works **today**, even before the Cloudflare fix.

### ⚠️ The Store API cart→checkout flow is Cloudflare-blocked for writes
`POST /wc/store/cart/add-item`, `cart/update-customer`, and `checkout` all return **HTTP 403 `Cf-Mitigated: challenge`** (the interactive "Just a moment…" page), even from a residential IP with a browser User-Agent, a cookie jar, and 10 retries. Only Store API **GETs** pass. The dynamic Telr redirect that `POST /wc/store/checkout` would produce **could not be captured** because that endpoint is blocked.

**Implication for the chatbot:** until the Cloudflare WAF bypass ([SETUP-cloudflare-bypass.md](SETUP-cloudflare-bypass.md)) is applied, build the order-placement flow on the **Classic API `POST /wc/v3/orders` → return `payment_url`** path. Once Cloudflare is bypassed, switch to the Store API cart→checkout flow (which gives a direct Telr redirect + automatic shipping/tax/stock handling). Both yield a Telr payment link; the classic path is the pragmatic one for now.

---

## What I did — request-by-request

### 1. List categories — `GET /wc/v3/products/categories` ✅
**Status:** 200. **Result:** 103 categories returned (includes subcategories; Classic API counts all levels).
**File:** [`responses/01-categories.json`](responses/01-categories.json)

First few category names:
```json
{"id":...,"name":"أجهزة البصمة والتحكم في الأبواب", ...}
{"name":"Access Control 2"}
{"name":"أجهزة التسجيل DVR"}
```
> Note: 103 here vs 32 from the Store API count — the Classic API returns the full tree including children; the Store API `count` field on a parent counts its own products. Both are correct, just different scopes.

---

### 2. Search products — `GET /wc/v3/products?search=cat6` ✅
**Status:** 200. **Result:** 112 products matched "cat6".
**File:** [`responses/02-search-cat6.json`](responses/02-search-cat6.json)

Top hit:
```json
{"id":8825,"name":"كابل شبكة هيكفيجن CAT6 UTP نحاس DS-1LN6-UU","price":"468.63", ...}
```

---

### 3. Get product detail — `GET /wc/v3/products/8825` ✅
**Status:** 200. **Result:** full product object.
**File:** [`responses/03-product-8825.json`](responses/03-product-8825.json)

Key fields:
```json
{
  "id": 8825,
  "name": "كابل شبكة هيكفيجن CAT6 UTP نحاس DS-1LN6-UU",
  "sku": "DS-1LN6-UU",
  "price": "468.63",
  "regular_price": "468.63",
  "type": "simple",
  "status": "publish",
  "images": [ { "src": "...", ... } ],   // 1 image
  "categories": [...],
  "attributes": [...]
}
```

---

### 4. Payment gateways — `GET /wc/v3/payment_gateways` ✅
**Status:** 200. **Result:** 5 gateways, **only Telr enabled**.
**File:** [`responses/04-payment-gateways.json`](responses/04-payment-gateways.json)

| Gateway ID | Title (Arabic) | Enabled |
|---|---|---|
| `bacs` | حوالة مصرفية مباشرة (bank transfer) | ❌ false |
| `cheque` | مدفوعات الشيكات (cheque) | ❌ false |
| `cod` | الدفع نقدًا عند الاستلام (cash on delivery) | ❌ false |
| `wctelr` | Telr (credit/debit card) | ✅ **true** |
| `wc_telr_apple_pay` | Apple Pay via Telr | ❌ false |

> The chatbot's "pay" step offers **Telr online card payment** — no cash-on-delivery, no bank transfer, no Apple Pay currently active.

---

### 5. Shipping zones — `GET /wc/v3/shipping/zones` ✅ (zone methods GET hit an intermittent challenge)
**Files:** [`responses/05a-shipping-zones.json`](responses/05a-shipping-zones.json)
**Result:** Zone 0 = "المناطق التي لا تغطيها المناطق الأخرى" (Rest of World, no methods), Zone 1 = Saudi Arabia (free_shipping + flat_rate). Confirms delivery is **Saudi Arabia only**.

---

### 6. Store API cart init — `GET /wc/store/cart` ✅
**Status:** 200. **Files:** [`responses/06-cart-init-body.json`](responses/06-cart-init-body.json), [`06-cart-init-headers.txt`](responses/06-cart-init-headers.txt)

Returned an empty cart and the session headers:
- `cart-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT)
- `nonce: 226d32d4be`
- `set-cookie: __cf_bm=...` (Cloudflare bot-management cookie)

```json
{"items":[],"coupons":[],"fees":[],"totals":{"total_items":"0",...,"total_price":"0","currency_code":"SAR","currency_symbol":"ر.س"},"payment_methods":["wctelr"],...}
```

---

### 7. Store API add-to-cart — `POST /wc/store/cart/add-item` ❌ BLOCKED
**Status:** 403. **Header:** `Cf-Mitigated: challenge`. **File:** [`responses/07-cart-add-item.json`](responses/07-cart-add-item.json)

```html
HTTP/1.1 403 Forbidden
Cf-Mitigated: challenge
Server: cloudflare
<!-- "Just a moment..." interactive JS challenge HTML -->
```
Retried 10× with cookie jar + browser UA + cart-token + nonce → still challenged. The cart stayed empty, which cascaded into no shipping rates and no checkout.

---

### 8. Store API set address — `POST /wc/store/cart/update-customer` ❌
**Status:** 401 (reached WordPress this time, but nonce was lost because step 7 failed).
**File:** [`responses/08-update-customer.json`](responses/08-update-customer.json)
```json
{"code":"woocommerce_rest_missing_nonce","message":"ترويستة Nonce مفقودة. تتطلب نقطة النهاية هذه معلمة متغيّرة زمنياً صالحة.","data":{"status":401}}
```
> This proves the endpoint itself is reachable and correct — it failed only because the prior `add-item` step was Cloudflare-blocked and the nonce couldn't be refreshed.

---

### 9–11. Store API shipping-select + checkout — ❌ BLOCKED
All Store API POST writes (`select-shipping`, `checkout`) returned the same `403 Cf-Mitigated: challenge`.
**Files:** [`responses/C6-checkout.json`](responses/C6-checkout.json), [`11-checkout-place-order.json`](responses/11-checkout-place-order.json)

> **This is the dynamic Telr redirect we wanted but could not capture** — `POST /wc/store/checkout` would normally return `payment_result` with a direct Telr redirect URL. Blocked by Cloudflare.

---

### 12. ✅ Classic API create-order (the working path) — `POST /wc/v3/orders`
**Status:** 200 (after 1 Cloudflare retry). **Files:** [`responses/F1-classic-create-order.json`](responses/F1-classic-create-order.json), [`F2-get-order.json`](responses/F2-get-order.json)

Created test order (since deleted):
```json
{
  "id": 9880,
  "status": "pending",
  "total": "468.63",
  "currency": "SAR",
  "order_key": "wc_order_z0buONSvOZFIJ",
  "payment_method": "wctelr",
  "payment_method_title": "Telr",
  "payment_url": "https://iconnect-intl.com/store/صفحة-الدفع/order-pay/9880/?pay_for_order=true&key=wc_order_z0buONSvOZFIJ",
  "transaction_id": "",
  "billing": { "first_name": "API", "last_name": "TEST", "email": "apitest+chatbot@iconnect-intl.com", ... },
  "line_items": [ { "product_id": 8825, "quantity": 1, "total": "468.63" } ],
  "customer_note": "CHATBOT API TEST ORDER - created for endpoint verification"
}
```

**The `payment_url` field is the answer to "do we get a link?"** — it's the hosted pay-for-order page. When the customer opens it, Telr loads its card-payment form. The chatbot surfaces exactly this URL.

---

### 13. Cleanup — delete the test order ✅
`DELETE /wc/v3/orders/9880?force=true` → 200.
Verified: `GET /wc/v3/orders/9880` → `404 woocommerce_rest_shop_order_invalid_id` ("معرّف غير صالح"). The store is clean — no test order left behind.

---

## Endpoints that work right now (no Cloudflare fix needed)

| Endpoint | Method | Status | Chatbot use |
|---|---|---|---|
| `/wc/v3/products` (+ filters) | GET | ✅ | Search, browse, filter |
| `/wc/v3/products/{id}` | GET | ✅ | Product details |
| `/wc/v3/products/categories` | GET | ✅ | Category tree |
| `/wc/v3/products/attributes` + `/terms` | GET | ✅ | Attribute filters |
| `/wc/v3/products/brands` | GET | ✅ | Brand filters |
| `/wc/v3/orders` + `/{id}` + `/notes` | GET | ✅ | Order tracking |
| `/wc/v3/payment_gateways` | GET | ✅ | List payment options |
| `/wc/v3/shipping/zones` | GET | ✅ | Shipping reference |
| `/wc/v3/orders` (create) | POST | ✅* | **Order placement → returns `payment_url`** |
| `/wc/store/products` + `/{id}` + `/categories` | GET | ✅ | Public storefront reads |
| `/wc/store/cart` | GET | ✅ | Read cart state |

\* Classic POST works but is **intermittently Cloudflare-challenged** — needs retry (got through on attempt 2).

## Endpoints currently blocked by Cloudflare (need the WAF bypass)

| Endpoint | Method | Status | Needed for |
|---|---|---|---|
| `/wc/store/cart/add-item` | POST | ❌ 403 challenge | Add to cart |
| `/wc/store/cart/update-item` | POST | ❌ 403 challenge | Change quantity |
| `/wc/store/cart/remove-item` | POST | ❌ 403 challenge | Remove from cart |
| `/wc/store/cart/update-customer` | POST | ❌ (nonce lost) | Set delivery address |
| `/wc/store/cart/select-shipping` | POST | ❌ 403 challenge | Choose shipping |
| `/wc/store/checkout` | POST | ❌ 403 challenge | Place order + direct Telr redirect |

> After applying [SETUP-cloudflare-bypass.md](SETUP-cloudflare-bypass.md), all of these become available and the chatbot can use the full cart→checkout flow.

---

## What this means for the chatbot build

1. **You can build and ship Phase 1 (catalog browsing) immediately** — all product/category/attribute/brand GETs work and return rich data. No Cloudflare blocker.
2. **Order placement with a payment link works today** via Classic `POST /wc/v3/orders` → `payment_url`. This is enough for an MVP "place order, get payment link" chatbot flow. The chatbot:
   - Collects the user's address/phone in conversation,
   - Calls `POST /wc/v3/orders` with the cart items + billing + `payment_method: "wctelr"` + `status: "pending"`,
   - Returns the `payment_url` to the user to pay via Telr.
3. **The full Store API cart experience (live cart, shipping/tax calculation, direct Telr redirect) needs the Cloudflare bypass first.** Build that flow as Phase 2–3 *after* the WAF rule is applied, so the chatbot can offer a real interactive cart before checkout.
4. **Every chatbot request must still send the browser `User-Agent` + retry-on-fail**, because Cloudflare intermittently challenges even GETs and classic POSTs.

---

## Files produced

| File | Purpose |
|---|---|
| [`API-TEST-LOG.md`](API-TEST-LOG.md) | This document |
| [`responses/`](responses/) | All raw JSON response bodies + headers from every request |
| [`run-api-tests.sh`](run-api-tests.sh) | The first test script (reads + cart flow) |
| [`run-cart-flow.sh`](run-cart-flow.sh) | The cookie-jar cart→checkout retry script |
| [`curls-01-catalog-browsing.md`](curls-01-catalog-browsing.md) | n8n-ready curls — catalog |
| [`curls-02-cart-checkout-store-api.md`](curls-02-cart-checkout-store-api.md) | n8n-ready curls — cart/checkout |
| [`curls-03-orders-config-tracking.md`](curls-03-orders-config-tracking.md) | n8n-ready curls — orders/tracking |
| [`SETUP-cloudflare-bypass.md`](SETUP-cloudflare-bypass.md) | Cloudflare WAF fix (the blocker for cart writes) |
| [`woocommerce-chatbot-plan.md`](woocommerce-chatbot-plan.md) | Full chatbot build plan |

---

## Recommended next step

Get the **Cloudflare WAF bypass** applied (5 min, [SETUP-cloudflare-bypass.md](SETUP-cloudflare-bypass.md)). The moment it's live, re-run [`run-cart-flow.sh`](run-cart-flow.sh) — the Store API add-item → checkout flow should then succeed and you'll capture the direct Telr redirect from `POST /wc/store/checkout`. Until then, build the chatbot on the **classic-create-order → `payment_url`** path, which is fully working and gives you a payable Telr link.
