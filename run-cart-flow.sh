#!/usr/bin/env bash
# Retry the Store API cart->checkout flow with a cookie jar (reuses Cloudflare's
# __cf_bm cookie from a successful GET to pass subsequent POSTs) and stable nonce.
# Creates a REAL test order to capture the Telr link, tracks it, then deletes it.

set -u
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
CREDS="ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
V3="https://iconnect-intl.com/store/wp-json/wc/v3"
STORE="https://iconnect-intl.com/store/wp-json/wc/store"
DIR="C:/Users/LOQ/Desktop/CLI/emirates mostafa/woocommerce/responses"
JAR="$DIR/cookies.jar"
rm -f "$JAR"

# req with cookie jar: $1=out $2=hdrfile $3=auth $4=method $5=url $6=body $7=extra
req() {
  local out="$1" hdr="$2" auth="$3" method="$4" url="$5" body="${6:-}" extra="${7:-}"
  local auth_args=(); [[ "$auth" == "basic" ]] && auth_args=(--user "$CREDS")
  local tries=0 body_out=""
  while [ $tries -lt 10 ]; do
    if [[ "$method" == "GET" || "$method" == "DELETE" ]]; then
      body_out=$(curl -s -D "$hdr" -b "$JAR" -c "$JAR" "$url" \
        -H "User-Agent: $UA" -H "Accept: application/json" "${auth_args[@]}")
    else
      body_out=$(curl -s -D "$hdr" -b "$JAR" -c "$JAR" -X "$method" "$url" \
        -H "User-Agent: $UA" -H "Accept: application/json" -H "Content-Type: application/json" \
        ${extra:-} "${auth_args[@]}" -d "$body")
    fi
    if printf '%s' "$body_out" | head -c1 | grep -qE '[\[{]'; then
      printf '%s' "$body_out" > "$out"; return 0
    fi
    tries=$((tries+1)); sleep 3
  done
  printf '%s' "$body_out" > "$out"; return 1
}

get_hdr() { grep -i "^$1:" "$2" | tail -1 | tr -d '\r' | sed "s/^[^:]*:[[:space:]]*//"; }

echo "=== C1. Cart init (GET) — capture cookies + cart-token + nonce ==="
req "$DIR/C1-cart-init.json" "$DIR/C1-cart-init-headers.txt" none GET "$STORE/cart" || echo "FAILED"
CART_TOKEN=$(get_hdr cart-token "$DIR/C1-cart-init-headers.txt")
NONCE=$(get_hdr nonce "$DIR/C1-cart-init-headers.txt")
echo "cart-token: ${CART_TOKEN:0:30}... nonce: $NONCE"
echo "cookies:"; grep -iE '__cf_bm|woocommerce' "$JAR" 2>/dev/null | head -5

echo ""
echo "=== C2. Add item 8825 (POST) with cookie jar + cart-token + nonce ==="
EXTRA="-H Cart-Token:$CART_TOKEN -H Nonce:$NONCE"
# shellcheck disable=SC2086
if req "$DIR/C2-add-item.json" "$DIR/C2-add-item-headers.txt" none POST "$STORE/cart/add-item" '{"id":8825,"quantity":1}' "$EXTRA"; then
  NT=$(get_hdr cart-token "$DIR/C2-add-item-headers.txt"); [[ -n "$NT" ]] && CART_TOKEN="$NT"
  NN=$(get_hdr nonce "$DIR/C2-add-item-headers.txt"); [[ -n "$NN" ]] && NONCE="$NN"
  echo "OK — items in cart: $(grep -o '"key"' "$DIR/C2-add-item.json" | wc -l)"
else
  echo "add-item still challenged/blocked — see C2-add-item.json"
  head -c 200 "$DIR/C2-add-item.json"; echo
fi

echo ""
echo "=== C3. Set delivery address (update-customer) ==="
BODY='{"billing_address":{"first_name":"API","last_name":"TEST","email":"apitest+chatbot@iconnect-intl.com","phone":"+966500000000","address_1":"API TEST DO NOT SHIP","city":"Riyadh","country":"SA","state":"Riyadh"},"shipping_address":{"first_name":"API","last_name":"TEST","address_1":"API TEST DO NOT SHIP","city":"Riyadh","country":"SA","state":"Riyadh"}}'
EXTRA="-H Cart-Token:$CART_TOKEN -H Nonce:$NONCE"
# shellcheck disable=SC2086
if req "$DIR/C3-update-customer.json" "$DIR/C3-update-customer-headers.txt" none POST "$STORE/cart/update-customer" "$BODY" "$EXTRA"; then
  NT=$(get_hdr cart-token "$DIR/C3-update-customer-headers.txt"); [[ -n "$NT" ]] && CART_TOKEN="$NT"
  echo "OK — address set"
else
  echo "update-customer failed:"; head -c 300 "$DIR/C3-update-customer.json"; echo
fi

echo ""
echo "=== C4. Read cart → get shipping rate_id ==="
EXTRA="-H Cart-Token:$CART_TOKEN"
# shellcheck disable=SC2086
req "$DIR/C4-cart-shipping.json" /dev/null none GET "$STORE/cart" "" "$EXTRA" || echo "FAILED"
RATE_ID=$(grep -oE '"rate_id":"[^"]*"' "$DIR/C4-cart-shipping.json" | head -1 | sed 's/"rate_id":"//;s/"//')
echo "rate_id: $RATE_ID"
echo "items in cart now: $(grep -o '"key"' "$DIR/C4-cart-shipping.json" | wc -l)"
grep -oE '"total_price":"[^"]*"|"total_shipping":[^,]*|"name":"[^"]*"' "$DIR/C4-cart-shipping.json" | head -8

echo ""
echo "=== C5. Select shipping method ==="
if [ -n "$RATE_ID" ]; then
  EXTRA="-H Cart-Token:$CART_TOKEN -H Nonce:$NONCE"
  # shellcheck disable=SC2086
  req "$DIR/C5-select-shipping.json" "$DIR/C5-select-shipping-headers.txt" none POST "$STORE/cart/select-shipping" "{\"rate_id\":\"$RATE_ID\"}" "$EXTRA" || echo "FAILED"
  NT=$(get_hdr cart-token "$DIR/C5-select-shipping-headers.txt"); [[ -n "$NT" ]] && CART_TOKEN="$NT"
else
  echo "no rate_id — skipping"
fi

echo ""
echo "=== C6. PLACE ORDER (checkout) — capture Telr link ==="
EXTRA="-H Cart-Token:$CART_TOKEN -H Nonce:$NONCE"
# shellcheck disable=SC2086
if req "$DIR/C6-checkout.json" "$DIR/C6-checkout-headers.txt" none POST "$STORE/checkout" '{"payment_method":"wctelr"}' "$EXTRA"; then
  echo "OK — checkout response key fields:"
  grep -oE '"order_id":[0-9]+|"order_key":"[^"]*"|"status":"[^"]*"|"redirect":"[^"]*"|"payment_redirect":"[^"]*"|"payment_method":"[^"]*"|"checkout_redirect":"[^"]*"' "$DIR/C6-checkout.json" | head -10
  ORDER_ID=$(grep -oE '"order_id":[0-9]+' "$DIR/C6-checkout.json" | head -1 | grep -oE '[0-9]+')
  ORDER_KEY=$(grep -oE '"order_key":"[^"]*"' "$DIR/C6-checkout.json" | head -1 | sed 's/"order_key":"//;s/"//')
  echo "ORDER_ID=$ORDER_ID  ORDER_KEY=$ORDER_KEY"
else
  echo "checkout failed/blocked:"; head -c 300 "$DIR/C6-checkout.json"; echo
fi

echo ""
echo "=== C7. Track order (Store API) ==="
if [ -n "$ORDER_ID" ] && [ -n "$ORDER_KEY" ]; then
  req "$DIR/C7-track-order.json" /dev/null none GET "$STORE/order/$ORDER_ID?key=$ORDER_KEY" || echo "FAILED"
  grep -oE '"id":[0-9]+|"status":"[^"]*"|"total":"[^"]*"|"payment_method":"[^"]*"|"payment_method_title":"[^"]*"' "$DIR/C7-track-order.json" | head -6
fi

echo ""
echo "=== C8. Cleanup: delete test order (Classic API) ==="
if [ -n "$ORDER_ID" ]; then
  req "$DIR/C8-delete-order.json" /dev/null basic DELETE "$V3/orders/$ORDER_ID?force=true" || echo "FAILED"
  grep -oE '"id":[0-9]+|"deleted":(true|false)' "$DIR/C8-delete-order.json" | head -3
  echo "deleted $ORDER_ID"
else
  echo "no order to delete (checkout did not succeed)"
fi

echo ""
echo "=== Fallback: create a test order via Classic API (no payment link, just to see order shape) ==="
FBODY='{"payment_method":"wctelr","payment_method_title":"Telr (test)","set_paid":false,"billing":{"first_name":"API","last_name":"TEST","email":"apitest+chatbot@iconnect-intl.com","phone":"+966500000000","address_1":"API TEST","city":"Riyadh","country":"SA","state":"Riyadh"},"line_items":[{"product_id":8825,"quantity":1}],"status":"pending"}'
EXTRA=""
# shellcheck disable=SC2086
if req "$DIR/F1-classic-create-order.json" "$DIR/F1-classic-create-order-headers.txt" basic POST "$V3/orders" "$FBODY" "$EXTRA"; then
  echo "classic order created:"
  grep -oE '"id":[0-9]+|"status":"[^"]*"|"total":"[^"]*"|"order_key":"[^"]*"|"payment_method":"[^"]*"|"checkout_payment_url":"[^"]*"' "$DIR/F1-classic-create-order.json" | head -8
  FORD=$(grep -oE '"id":[0-9]+' "$DIR/F1-classic-create-order.json" | head -1 | grep -oE '[0-9]+')
  # checkout_payment_url / payment link if present
  echo "payment/checkout url fields:"
  grep -oE '"(checkout_payment_url|payment_url|edit_url|permalink)":"[^"]*"' "$DIR/F1-classic-create-order.json" | head -5
  echo "deleting classic test order $FORD..."
  req "$DIR/F2-delete-classic-order.json" /dev/null basic DELETE "$V3/orders/$FORD?force=true" >/dev/null 2>&1 && echo "deleted"
else
  echo "classic create failed:"; head -c 300 "$DIR/F1-classic-create-order.json"
fi

echo ""
echo "DONE"
