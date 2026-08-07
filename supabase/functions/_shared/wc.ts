/**
 * wc.ts — WooCommerce REST client for Edge Functions (Deno).
 * Handles Basic Auth, the browser User-Agent, Cloudflare retry-until-JSON,
 * and pagination via X-WP-Total / X-WP-TotalPages.
 */

const WC_URL = Deno.env.get("WC_URL")!;
const WC_KEY = Deno.env.get("WC_KEY")!;
const WC_SECRET = Deno.env.get("WC_SECRET")!;
const UA =
  Deno.env.get("USER_AGENT") ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const auth = "Basic " + btoa(`${WC_KEY}:${WC_SECRET}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isJson(s: string): boolean {
  const t = s.trimStart();
  return t.startsWith("[") || t.startsWith("{");
}

/** GET a WC endpoint with Cloudflare retry. Returns parsed data + pagination headers. */
export async function wcGet(
  path: string,
  params: Record<string, unknown> = {}
): Promise<{ data: unknown; total: number; pages: number }> {
  const url = new URL(`${WC_URL.replace(/\/+$/, "")}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  let lastErr: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: auth, "User-Agent": UA, Accept: "application/json" },
      });
      const text = await res.text();
      if (res.status === 403 || !isJson(text)) {
        await sleep(2000);
        continue;
      }
      return {
        data: JSON.parse(text),
        total: Number(res.headers.get("x-wp-total") ?? 0),
        pages: Number(res.headers.get("x-wp-totalpages") ?? 1),
      };
    } catch (e) {
      lastErr = e;
      await sleep(2000);
    }
  }
  throw lastErr ?? new Error(`WC request failed: ${url}`);
}

/** Paginate a WC list endpoint (cap 1000 items). */
export async function wcGetAll(
  path: string,
  params: Record<string, unknown> = {},
  cap = 1000
): Promise<{ items: any[]; total: number; pages: number }> {
  const perPage = 100;
  let page = 1;
  const items: any[] = [];
  let total = 0;
  let pages = 1;
  while (page <= pages && items.length < cap) {
    const r = await wcGet(path, { ...params, per_page: perPage, page });
    items.push(...(r.data as any[]));
    total = r.total;
    pages = r.pages;
    page++;
  }
  return { items: items.slice(0, cap), total, pages };
}
