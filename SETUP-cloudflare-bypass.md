> ⛔ **HISTORICAL — Cloudflare is no longer in front of the store.** The origin now answers
> directly (Apache). The current requirement is different: every request needs
> `Cookie: humans_21909=1` **and** a full browser `User-Agent`, or the origin returns
> **409** (JS challenge) / **406** (mod_security). Backend B handles both automatically
> via `WC_COOKIE` + `USER_AGENT`.
> **Current reference:** [curls-n8n-VERIFIED.md](curls-n8n-VERIFIED.md) · [PROJECT-STATUS.md](PROJECT-STATUS.md)
> Kept for background on the original diagnosis.

# Cloudflare Bypass Setup — WooCommerce REST API

**Goal:** Stop Cloudflare from challenging server-to-server API traffic to the WooCommerce REST API (`/store/wp-json/wc/v3/*` and `/store/wp-json/wc/store/*`), so n8n, the chatbot backend, and any integration can reach the API reliably.

**Why this is needed:** n8n (and any backend HTTP client) runs from a datacenter IP and has no JavaScript engine. Cloudflare issues it an **interactive "Just a moment…" JS challenge** that n8n cannot solve — so every request returns the challenge HTML instead of JSON, regardless of User-Agent or retries. The fix is to tell Cloudflare to **skip managed challenges for the API paths** while keeping the public storefront fully protected.

**Time required:** ~5 minutes + Cloudflare dashboard access.

**Result:** all `wp-json` API traffic passes straight to WordPress; the public site (`/store/product/…`) stays protected as before.

---

## Prerequisites

- Login access to the **Cloudflare dashboard** for the domain `iconnect-intl.com`.
- The **Account** and **Zone** for `iconnect-intl.com` must be visible in your dashboard (you need Zone-level access; "Administrator" or "WAF Rules" permission).

> If you do NOT manage Cloudflare for this domain, send this document to whoever does (the site owner / hosting provider / IT admin). Only they can apply it.

---

## Step 1 — Open the WAF rules editor

1. Log in to **https://dash.cloudflare.com**.
2. Select the **iconnect-intl.com** zone.
3. Left sidebar → **Security** → **WAF**.
4. Click the **Custom rules** tab.
5. Click **Create rule** (or "+ Create rule" / "Add rule").

---

## Step 2 — Name the rule

**Rule name:**
```
Bypass challenge for WooCommerce REST API
```

---

## Step 3 — Define the matching condition (the API paths)

Switch the rule builder to **Edit expression** (the text/Expression Builder mode, usually a toggle at the top right of the expression editor). Paste this exact expression:

```
(http.request.uri.path contains "/store/wp-json/wc/v3/") or (http.request.uri.path contains "/store/wp-json/wc/store/") or (http.request.uri.path eq "/store/wp-json/") or (http.request.uri.path contains "/store/wp-json/wc/v3") or (http.request.uri.path contains "/store/wp-json/wc/store")
```

> This matches both the Classic API (`/wc/v3/`) and the Store API (`/wc/store/`), plus the bare `/store/wp-json/` root. The trailing-slash variants are covered so a request without a trailing slash also matches.

### If you prefer the visual builder instead of the expression

Set it up as OR conditions:

| Field | Operator | Value |
|---|---|---|
| URI Path | contains | `/store/wp-json/wc/v3/` |
| URI Path | contains | `/store/wp-json/wc/store/` |
| URI Path | equals | `/store/wp-json/` |

(Group these with **OR**.)

### Optional: lock it to your integration's IP (more secure)

If your n8n / backend has a fixed public IP, narrow the rule so **only that IP** is bypassed (safer than bypassing the path for the whole world). Add an AND condition:

```
((http.request.uri.path contains "/store/wp-json/wc/v3/") or (http.request.uri.path contains "/store/wp-json/wc/store/") or (http.request.uri.path eq "/store/wp-json/")) and (ip.src eq 203.0.113.55)
```

Replace `203.0.113.55` with your n8n server's real public IP. For multiple IPs, use a list: `(ip.src in {203.0.113.55 198.51.100.10})`.

> ⚠️ If your n8n IP is dynamic, use the broader path-only rule (Step 3 default). If it's static, the IP-locked version is better.

---

## Step 4 — Set the action to "Skip"

Under **Then take action…**:

- Select **Skip**.
- In the skip options that appear, tick **ALL** of:
  - ☑ **All remaining custom rules**
  - ☑ **All managed rules** (managed WAF rules)
  - ☑ **All managed challenges** (this is the key one — disables the "Just a moment…" JS challenge for matched requests)
  - ☑ **Rate limiting rules**
  - ☑ **Zone Lockdown**
  - ☑ **User Agent Blocking**
  - ☑ **Browser Integrity Check**
  - ☑ **All Bot Fight Mode / Super Bot Fight Mode rules** (if shown)

The critical checkbox is **All managed challenges** — that's the one that disables the interactive JS challenge n8n can't pass. Tick everything for completeness.

---

## Step 5 — Deploy

1. Click **Deploy** (or **Save / Deploy**).
2. Confirm the rule appears in the Custom rules list with a status of **Enabled** and **Deployed**.
3. Cloudflare applies it globally within ~10–30 seconds.

---

## Step 6 — Verify

After ~30 seconds, test the API from n8n (or any terminal). It should now return JSON immediately, no challenge page.

**Quick test — Store API (public, no keys needed):**

```bash
curl -s -o /dev/null -w "HTTP_CODE:%{http_code}\n" \
  "https://iconnect-intl.com/store/wp-json/wc/store/products?per_page=1" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json"
```
Expect `HTTP_CODE:200` and a JSON body starting with `[`.

**Full test — Classic API (with keys):**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/categories?per_page=5" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e" | head -c 300
```
Expect `HTTP_CODE:200` and JSON starting with `[{"id":...` (the categories list).

If you still see the "Just a moment…" HTML or HTTP 403:
- Wait another minute (global propagation).
- Confirm the rule is **Enabled** and **Deployed**, not in Draft.
- Confirm the expression matches (check for typos in `/store/wp-json/...`).
- Confirm you applied it to the **iconnect-intl.com** zone (not a different domain).
- Check there isn't a higher-priority rule that challenges first — in the Custom rules list, drag this rule **up** so it evaluates before any "challenge everyone" rules.

---

## What stays protected

This rule only bypasses challenges for the **`/store/wp-json/`** API paths. Everything else on the site is untouched:

- ✅ Public storefront (`https://iconnect-intl.com/store/product/...`) — still protected.
- ✅ Homepage, product pages, checkout pages — still protected.
- ✅ Admin login (`/wp-admin`) — still protected (it's not under `/store/wp-json/`).
- Only machine API traffic under `/store/wp-json/wc/v3/` and `/store/wp-json/wc/store/` is allowed through without a challenge — which is exactly what an API is supposed to be.

The WooCommerce REST API keys (`ck_`/`cs_`) still authenticate every Classic API call — bypassing the Cloudflare challenge does NOT bypass WooCommerce's own authentication. Unauthenticated requests to `/wc/v3/` still get `401 Unauthorized` from WooCommerce. Only the Store API's public reads (`products`, `cart GET`) are publicly accessible, which is by design.

---

## Checklist (copy to whoever applies it)

- [ ] Logged into Cloudflare dashboard for `iconnect-intl.com`
- [ ] Security → WAF → Custom rules → Create rule
- [ ] Name: `Bypass challenge for WooCommerce REST API`
- [ ] Expression matches `/store/wp-json/wc/v3/` and `/store/wp-json/wc/store/` (and `/store/wp-json/`)
- [ ] Action = **Skip**, with **All managed challenges** checked (plus all other skip options)
- [ ] Rule **Deployed** and **Enabled**
- [ ] Verified: `curl … /wc/store/products?per_page=1` returns HTTP 200 JSON (not the challenge page)
- [ ] Verified: `curl … /wc/v3/products/categories?per_page=5` with keys returns HTTP 200 JSON

---

## If you cannot access Cloudflare at all

The path-only bypass rule above is the only durable fix. Without dashboard access, your fallbacks are limited:

1. **FlareSolverr** (self-hosted n8n only, same machine/IP as n8n): runs headless Chromium, solves the Cloudflare JS challenge, returns a `cf_clearance` cookie n8n reuses. Fragile — cookie is IP+UA bound and expires in hours; FlareSolverr must run on the same public IP as n8n.
2. **Move n8n to a clean/residential IP** Cloudflare doesn't flag. Unreliable.
3. **Ask the site owner to apply this rule** (send them this file).

None of these are as clean as the WAF rule. Get Cloudflare access if at all possible.
