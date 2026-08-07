import json
import os
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

BASE = "https://iconnect-intl.com/store"
KEY = os.environ["WC_KEY"]
SECRET = os.environ["WC_SECRET"]
OUT = Path(r"C:\Users\LOQ\Desktop\CLI\emirates mostafa\woocommerce\responses\cloudflare-curl-matrix.txt")
OUT.parent.mkdir(parents=True, exist_ok=True)

CANONICAL = f"{BASE}/wp-json/wc/v3/products/categories?per_page=1"
REST = f"{BASE}/?rest_route=/wc/v3/products/categories&per_page=1"
REST_INDEX = f"{BASE}/index.php?rest_route=/wc/v3/products/categories&per_page=1"
STORE_V1 = f"{BASE}/wp-json/wc/store/v1/products/categories?per_page=1"
STORE_UNVERSIONED = f"{BASE}/wp-json/wc/store/products/categories?per_page=1"
STORE_V1_REST = f"{BASE}/?rest_route=/wc/store/v1/products/categories&per_page=1"
STORE_UNVERSIONED_REST = f"{BASE}/?rest_route=/wc/store/products/categories&per_page=1"
STORE_V1_REST_INDEX = f"{BASE}/index.php?rest_route=/wc/store/v1/products/categories&per_page=1"
STORE_UNVERSIONED_REST_INDEX = f"{BASE}/index.php?rest_route=/wc/store/products/categories&per_page=1"

BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
FULL_HEADERS = [
    ("User-Agent", BROWSER_UA),
    ("Accept", "application/json,text/plain,*/*"),
    ("Accept-Language", "ar,en-US;q=0.9,en;q=0.8"),
    ("Referer", f"{BASE}/"),
    ("Origin", "https://iconnect-intl.com"),
    ("Sec-Fetch-Site", "same-origin"),
    ("Sec-Fetch-Mode", "cors"),
    ("Sec-Fetch-Dest", "empty"),
]

variants = []

def add(vid, group, description, url, auth="basic", profile="default", method="GET", cache_bust=False, diagnostic=False):
    variants.append({
        "id": vid,
        "group": group,
        "description": description,
        "url": url,
        "auth": auth,
        "profile": profile,
        "method": method,
        "cache_bust": cache_bust,
        "diagnostic": diagnostic,
    })

# A
add("A1", "A", "canonical permalink; Basic auth; default curl UA", CANONICAL)
# B
add("B1", "B", "root rest_route fallback; Basic auth; default curl UA", REST)
add("B2", "B", "index.php rest_route fallback; Basic auth; default curl UA", REST_INDEX)
# C
add("C1", "C", "canonical permalink; query-string auth", CANONICAL, auth="query")
add("C2", "C", "root rest_route fallback; query-string auth", REST, auth="query")
add("C3", "C", "index.php rest_route fallback; query-string auth", REST_INDEX, auth="query")
# D: all four profiles across canonical plus both rest_route spellings.
routes = [("canonical", CANONICAL), ("rest", REST), ("rest-index", REST_INDEX)]
profiles = [
    ("default", "default curl UA"),
    ("browser", "browser UA only"),
    ("full", "full browser-ish headers"),
    ("minimal", 'minimal API: UA "n8n" + Accept application/json'),
]
for route_no, (route_name, route_url) in enumerate(routes, 1):
    for profile_no, (profile_name, profile_desc) in enumerate(profiles, 1):
        add(f"D{route_no}.{profile_no}", "D", f"{route_name}; Basic auth; {profile_desc}", route_url, profile=profile_name)
# E
add("E1", "E", "canonical; Basic auth; unique cache-buster each attempt", CANONICAL, cache_bust=True)
add("E2", "E", "root rest_route; Basic auth; unique cache-buster each attempt", REST, cache_bust=True)
add("E3", "E", "index.php rest_route; Basic auth; unique cache-buster each attempt", REST_INDEX, cache_bust=True)
# F
add("F1", "F", "canonical HEAD; Basic auth", CANONICAL, method="HEAD", diagnostic=True)
add("F2", "F", "canonical OPTIONS; Basic auth", CANONICAL, method="OPTIONS", diagnostic=True)
# G
add("G1", "G", "public Store API v1 canonical", STORE_V1, auth="none")
add("G2", "G", "public Store API unversioned canonical", STORE_UNVERSIONED, auth="none")
add("G3", "G", "public Store API v1 root rest_route", STORE_V1_REST, auth="none")
add("G4", "G", "public Store API unversioned root rest_route", STORE_UNVERSIONED_REST, auth="none")
add("G5", "G", "public Store API v1 index.php rest_route", STORE_V1_REST_INDEX, auth="none")
add("G6", "G", "public Store API unversioned index.php rest_route", STORE_UNVERSIONED_REST_INDEX, auth="none")


def add_params(url, params):
    encoded = urlencode(params)
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}{encoded}"


def redact_url(url):
    parts = urlsplit(url)
    safe = []
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key in {"consumer_key", "consumer_secret"}:
            value = "<redacted>"
        safe.append((key, value))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(safe), parts.fragment))


def final_header_block(raw):
    text = raw.decode("iso-8859-1", errors="replace").replace("\r\n", "\n")
    blocks = []
    current = []
    for line in text.split("\n"):
        if line.startswith("HTTP/"):
            if current:
                blocks.append(current)
            current = [line]
        elif current:
            if line == "":
                blocks.append(current)
                current = []
            else:
                current.append(line)
    if current:
        blocks.append(current)
    return blocks[-1] if blocks else []


def parse_headers(raw):
    block = final_header_block(raw)
    headers = {}
    for line in block[1:]:
        if ":" in line:
            key, value = line.split(":", 1)
            headers[key.strip().lower()] = value.strip()
    return headers


def classify_body(body, headers, method, status):
    stripped = body.lstrip()
    prefix = stripped[:1]
    start = prefix.decode("utf-8", errors="replace") if prefix else "empty"
    lower = stripped[:8192].lower()
    ctype = headers.get("content-type", "").lower()
    is_challenge = (
        b"just a moment" in lower
        or b"cf-chl-" in lower
        or b"challenge-platform" in lower
        or headers.get("cf-mitigated", "").lower() == "challenge"
    )
    parsed = None
    if prefix in (b"[", b"{"):
        try:
            parsed = json.loads(stripped.decode("utf-8", errors="strict"))
            kind = "JSON-array" if isinstance(parsed, list) else "JSON-object"
        except Exception:
            kind = "JSON-like-invalid"
    elif is_challenge:
        kind = "challenge-HTML"
    elif b"html" in ctype.encode() or prefix == b"<":
        kind = "HTML"
    elif not stripped:
        kind = "empty"
    else:
        kind = "other"

    json_detail = ""
    expected_data = False
    if isinstance(parsed, dict):
        code = parsed.get("code")
        message = parsed.get("message")
        if code is not None:
            json_detail = f"error_code={code}"
        elif message is not None:
            json_detail = "object_with_message"
    elif isinstance(parsed, list):
        json_detail = f"items={len(parsed)}"
        if 200 <= status < 300 and method == "GET":
            if not parsed:
                expected_data = True
            elif all(isinstance(x, dict) for x in parsed):
                expected_data = True
    return kind, start, json_detail, expected_data


def profile_args(profile):
    if profile == "default":
        return []
    if profile == "browser":
        return ["-A", BROWSER_UA]
    if profile == "full":
        out = []
        for key, value in FULL_HEADERS:
            out.extend(["-H", f"{key}: {value}"])
        return out
    if profile == "minimal":
        return ["-A", "n8n", "-H", "Accept: application/json"]
    raise ValueError(profile)


results = []
started = datetime.now(timezone.utc).isoformat()
cache_seed = int(time.time() * 1000)

for variant_index, variant in enumerate(variants):
    for attempt in range(1, 4):
        url = variant["url"]
        if variant["auth"] == "query":
            url = add_params(url, [("consumer_key", KEY), ("consumer_secret", SECRET)])
        if variant["cache_bust"]:
            url = add_params(url, [("_", str(cache_seed + variant_index * 10 + attempt))])

        with tempfile.TemporaryDirectory() as tmp:
            header_path = Path(tmp) / "headers.bin"
            body_path = Path(tmp) / "body.bin"
            cmd = [
                "curl", "--silent", "--show-error", "--connect-timeout", "15", "--max-time", "45",
                "--dump-header", str(header_path), "--output", str(body_path),
                "--write-out", "%{http_code}",
            ]
            if variant["auth"] == "basic":
                cmd.extend(["--user", f"{KEY}:{SECRET}"])
            cmd.extend(profile_args(variant["profile"]))
            if variant["method"] == "HEAD":
                cmd.append("--head")
            elif variant["method"] == "OPTIONS":
                cmd.extend(["--request", "OPTIONS"])
            cmd.append(url)

            proc = subprocess.run(cmd, capture_output=True)
            raw_headers = header_path.read_bytes() if header_path.exists() else b""
            body = body_path.read_bytes() if body_path.exists() else b""
            headers = parse_headers(raw_headers)
            try:
                status = int(proc.stdout.decode("ascii", errors="ignore")[-3:] or "0")
            except ValueError:
                status = 0
            kind, body_start, json_detail, expected_data = classify_body(
                body, headers, variant["method"], status
            )
            result = {
                "variant": variant["id"],
                "attempt": attempt,
                "group": variant["group"],
                "description": variant["description"],
                "method": variant["method"],
                "auth": variant["auth"],
                "profile": variant["profile"],
                "url": redact_url(url),
                "curl_exit": proc.returncode,
                "curl_error": proc.stderr.decode("utf-8", errors="replace").strip(),
                "http": status,
                "content_type": headers.get("content-type", "-"),
                "server": headers.get("server", "-"),
                "cf_mitigated": headers.get("cf-mitigated", "-"),
                "cf_ray": headers.get("cf-ray", "-"),
                "location": headers.get("location", "-"),
                "body_type": kind,
                "body_start": body_start,
                "json_detail": json_detail or "-",
                "expected_category_json": expected_data and not variant["diagnostic"],
                "body_bytes": len(body),
            }
            results.append(result)
            print(f"{variant['id']} attempt {attempt}: HTTP {status} {kind}", flush=True)

finished = datetime.now(timezone.utc).isoformat()

lines = [
    "Cloudflare curl matrix — compact raw summary",
    f"Started UTC: {started}",
    f"Finished UTC: {finished}",
    f"Target: WooCommerce product categories, per_page=1",
    f"Variants: {len(variants)}; attempts: {len(results)} (3 per variant)",
    "Credentials are redacted. Query-string authentication exposes keys to URL logs and was tested only because explicitly requested.",
    "No redirects followed. Only GET, HEAD, and OPTIONS were used.",
    "WORKING criterion: at least 2/3 attempts are HTTP 2xx parseable JSON arrays from GET category endpoints.",
    "",
]

for variant in variants:
    rows = [r for r in results if r["variant"] == variant["id"]]
    successes = sum(1 for r in rows if r["expected_category_json"])
    lines.append(f"[{variant['id']}] {variant['description']}")
    lines.append(f"method={variant['method']} auth={variant['auth']} profile={variant['profile']} working={'YES' if successes >= 2 else 'NO'} json_successes={successes}/3")
    for r in rows:
        lines.append(
            "attempt={attempt} curl_exit={curl_exit} http={http} content-type={content_type} "
            "server={server} cf-mitigated={cf_mitigated} cf-ray={cf_ray} location={location} "
            "body={body_type} body_start={body_start} json_detail={json_detail} bytes={body_bytes} url={url}".format(**r)
        )
        if r["curl_error"]:
            lines.append(f"curl_error={r['curl_error']}")
    lines.append("")

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"WROTE {OUT}")
