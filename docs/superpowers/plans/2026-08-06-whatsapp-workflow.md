# WhatsApp (Zernio) Store Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an n8n workflow that runs a WhatsApp (Zernio) AI shopping assistant for the iConnect WooCommerce store, using our semantic-search (A) and wrapper (B) backends, logging to the bot-dashboard Supabase DB, with human handoff.

**Architecture:** A single n8n workflow with two webhook entry points (Zernio inbound + dashboard `/agent-send` outbound). Inbound: normalize → load channel config → contact + `ai_enabled` gate → debounce → AI Agent (swappable model + Postgres memory + 5 backend tools) → intent Switch → reply via Zernio → log. Built incrementally via the n8n MCP API.

**Tech Stack:** n8n 2.68.0 (self-hosted at n8n.asra3.com), n8n-nodes-langchain (AI Agent, Postgres memory, HTTP-request tools), Supabase/Postgres nodes, Zernio WhatsApp API, backends A (:8080) + B (:8081).

## n8n build conventions (replaces pytest/git per task)

- **Build** nodes with `n8n_create_workflow` (task 1) then `n8n_update_partial_workflow` (addNode/addConnection) for later tasks. Before configuring any node type for the first time, call `get_node` / `validate_node` to get the current `typeVersion` and parameter schema — treat that as the task's first step, not a guess.
- **Verify** with `n8n_validate_workflow` (structure/expressions) and `n8n_test_workflow` (fire the webhook with a sample payload); inspect results with `n8n_executions`.
- **Checkpoint** after each task: `n8n_get_workflow` and save the JSON to `n8n/whatsapp-store-bot.json` in the repo (this is the "commit").
- **Secrets** (Zernio bearer token, Supabase keys) go in n8n **credentials**, never inline.

## Global Constraints

- WhatsApp gateway = **Zernio**. Send text: `POST https://zernio.com/api/v1/inbox/conversations/{conversationId}/messages`, header `Authorization: Bearer <token>`, body `{ accountId, message }`. Drop inbound events where `message.direction == "outgoing"` OR `message.sender_type == "agent"`.
- Backend B base URL: `http://localhost:8081` (dev) / `https://api.asra3.com` (prod). Backend A: `http://localhost:8080` (dev) / `https://search.asra3.com` (prod). Store these as workflow variables / channel config, not hardcoded per node.
- Currency SAR; shipping Saudi Arabia only; payment via Telr (`payment_method: "wctelr"`).
- The agent NEVER handles WooCommerce keys, the `humans_21909` cookie, or the Zernio token — those live in backend B and n8n credentials.
- All Supabase tables already exist (`database_setup_final.sql`): `channels`, `channel_configurations`, `agent_prompts`, `contacts`, `messages`.
- Language: Arabic-first; the agent system prompt is loaded from `agent_prompts` (dashboard-editable) — do NOT hardcode prompt text in the workflow.

---

### Task 1: Scaffold workflow + Zernio inbound webhook + echo filter + normalize

**Deliverable:** A workflow that accepts a Zernio webhook POST, drops echoes, and outputs normalized fields.

**Nodes:** `Webhook` (Zernio inbound) → `If` (echo filter) → `Code` (normalize).

**Interfaces produced:** normalized item `{ phone, senderName, text, msgType, mediaUrl, conversationId, accountId, messageId, direction, senderType, event }` consumed by all later tasks.

- [ ] **Step 1: Get current node schemas.** `get_node nodes-base.webhook`, `nodes-base.if`, `nodes-base.code` — note typeVersions + param shapes.
- [ ] **Step 2: Create the workflow** with `n8n_create_workflow` (name `WhatsApp Store Bot (Zernio)`), containing the Webhook node (httpMethod POST, path `wa-zernio-inbound`, responseMode `onReceived`).
- [ ] **Step 3: Add the echo-filter `If`.** Keep path = message is inbound. Condition (AND): `{{ $json.body.message.direction }}` **not equals** `outgoing` AND `{{ $json.body.message.sender_type }}` **not equals** `agent`.
- [ ] **Step 4: Add the normalize `Code` node** on the If "true" branch:

```js
const b = $json.body ?? $json;
const msg = b.message ?? {};
const conv = b.conversation ?? {};
const acc = b.account ?? {};
const att = Array.isArray(msg.attachments) ? msg.attachments[0] : null;
return [{ json: {
  phone: String(conv.participantUsername ?? conv.participantId ?? '').replace(/^\+/, ''),
  senderName: conv.participantName ?? msg.sender?.name ?? '',
  text: msg.text ?? '',
  msgType: att ? (att.type ?? 'media') : 'text',
  mediaUrl: att ? (att.url ?? att.base64 ?? '') : '',
  conversationId: msg.conversationId ?? conv.id ?? '',
  accountId: acc.accountId ?? acc.id ?? '',
  messageId: msg.id ?? '',
  direction: msg.direction ?? 'incoming',
  senderType: msg.sender_type ?? 'contact',
  event: b.event ?? '',
}}];
```

- [ ] **Step 5: Validate.** `n8n_validate_workflow` → expect 0 errors.
- [ ] **Step 6: Test with a sample inbound payload.** `n8n_test_workflow` (triggerType webhook, path `wa-zernio-inbound`) with body:

```json
{"event":"message.created","message":{"id":"m1","text":"عايز كاميرا","direction":"incoming","sender_type":"contact","conversationId":"c1"},"conversation":{"id":"c1","participantUsername":"+966500000000","participantName":"Test"},"account":{"accountId":"acc123"}}
```
Expected: normalized item with `phone=966500000000`, `text=عايز كاميرا`, `conversationId=c1`, `accountId=acc123`.

- [ ] **Step 7: Echo test.** Re-send with `message.direction=outgoing` → expect the If to drop it (no normalize output).
- [ ] **Step 8: Checkpoint.** `n8n_get_workflow` → save to `n8n/whatsapp-store-bot.json`.

---

### Task 2: Load channel config + upsert contact + `ai_enabled` gate

**Deliverable:** After normalize, the workflow loads the channel row by `accountId`, upserts the contact, and stops for contacts with `ai_enabled=false` (logging only).

**Nodes:** `Supabase (get channels)` → `Supabase (upsert contacts)` → `If (ai_enabled)`.

**Interfaces:** consumes normalized item. Produces `channel` object (id, config, agent_webhook_url, backend URLs, notification_config) and `contact` (id, ai_enabled). Requires a **Supabase credential** in n8n.

- [ ] **Step 1: Get schema.** `get_node nodes-base.supabase` (operations: get, getAll, create, update).
- [ ] **Step 2: Seed test data** (SQL editor, once): insert one `channels` row with `platform='whatsapp'`, a known `platform_channel_id` (= the Zernio accountId, e.g. `acc123`), plus a `channel_configurations` row and an `agent_prompts` row. Record the ids.
- [ ] **Step 3: Add `Supabase Get channels`** — table `channels`, filter `platform_channel_id = {{ $json.accountId }}`, select `*, channel_configurations(*), agent_prompts(*), keyword_actions(*)`. (Use an HTTP Request to the REST API with the service_role credential if the Supabase node can't express the nested select.)
- [ ] **Step 4: Add `Supabase Upsert contacts`** — match on `platform_user_id = phone` + `channel_id`; create if missing with `{platform_user_id, channel_id, organization_id, full_name, platform:'whatsapp', ai_enabled:true}`; return the row.
- [ ] **Step 5: Add `If ai_enabled`** — true branch continues to the pipeline; false branch → (Task 3's log node only) → stop.
- [ ] **Step 6: Validate + test.** Send the Task 1 payload → expect channel loaded, contact created with `ai_enabled=true`, true branch taken. Manually set the contact `ai_enabled=false` in SQL, re-send → expect false branch (no agent run).
- [ ] **Step 7: Checkpoint** → save workflow JSON.

---

### Task 3: Log inbound message + keyword toggle + debounce queue

**Deliverable:** Inbound messages are logged to `messages`; enable/disable-AI keywords flip `ai_enabled`; rapid messages are debounced to one agent run.

**Nodes:** `Supabase Insert messages (inbound)`, `If keyword`, `Supabase update contacts (ai toggle)`, debounce group (`Insert queue` → `Wait` → `Get queue by sender` → `If newest?` → `Delete queue` → `Aggregate`).

**Interfaces:** consumes contact + normalized item. Produces `aggregatedText` (merged message text) for the agent.

- [ ] **Step 1: Add inbound log** — `messages` insert `{contact_id, message_platform_id: messageId, sender_type:'user', content_type: msgType, text_content: text, attachment_url: mediaUrl, channel_id, organization_id}`.
- [ ] **Step 2: Add keyword toggle** — `If` text matches `channel.keyword_actions` enable/disable keyword → update `contacts.ai_enabled` accordingly, then stop (ack only).
- [ ] **Step 3: Add debounce** — insert `{sender_id: phone, text, ts}` into `queue`; `Wait` 6s; get all queue rows for `sender_id`, sorted; `If` this row is the newest → delete this sender's queue rows and `Aggregate` their `text` into `aggregatedText`; else stop (a later message will handle it).
- [ ] **Step 4: Validate + test.** Send two quick messages for the same phone → expect only the second run proceeds, `aggregatedText` contains both. Confirm both rows appear in `messages`.
- [ ] **Step 5: Checkpoint** → save workflow JSON.

---

### Task 4: AI Agent + swappable chat model + Postgres memory + DB prompt

**Deliverable:** An AI Agent node that answers using the DB-driven system prompt and per-contact Postgres memory (no tools yet).

**Nodes:** `AI Agent` (`@n8n/n8n-nodes-langchain.agent`) + a **placeholder** chat model sub-node + `Postgres Chat Memory` (`memoryPostgresChat`, session key = `phone`).

**Interfaces:** consumes `aggregatedText`, `channel.agent_prompts[0].system_prompt`. Produces the agent's raw output for Task 6's parser.

- [ ] **Step 1: Get schemas.** `get_node nodes-langchain.agent`, `nodes-langchain.memoryPostgresChat`, and one chat-model node (e.g. `nodes-langchain.lmChatOpenAi`) for the placeholder.
- [ ] **Step 2: Add the AI Agent** — system message = `{{ $json.channel.agent_prompts[0].system_prompt }}`; user message = `aggregatedText` + a compact recent-history string. Set the agent to return a JSON object (see Task 6 for the contract) via its prompt.
- [ ] **Step 3: Attach Postgres Chat Memory** — Postgres credential (same Supabase DB), session id = `{{ $json.phone }}`.
- [ ] **Step 4: Attach a placeholder chat model** — any model the account has a credential for; note in the workflow that this node is the swap point. (Model choice is deferred; this slot is model-agnostic.)
- [ ] **Step 5: Validate + test.** Send "مرحبا" → expect a coherent Arabic reply object. Send a second message → expect memory continuity.
- [ ] **Step 6: Checkpoint** → save workflow JSON.

---

### Task 5: The 5 backend tools

**Deliverable:** The agent can call semantic search, catalog, product detail, place order, and track order.

**Nodes:** five `HTTP Request Tool` (`@n8n/n8n-nodes-langchain.toolHttpRequest`) nodes attached to the AI Agent.

**Interfaces:** each tool's name + input schema is what the agent calls. Base URLs from Global Constraints.

- [ ] **Step 1: Get schema.** `get_node nodes-langchain.toolHttpRequest` — confirm how tool input params map to the HTTP request.
- [ ] **Step 2: `semantic_search`** — `POST {A}/search`, JSON `{ "query": "{query}", "top_k": 5, "mode": "hybrid" }`; description: "Find products by natural-language description (fuzzy/Arabic)."
- [ ] **Step 3: `search_catalog`** — `GET {B}/api/products` with query params `search`, `category`, `min_price`, `max_price`, `sku`, `per_page`; description: "Exact/filtered catalog lookup by keyword/SKU/price."
- [ ] **Step 4: `get_product`** — `GET {B}/api/products/{id}`; description: "Full details + image URL for one product id."
- [ ] **Step 5: `place_order`** — `POST {B}/api/orders`, JSON body from tool inputs: `{ line_items:[{product_id,quantity}], billing:{first_name,last_name,address_1,city,country:"SA",email,phone}, payment_method:"wctelr", payment_method_title:"Telr", status:"pending" }`; description: "Create the order after collecting name/phone/address; returns a Telr payment_url."
- [ ] **Step 6: `track_order`** — `GET {B}/api/orders/track` with params `order_id`+`order_key` | `email` | `phone`; description: "Look up an existing order status."
- [ ] **Step 7: Validate + test each tool** against the running backends (dev): a search query returns products; a `place_order` with product 8825 returns a `payment_url`; a `track_order` returns a status. (Backends already validated live.)
- [ ] **Step 8: Checkpoint** → save workflow JSON.

---

### Task 6: Parse agent output + intent Switch + send text via Zernio + log outbound

**Deliverable:** The agent's reply is sent to the customer on WhatsApp and logged.

**Nodes:** `Code (parse agent JSON)` → `Switch (by intent)` → `HTTP Request (Zernio send text)` → `Supabase Insert messages (outbound)`.

**Agent output contract** (the agent must return this JSON — state it in the system prompt): `{ "intent": "conversation|send_product_image|place_order|track_order|services_inquiry|human_handoff", "reply": "<text>", "product_id": <optional>, "image_url": "<optional>" }`.

- [ ] **Step 1: Add parser `Code`** — parse the agent output into `{intent, reply, product_id, image_url}` (tolerate string or object). 
- [ ] **Step 2: Add `Switch`** on `intent` with the six outputs above.
- [ ] **Step 3: Add Zernio send-text** (create an **HTTP Header Auth credential** `Zernio` = `Authorization: Bearer <token>`): `POST https://zernio.com/api/v1/inbox/conversations/{{ $json.conversationId }}/messages`, body `{ "accountId": "{{ $json.accountId }}", "message": "{{ $json.reply }}" }`.
- [ ] **Step 4: Wire `conversation`, `place_order`, `track_order` intents** to the send-text node (they all reply with text; `place_order`/`track_order` text already contains the payment link / status from the tool result).
- [ ] **Step 5: Add outbound log** — `messages` insert `{contact_id, sender_type:'ai', content_type:'text', text_content: reply, channel_id, organization_id}`.
- [ ] **Step 6: Validate + test** end-to-end with a real Zernio test account (or mock the send node and assert the request body). Expect a WhatsApp reply + an outbound `messages` row.
- [ ] **Step 7: Checkpoint** → save workflow JSON.

---

### Task 7: Handoff — services_inquiry / human_handoff

**Deliverable:** These intents disable AI for the contact, send a handoff message, and (optionally) alert staff.

**Nodes:** `Supabase update contacts (ai_enabled=false)` → `Zernio send text (handoff message)` → optional `HTTP/Telegram notify`.

- [ ] **Step 1: Wire Switch outputs** `services_inquiry` and `human_handoff` to a shared handoff branch.
- [ ] **Step 2: Set `ai_enabled=false`** for the contact (`Supabase update contacts` where id = contact.id).
- [ ] **Step 3: Send handoff message** via Zernio send-text with `reply` (e.g. "بحوّلك لفريق خدمة العملاء، لحظة من فضلك 🙏").
- [ ] **Step 4: Optional staff alert** — if `channel.channel_configurations.notification_config` has a target, POST a "new handoff" notice (Telegram/other). Default: skip if not configured.
- [ ] **Step 5: Validate + test.** Send a services question → assert contact `ai_enabled` becomes false, handoff message sent, and a follow-up inbound message from the same contact is dropped by the Task 2 gate.
- [ ] **Step 6: Checkpoint** → save workflow JSON.

---

### Task 8: Product image sending (resolve Zernio media gap)

**Deliverable:** `send_product_image` delivers the product image on WhatsApp.

- [ ] **Step 1: Probe Zernio media API.** Check Zernio docs / try `POST .../conversations/{id}/messages` with an attachment field (image URL). Record whether Zernio supports media-out.
- [ ] **Step 2a (if supported):** add a Zernio send-media node using `get_product.image_url`.
- [ ] **Step 2b (if not):** send the `image_url` inside the text message (WhatsApp renders a preview); wire `send_product_image` → send-text with `reply = caption + "\n" + image_url`.
- [ ] **Step 3: Validate + test.** Ask "ابعتلي صورة المنتج" for a known product → expect the image (or previewed URL) to arrive.
- [ ] **Step 4: Checkpoint** → save workflow JSON + note which path Zernio supports in the spec's §8.

---

### Task 9: Dashboard outbound webhook (`/agent-send`)

**Deliverable:** A human agent's message from the dashboard is delivered to the customer.

**Nodes:** `Webhook (/agent-send, responseNode)` → `Switch (content_type)` → `Zernio send (text/image)` → `Supabase Insert messages (sender_type=agent)` → `Respond`.

- [ ] **Step 1: Add the second Webhook** — path `wa-agent-send`, responseMode `responseNode`. Body shape follows the dashboard `sendMessage` payload (`api.ts:312`): `{ conversationId, accountId, content_type, message, media_url? }`.
- [ ] **Step 2: Branch on `content_type`** → Zernio send-text or send-media.
- [ ] **Step 3: Log** to `messages` with `sender_type:'agent'`.
- [ ] **Step 4: Respond** 200 to the dashboard.
- [ ] **Step 5: Validate + test** by POSTing a sample dashboard payload → expect WhatsApp delivery + an `agent` message row.
- [ ] **Step 6: Checkpoint** → save workflow JSON.

---

### Task 10: Error handling + retries

**Deliverable:** External-call failures degrade gracefully instead of breaking the flow.

- [ ] **Step 1:** On each backend/Zernio HTTP node, set `retryOnFail=true`, `maxTries=3`, `waitBetweenTries=2000`, `continueOnFail` where a fallback exists.
- [ ] **Step 2:** Add a catch path: if the agent or a tool errors, send a friendly "عذراً، حصل خطأ مؤقت، جرّب تاني بعد لحظات" via Zernio and log the error.
- [ ] **Step 3: Validate + test** by pointing a tool at a wrong URL → expect the friendly fallback, not a crash. Restore the URL.
- [ ] **Step 4: Checkpoint** → save workflow JSON.

---

### Task 11: End-to-end integration + go-live wiring

**Deliverable:** A documented, working bot on a real WhatsApp number.

- [ ] **Step 1:** Deploy backends A + B on the VPS (subdomains). Update the workflow's A/B base URLs to prod.
- [ ] **Step 2:** In the dashboard **Channels** page, create the WhatsApp channel with Zernio accountId + token, backend URLs, and the system prompt; set `agent_webhook_url` = the `/wa-agent-send` webhook URL; set `NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL`.
- [ ] **Step 3:** Register the **Zernio webhook** to POST to the `/wa-zernio-inbound` URL.
- [ ] **Step 4:** Plug in the chosen chat model + credential (the deferred choice).
- [ ] **Step 5:** Full live test: search → image → order → payment link → tracking → services-handoff → agent reply from dashboard. Verify each in the dashboard chat.
- [ ] **Step 6: Final checkpoint** → save workflow JSON + update the spec's go-live section with the real URLs.

## Self-Review

- **Spec coverage:** all 6 capabilities covered (search T5, image T8, order T5/T6, tracking T5/T6, handoff T7, services T7); both webhooks (T1/T9); data model (T2/T3/T6); Zernio + A/B contracts (Global Constraints, T5/T6); error handling (T10); testing per task; go-live (T11). No gaps.
- **Placeholders:** the only deferred items (chat model in T4/T11, Zernio media path in T8) are intentional and have explicit resolution steps — not vague TODOs.
- **Type consistency:** normalized field names (T1) reused verbatim in T2–T9; agent output contract (T6) matches the intents in T7/T8; tool names (T5) referenced consistently.
