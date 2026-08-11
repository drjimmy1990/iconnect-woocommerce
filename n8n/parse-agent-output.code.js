// ============================================================================
// Parse AI Agent Output — iConnect WhatsApp Store Bot
// Paste this into the Code node between "AI Agent" and the "Route Intent" Switch.
//
// Contract produced (always, even on total failure):
//   { intent, reply, product_id, complaint, order, _parse }
//
// intent ∈ conversation | product_details | complaint | customer_service | order_created
//
// Why not just JSON.parse(): LLMs wrap output in ```json fences, add prose around
// it, and emit raw newlines inside strings (invalid JSON). Four strategies below.
//
// It NEVER throws and NEVER returns an error-shaped item — a downstream Switch
// must always get a routable intent, otherwise the customer gets silence.
// ============================================================================

const VALID_INTENTS = [
  'conversation',
  'product_details',
  'complaint',
  'customer_service',
  'order_created',
];

const FALLBACK_REPLY = 'عذراً، حصل خطأ مؤقت. ممكن تعيد رسالتك؟';

/** Build a guaranteed-valid item. */
function ok(intent, reply, extra = {}, parseNote = 'ok') {
  return [{
    json: {
      intent,
      reply: reply || FALLBACK_REPLY,
      product_id: extra.product_id ?? null,
      complaint: extra.complaint ?? null,
      order: extra.order ?? null,
      _parse: parseNote, // debugging aid — visible in the n8n execution view
    },
  }];
}

// --- 0. Get the agent's raw text -------------------------------------------
const input = $input.first().json;
const raw = input.output ?? input.text ?? input.response ?? '';

if (!raw || typeof raw !== 'string') {
  return ok('conversation', FALLBACK_REPLY, {}, 'no-output-field');
}

// --- 1. Strategy A: markdown code fence ------------------------------------
let jsonString = null;
const fence = raw.match(/`{3,}(?:json)?\s*([\s\S]*?)\s*`{3,}/);
if (fence && fence[1]) jsonString = fence[1].trim();

// --- 2. Strategy B: first '{' .. last '}' ----------------------------------
if (!jsonString) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start > -1 && end > start) jsonString = raw.slice(start, end + 1).trim();
}

// --- 3. Strategy C: no JSON at all → treat the whole text as the reply ------
if (!jsonString) {
  return ok('conversation', raw.trim(), {}, 'plain-text-fallback');
}

// --- 4. Parse, with a newline-repair retry ---------------------------------
let parsed = null;
try {
  parsed = JSON.parse(jsonString);
} catch (e) {
  try {
    // Raw control characters inside JSON strings are the usual culprit.
    parsed = JSON.parse(
      jsonString.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'),
    );
  } catch (e2) {
    return ok('conversation', raw.trim(), {}, 'parse-failed');
  }
}

if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
  return ok('conversation', raw.trim(), {}, 'not-an-object');
}

// --- 5. Normalise the fields ------------------------------------------------
let intent = typeof parsed.intent === 'string' ? parsed.intent.trim() : '';
let note = 'ok';

if (!VALID_INTENTS.includes(intent)) {
  note = `unknown-intent:${intent || 'empty'}`;
  intent = 'conversation';
}

// Accept `reply`, or the older `botResponse`/`response` spellings.
let reply = parsed.reply ?? parsed.botResponse ?? parsed.response ?? '';
if (typeof reply !== 'string' || !reply.trim()) {
  reply = raw.trim() || FALLBACK_REPLY;
  note = 'missing-reply';
}
reply = reply.trim();

// product_id must be a positive integer or null.
let productId = null;
if (parsed.product_id !== null && parsed.product_id !== undefined) {
  const n = Number(parsed.product_id);
  if (Number.isFinite(n) && n > 0) productId = Math.trunc(n);
}

const complaint =
  typeof parsed.complaint === 'string' && parsed.complaint.trim()
    ? parsed.complaint.trim()
    : null;

const order =
  parsed.order && typeof parsed.order === 'object' && !Array.isArray(parsed.order)
    ? parsed.order
    : null;

// --- 6. Guards: never route to a branch whose required data is missing ------
// Without these the Switch sends the item down a path that then crashes on an
// undefined field, and the customer receives nothing at all.

if (intent === 'product_details' && productId === null) {
  // No product to fetch images for — degrade to a plain text reply.
  return ok('conversation', reply, {}, 'product_details-without-product_id');
}

if (intent === 'complaint' && !complaint) {
  // Keep the complaint branch (staff should still be notified) and use the
  // reply text as the complaint body.
  return ok('complaint', reply, { complaint: reply }, 'complaint-body-defaulted');
}

if (intent === 'order_created' && (!order || !order.order_number)) {
  // No confirmed order object — do NOT write a bogus crm_orders row.
  return ok('conversation', reply, {}, 'order_created-without-order');
}

return ok(intent, reply, { product_id: productId, complaint, order }, note);
