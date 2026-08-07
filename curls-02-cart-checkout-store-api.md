# 02 — Cart & Checkout via Store API (Phase 2–3 chatbot)

This is the **cart → address → shipping → payment → place order** flow using the WooCommerce **Store API** (`/wc/store/`). This is the only path that processes real payment (Telr), calculates shipping/tax automatically, and decrements stock.

> ⚠️ **Step H (checkout) creates a REAL order and may charge a card via Telr.** Do not run step H against production unless you intend to. Steps A–G only touch a cart session (harmless; carts auto-expire in ~48h).

---

## How to use these in n8n

1. HTTP Request node → **Import cURL** → paste a command.
2. **Mandatory Cloudflare header:** keep the `-H "User-Agent: …"` on every node (n8n's default UA is blocked → 403).
3. **Retry On Fail:** node Settings → ON, Max Tries = 6, Wait = 2000 ms (Cloudflare intermittently returns an HTML challenge).
4. **Cart-token + nonce are dynamic.** Run **Step A (GET cart)** first; it returns `cart-token` and `nonce` in the **response headers**. Enable "Include Response Headers" on that node, then reference them in later nodes:
   - `{{ $json.headers['cart-token'] }}` → put in a `Cart-Token` request header
   - `{{ $json.headers['nonce'] }}` → put in a `Nonce` request header
5. Store API reads (products, cart GET) are **public** (no `--user`). Cart **mutations** need the cart-token + nonce from step A.

---

## A. Initialize cart session + capture cart-token & nonce

```bash
curl -s -D - -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json"
```
`-D -` dumps response headers so you can see:
- `cart-token: eyJhbGciOi...`  (JWT — save this)
- `nonce: <value>`  (save this)
- `user-id: 0`  (guest)
Expect an empty cart: `{"items":[], "coupons":[], "totals":{"total_items":"0",...}}`.

---

## B. Add product to cart  (needs cart-token + nonce from A)

```bash
curl -s -X POST \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart/add-item" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Cart-Token: PASTE_CART_TOKEN_FROM_STEP_A" \
  -H "Nonce: PASTE_NONCE_FROM_STEP_A" \
  -d '{"id": 8825, "quantity": 1}'
```
Expect **HTTP 201** + full cart object with the item added. The response also returns a **new** cart-token in headers — use the latest one for subsequent calls.
> Replace `PASTE_CART_TOKEN_FROM_STEP_A` and `PASTE_NONCE_FROM_STEP_A` with the real values.

---

## C. View cart  (needs cart-token)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Cart-Token: PASTE_CART_TOKEN_HERE"
```
Inspect: `items[]` (each has a `key` you need for update/remove), `totals` (subtotal, shipping, tax, total), `shipping_rates[]`, `coupons[]`, `payment_methods[]`.

---

## D. Update item quantity  (needs cart-token + nonce)

```bash
# Replace ITEM_KEY with the item "key" from step C, and set quantity
curl -s -X POST \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart/update-item" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Cart-Token: PASTE_CART_TOKEN_HERE" \
  -H "Nonce: PASTE_NONCE_HERE" \
  -d '{"key": "ITEM_KEY_FROM_CART", "quantity": 2}'
```

---

## E. Remove item  (needs cart-token + nonce)

```bash
curl -s -X POST \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart/remove-item" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Cart-Token: PASTE_CART_TOKEN_HERE" \
  -H "Nonce: PASTE_NONCE_HERE" \
  -d '{"key": "ITEM_KEY_FROM_CART"}'
```

---

## F. Set delivery address  (needs cart-token + nonce)

Sets billing + shipping address on the cart → triggers shipping/tax recalculation. Required before you can read shipping rates.

```bash
curl -s -X POST \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart/update-customer" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Cart-Token: PASTE_CART_TOKEN_HERE" \
  -H "Nonce: PASTE_NONCE_HERE" \
  -d '{
    "billing_address": {
      "first_name": "محمد",
      "last_name": "العتيبي",
      "email": "mohammed@example.com",
      "phone": "0551234567",
      "address_1": "شارع الملك فهد",
      "city": "الرياض",
      "country": "SA",
      "state": "Riyadh"
    },
    "shipping_address": {
      "first_name": "محمد",
      "last_name": "العتيبي",
      "address_1": "شارع الملك فهد",
      "city": "الرياض",
      "country": "SA",
      "state": "Riyadh"
    }
  }'
```

---

## G. Read available shipping rates  (needs cart-token)

After step F, run GET cart again and read the `shipping_rates[]` array — each rate has a `rate_id`, `name`, `price`.

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Cart-Token: PASTE_CART_TOKEN_HERE"
```
> For this store (Zone 1 = Saudi Arabia) you should see `free_shipping` and `flat_rate`.

---

## H. Select shipping method  (needs cart-token + nonce)

```bash
# Replace RATE_ID with a rate_id from step G (e.g. "free_shipping:1" or "flat_rate:2")
curl -s -X POST \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart/select-shipping" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Cart-Token: PASTE_CART_TOKEN_HERE" \
  -H "Nonce: PASTE_NONCE_HERE" \
  -d '{"rate_id": "free_shipping:1"}'
```

---

## I. Preview checkout (draft)  (needs nonce)

Returns the draft checkout object before placing the order — useful to show a final order summary.

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/checkout" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Nonce: PASTE_NONCE_HERE"
```
> Without nonce this returns `401 woocommerce_rest_missing_nonce`. With nonce it returns a `checkout-draft` object.

---

## J. ⚠️ PLACE ORDER / CHECKOUT  (creates a REAL order + Telr payment redirect)

> **Run this only when you intend to create an order.** It will create a real order in WooCommerce and return a Telr payment redirect URL. Use a small/cheap product or a test scenario.

```bash
curl -s -X POST \
  "https://iconnect-intl.com/store/wp-json/wc/store/checkout" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Cart-Token: PASTE_CART_TOKEN_HERE" \
  -H "Nonce: PASTE_NONCE_HERE" \
  -d '{"payment_method": "wctelr"}'
```
Expect: `{ "order_id": ..., "order_key": "wc_order_...", "status": "pending_payment", "payment_result": {...} }` plus a redirect URL for Telr hosted card payment. Save `order_id` + `order_key` for tracking.

---

## K. Track the order just placed  (no admin auth — order key proves ownership)

```bash
# Replace ORDER_ID and ORDER_KEY with the values from step J
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/order/ORDER_ID?key=ORDER_KEY" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json"
```

---

## What this tells you for the chatbot

- The chatbot must hold the **cart-token** and **nonce** per session (server-side) and thread them through every cart mutation.
- **Order placement = Store API checkout**, not classic `POST /wc/v3/orders` (which can't process Telr payment).
- The flow is strictly sequential: add-item → update-customer (address) → cart GET (read shipping rates) → select-shipping → checkout.
- Payment is **redirect-based** (Telr hosted page) — the chatbot returns a secure link, never touches card data.
