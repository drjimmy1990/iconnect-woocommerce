# 01 — Catalog Browsing (Phase 1 chatbot)

Test the endpoints the chatbot needs to **browse categories, search, filter, and show product details**.

These are all **read-only GET** requests → safe to run anytime. They will NOT modify the store.

---

## How to use these in n8n

1. Add an **HTTP Request** node.
2. Open the node → click **Import cURL** (or use the cURL import button in the node's parameters).
3. Paste one of the commands below.
4. **Important Cloudflare settings** (the store sits behind Cloudflare bot protection):
   - The `-H "User-Agent: …"` header is **mandatory** — n8n's default UA gets blocked (HTTP 403). Keep it after import.
   - Under the node's **Settings** tab, turn **Retry On Fail** = ON, **Max Tries** = 6, **Wait Between Tries** = 2000 ms. Cloudflare intermittently returns an HTML challenge page; retrying solves it.
5. Credentials for the Classic API (`/wc/v3/`) are embedded via `--user`. For the Store API (`/wc/store/`), **no auth is needed** (public reads).

**Credentials (read/write):**
- Key: `ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b`
- Secret: `cs_234e5af2614e76e372b33675fbcc3ea80eedba3e`

**Live reference IDs on this store:** product `8825` (Hikvision CAT6 cable), category `392` ("Access Control Devices"), attribute `9` (Audio), brand `104` (Acer).

---

## A. List all categories (Classic API)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/categories?per_page=100&orderby=name&order=asc" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
Expect: array of 32 categories with `id`, `name`, `slug`, `parent`, `image`, `count`.

---

## B. List top-level categories only (parent=0)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/categories?parent=0&per_page=100" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
Use this to drill category → subcategory: pass a `parent={id}` to get its children.

---

## C. Get one category detail

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/categories/392" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

---

## D. Search products by keyword (Classic API — richest filtering)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products?search=cat6&per_page=10&page=1" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Tip: to see the **total count**, look at the response headers `X-WP-Total` (total items) and `X-WP-TotalPages`. In n8n enable "Include Response Headers" to read them.

---

## E. Filter by category

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products?category=392&per_page=10" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

---

## F. Filter: on-sale only / featured only / price range / sort

```bash
# On sale
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products?on_sale=true&per_page=10" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

```bash
# Featured
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products?featured=true&per_page=10" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

```bash
# Price range 0–500 SAR, sorted cheapest first
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products?min_price=0&max_price=500&orderby=price&order=asc&per_page=10" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

---

## G. Get a single product's full detail

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/8825" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
Key fields to inspect: `name`, `price`, `regular_price`, `sale_price`, `sku`, `stock_status`, `images`, `categories`, `attributes`, `description`, `short_description`, `related_ids`, `permalink`.

---

## H. Get product variations (for variable products)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/8825/variations?per_page=50" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Product 8825 is a simple product → returns `[]`. Keep this for when variable products exist.

---

## I. Product reviews (known to 404 on this store)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/8825/reviews?per_page=10" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```
> Expect `404 rest_no_route`. Reviews are not exposed by the API; only `average_rating`/`review_count` on the product object are available.

---

## J. List attributes + terms (for filters like color, size, camera type)

```bash
# All attributes
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/attributes" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

```bash
# Terms of attribute 9 (Audio) — change the ID to explore others
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/attributes/9/terms?per_page=100" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

---

## K. List brands (plugin installed)

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/brands?per_page=100" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

---

## L. List tags

```bash
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/tags?per_page=50" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
```

---

## M. Store API — public product reads (no auth needed)

```bash
# Store API product list (storefront-optimized fields; prices in minor units = cents)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/products?per_page=10" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json"
```

```bash
# Store API single product (note: prices are integers in cents, e.g. 46863 = 468.63 SAR)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/products/8825" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json"
```

```bash
# Store API categories (public)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/products/categories?per_page=100" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json"
```

---

## What this tells you for the chatbot

- Use **Store API** (`/wc/store/products`) for customer-facing browse/search (no keys exposed, public).
- Use **Classic API** (`/wc/v3/products`) when you need richer filters (`attribute`, `sku`, `min_price/max_price`, `orderby`).
- Category browsing: list with `parent=0`, then drill with `parent={id}`.
- Store API prices are in **cents** (minor units); Classic API prices are strings in **SAR** (major units). Normalize before showing to users.
