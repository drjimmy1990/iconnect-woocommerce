#!/usr/bin/env bash
# Live API test recorder for the iConnect WooCommerce store.
# Saves every raw response to responses/ and prints concise summaries.
# Includes a REAL test order via Store API checkout to capture the Telr link,
# then deletes the order to clean up. Safe to re-run.

set -u
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
CREDS="ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
V3="https://iconnect-intl.com/store/wp-json/wc/v3"
STORE="https://iconnect-intl.com/store/wp-json/wc/store"
DIR="C:/Users/LOQ/Desktop/CLI/emirates mostafa/woocommerce/responses"
mkdir -p "$DIR"

# retry wrapper: runs curl until body starts with [ or { (real JSON) or 8 tries
# $1=outfile $2=headersfile $3=authflag(basic|none) $4=method $5=url $6=body(optional) $7=extra_headers(optional, newline-sep)
req() {
  local out="$1" hdr="$2" auth="$3" method="$4" url="$5" body="${6:-}" extra="${7:-}"
  local auth_args=(); [[ "$auth" == "basic" ]] && auth_args=(--user "$CREDS")
  local tries=0 body_out=""
  while [ $tries -lt 8 ]; do
    if [[ "$method" == "GET" ]]; then
      body_out=$(curl -s -D "$hdr" "$url" \
        -H "User-Agent: $UA" -H "Accept: application/json" "${auth_args[@]}")
    else
      # shellcheck disable=SC2086
      body_out=$(curl -s -D "$hdr" -X "$method" "$url" \
        -H "User-Agent: $UA" -H "Accept: application/json" -H "Content-Type: application/json" \
        ${extra:-} "${auth_args[@]}" -d "$body")
    fi
    if printf '%s' "$body_out" | head -c1 | grep -qE '[\[{]'; then
      printf '%s' "$body_out" > "$out"
      return 0
    fi
    tries=$((tries+1)); sleep 2
  done
  printf '%s' "$body_out" > "$out"
  return 1
}

echo "============================================================"
echo "  01 — List categories (Classic API)"
echo "============================================================"
req "$DIR/01-categories.json" /dev/null basic GET "$V3/products/categories?per_page=100&orderby=name&order=asc" || echo "FAILED"
echo "count: $(grep -o '"id":' "$DIR/01-categories.json" | wc -l) categories"
echo "first 3 names:"
grep -oE '"name":"[^"]*"' "$DIR/01-categories.json" | head -3

echo ""
echo "============================================================"
echo "  02 — Search products: cat6 (Classic API)"
echo "============================================================"
req "$DIR/02-search-cat6.json" /dev/null basic GET "$V3/products?search=cat6&per_page=10" || echo "FAILED"
echo "returned products: $(grep -o '"id":[0-9]*' "$DIR/02-search-cat6.json" | head -10)"
echo "first product name + price:"
grep -oE '"name":"[^"]*"|"price":"[^"]*"' "$DIR/02-search-cat6.json" | head -4

echo ""
echo "============================================================"
echo "  03 — Get product 8825 detail (Classic API)"
echo "============================================================"
req "$DIR/03-product-8825.json" /dev/null basic GET "$V3/products/8825" || echo "FAILED"
echo "name / price / stock / sku:"
grep -oE '"name":"[^"]*"|"price":"[^"]*"|"regular_price":"[^"]*"|"stock_status":"[^"]*"|"sku":"[^"]*"' "$DIR/03-product-8825.json" | head -6

echo ""
echo "============================================================"
echo "  04 — Payment gateways (Classic API)"
echo "============================================================"
req "$DIR/04-payment-gateways.json" /dev/null basic GET "$V3/payment_gateways" || echo "FAILED"
grep -oE '"id":"[^"]*"|"title":"[^"]*"|"enabled":(true|false)' "$DIR/04-payment-gateways.json" | head -12

echo ""
echo "============================================================"
echo "  05 — Shipping zones + zone 1 methods (Classic API)"
echo "============================================================"
req "$DIR/05a-shipping-zones.json" /dev/null basic GET "$V3/shipping/zones" || echo "FAILED"
req "$DIR/05b-zone1-methods.json" /dev/null basic GET "$V3/shipping/zones/1/methods" || echo "FAILED"
grep -oE '"id":[0-9]+|"title":"[^"]*"|"enabled":(true|false)' "$DIR/05b-zone1-methods.json" | head -8

echo ""
echo "============================================================"
echo "  06 — Store API: init cart + capture cart-token & nonce"
echo "============================================================"
req "$DIR/06-cart-init-body.json" "$DIR/06-cart-init-headers.txt" none GET "$STORE/cart" || echo "FAILED"
CART_TOKEN=$(grep -i '^cart-token:' "$DIR/06-cart-init-headers.txt" | tr -d '\r' | sed 's/^[Cc]art-[Tt]oken:[[:space:]]*//')
NONCE=$(grep -i '^nonce:' "$DIR/06-cart-init-headers.txt" | tr -d '\r' | sed 's/^[Nn]once:[[:space:]]*//')
echo "cart-token: ${CART_TOKEN:0:40}..."
echo "nonce: $NONCE"

echo ""
echo "============================================================"
echo "  07 — Store API: add product 8825 to cart"
echo "============================================================"
EXTRA="-H Cart-Token:$CART_TOKEN -H Nonce:$NONCE"
# shellcheck disable=SC2086
req "$DIR/07-cart-add-item.json" "$DIR/07-cart-add-item-headers.txt" none POST "$STORE/cart/add-item" '{"id":8825,"quantity":1}' "$EXTRA" || echo "FAILED"
CART_TOKEN=$(grep -i '^cart-token:' "$DIR/07-cart-add-item-headers.txt" | tr -d '\r' | sed 's/^[Cc]art-[Tt]oken:[[:space:]]*//')
NONCE=$(grep -i '^nonce:' "$DIR/07-cart-add-item-headers.txt" | tr -d '\r' | sed 's/^[Nn]once:[[:space:]]*//')
echo "updated cart-token: ${CART_TOKEN:0:40}..."
echo "item count in cart: $(grep -o '"key"' "$DIR/07-cart-add-item.json" | wc -l)"

echo ""
echo "============================================================"
echo "  08 — Store API: set delivery address (update-customer)"
echo "============================================================"
BODY='{"billing_address":{"first_name":"API","last_name":"TEST","email":"apitest+chatbot@iconnect-intl.com","phone":"+966500000000","address_1":"API TEST - DO NOT SHIP","city":"Riyadh","country":"SA","state":"Riyadh"},"shipping_address":{"first_name":"API","last_name":"TEST","address_1":"API TEST - DO NOT SHIP","city":"Riyadh","country":"SA","state":"Riyadh"}}'
EXTRA="-H Cart-Token:$CART_TOKEN -H Nonce:$NONCE"
# shellcheck disable=SC2086
req "$DIR/08-update-customer.json" "$DIR/08-update-customer-headers.txt" none POST "$STORE/cart/update-customer" "$BODY" "$EXTRA" || echo "FAILED"
CART_TOKEN=$(grep -i '^cart-token:' "$DIR/08-update-customer-headers.txt" | tr -d '\r' | sed 's/^[Cc]art-[Tt]oken:[[:space:]]*//')
NONCE=$(grep -i '^nonce:' "$DIR/08-update-customer-headers.txt" | tr -d '\r' | sed 's/^[Nn]once:[[:space:]]*//')
echo "address set; cart-token: ${CART_TOKEN:0:40}..."

echo ""
echo "============================================================"
echo "  09 — Store API: read cart to inspect shipping_rates"
echo "============================================================"
EXTRA="-H Cart-Token:$CART_TOKEN"
# shellcheck disable=SC2086
req "$DIR/09-cart-with-shipping.json" /dev/null none GET "$STORE/cart" "" "$EXTRA" || echo "FAILED"
echo "shipping_rates found:"
grep -oE '"rate_id":"[^"]*"|"name":"[^"]*"' "$DIR/09-cart-with-shipping.json" | head -6
RATE_ID=$(grep -oE '"rate_id":"[^"]*"' "$DIR/09-cart-with-shipping.json" | head -1 | sed 's/"rate_id":"//;s/"//')
echo "first rate_id: $RATE_ID"

echo ""
echo "============================================================"
echo "  10 — Store API: select shipping method"
echo "============================================================"
if [ -n "$RATE_ID" ]; then
  EXTRA="-H Cart-Token:$CART_TOKEN -H Nonce:$NONCE"
  # shellcheck disable=SC2086
  req "$DIR/10-select-shipping.json" "$DIR/10-select-shipping-headers.txt" none POST "$STORE/cart/select-shipping" "{\"rate_id\":\"$RATE_ID\"}" "$EXTRA" || echo "FAILED"
  CART_TOKEN=$(grep -i '^cart-token:' "$DIR/10-select-shipping-headers.txt" | tr -d '\r' | sed 's/^[Cc]art-[Tt]oken:[[:space:]]*//')
  NONCE=$(grep -i '^nonce:' "$DIR/10-select-shipping-headers.txt" | tr -d '\r' | sed 's/^[Nn]once:[[:space:]]*//')
  echo "shipping selected: $RATE_ID"
else
  echo "no rate_id found — skipping select-shipping"
fi

echo ""
echo "============================================================"
echo "  11 — Store API: PLACE ORDER (checkout)  <-- creates real order"
echo "============================================================"
EXTRA="-H Cart-Token:$CART_TOKEN -H Nonce:$NONCE"
# shellcheck disable=SC2086
req "$DIR/11-checkout-place-order.json" "$DIR/11-checkout-headers.txt" none POST "$STORE/checkout" '{"payment_method":"wctelr"}' "$EXTRA" || echo "FAILED"
echo "--- checkout response (key fields) ---"
grep -oE '"order_id":[0-9]+|"order_key":"[^"]*"|"status":"[^"]*"|"payment_redirect":"[^"]*"|"redirect":"[^"]*"|"payment_method":"[^"]*"' "$DIR/11-checkout-place-order.json" | head -10
ORDER_ID=$(grep -oE '"order_id":[0-9]+' "$DIR/11-checkout-place-order.json" | head -1 | grep -oE '[0-9]+')
ORDER_KEY=$(grep -oE '"order_key":"[^"]*"' "$DIR/11-checkout-place-order.json" | head -1 | sed 's/"order_key":"//;s/"//')
echo "ORDER_ID=$ORDER_ID"
echo "ORDER_KEY=$ORDER_KEY"

echo ""
echo "============================================================"
echo "  12 — Store API: track the order just placed"
echo "============================================================"
if [ -n "$ORDER_ID" ] && [ -n "$ORDER_KEY" ]; then
  req "$DIR/12-track-order.json" /dev/null none GET "$STORE/order/$ORDER_ID?key=$ORDER_KEY" || echo "FAILED"
  grep -oE '"id":[0-9]+|"status":"[^"]*"|"total":"[^"]*"|"payment_method":"[^"]*"|"payment_method_title":"[^"]*"' "$DIR/12-track-order.json" | head -6
fi

echo ""
echo "============================================================"
echo "  13 — Cleanup: DELETE the test order (Classic API, force=true)"
echo "============================================================"
if [ -n "$ORDER_ID" ]; then
  req "$DIR/13-delete-order.json" /dev/null basic DELETE "$V3/orders/$ORDER_ID?force=true" || echo "FAILED"
  grep -oE '"id":[0-9]+|"deleted":(true|false)' "$DIR/13-delete-order.json" | head -3
  echo "deleted order $ORDER_ID"
fi

echo ""
echo "============================================================"
echo "  DONE — raw responses saved to: $DIR"
ls -1 "$DIR"
