# n8n — Flattening Channel Configuration

The `HTTP Request` node fetches `channels` with nested joins:

```
channels → channel_configurations, agent_prompts, keyword_actions, content_collections
```

The response is deeply nested. Add these fields to `Edit Fields12` (Instagram) / `Edit Fields11` (Facebook) to flatten everything for easy downstream access.

---

## Fields to Add in Edit Fields Node

### Already Mapped (existing)

| Field | Expression |
|-------|-----------|
| `platform` | `{{ $json.platform }}` |
| `platform_channel_id` | `{{ $json.platform_channel_id }}` |
| `organization_id` | `{{ $json.organization_id }}` |
| `channel_id` | `{{ $json.id }}` |
| `is_active` | `{{ $json.is_active }}` |
| `token` | `{{ $json.credentials.token }}` |

---

### NEW — Keyword Actions

| Field | Type | Expression |
|-------|------|-----------|
| `disable_ai_keyword` | String | `{{ $json.keyword_actions.find(k => k.action_type === 'DISABLE_AI')?.keyword }}` |
| `enable_ai_keyword` | String | `{{ $json.keyword_actions.find(k => k.action_type === 'ENABLE_AI')?.keyword }}` |

**Usage downstream:**
```
{{ $('Edit Fields12').item.json.disable_ai_keyword }}  → "8"
{{ $('Edit Fields12').item.json.enable_ai_keyword }}   → "9"
```

---

### NEW — Content Collections (Testimonials, Product Images)

| Field | Type | Expression |
|-------|------|-----------|
| `testimonials_1` | String | `{{ JSON.stringify($json.content_collections.find(c => c.collection_id === 'testimonials_1')?.items \|\| []) }}` |
| `testimonials_2` | String | `{{ JSON.stringify($json.content_collections.find(c => c.collection_id === 'testimonials_2')?.items \|\| []) }}` |
| `testimonials_3` | String | `{{ JSON.stringify($json.content_collections.find(c => c.collection_id === 'testimonials_3')?.items \|\| []) }}` |
| `product_images` | String | `{{ JSON.stringify($json.content_collections.find(c => c.collection_id === 'product_images')?.items \|\| []) }}` |

**Usage downstream:**
```
{{ $('Edit Fields12').item.json.testimonials_1 }}
→ ["https://n8nfiles.bestlifeeg.store/IMG-20251028-WA0076.jpg", ...]
```

To get a single random image from a collection:
```
{{ JSON.parse($('Edit Fields12').item.json.testimonials_1)[Math.floor(Math.random() * JSON.parse($('Edit Fields12').item.json.testimonials_1).length)] }}
```

---

### NEW — Agent Configuration

| Field | Type | Expression |
|-------|------|-----------|
| `system_prompt` | String | `{{ $json.agent_prompts.find(p => p.agent_id === 'main_sales_agent')?.system_prompt }}` |
| `re_engagement_prompt` | String | `{{ $json.agent_prompts.find(p => p.agent_id === 're_engagement_agent')?.system_prompt }}` |
| `ai_model` | String | `{{ $json.channel_configurations.ai_model }}` |
| `ai_temperature` | Number | `{{ $json.channel_configurations.ai_temperature }}` |
| `fallback_model` | String | `{{ $json.channel_configurations.fallback_model }}` |
| `agent_webhook_url` | String | `{{ $json.channel_configurations.agent_webhook_url }}` |
| `is_bot_active` | Boolean | `{{ $json.channel_configurations.is_bot_active }}` |

**Usage downstream:**
```
{{ $('Edit Fields12').item.json.system_prompt }}         → full prompt text
{{ $('Edit Fields12').item.json.ai_model }}              → "models/gemini-1.5-flash"
{{ $('Edit Fields12').item.json.is_bot_active }}          → true
```

---

### NEW — Notifications / Telegram

| Field | Type | Expression |
|-------|------|-----------|
| `telegram_group` | String | `{{ $json.credentials.telegram }}` |
| `fb_page_no` | String | `{{ $json.credentials.FB_PAGE_NO }}` |

---

## Switch3 Node — Use Flattened Keywords

Replace hardcoded `"8"` and `"9"` in Switch3 with:

```
Output 0 (DISABLE_AI):
{{ $json.body.entry[0].messaging[0].message.text }}
equals
{{ $('Edit Fields12').item.json.disable_ai_keyword }}

Output 1 (ENABLE_AI):
{{ $json.body.entry[0].messaging[0].message.text }}
equals
{{ $('Edit Fields12').item.json.enable_ai_keyword }}
```

This way, if you change keywords in the dashboard, the workflow picks them up automatically — no need to edit n8n.

---

## Summary — What You Get

```
BEFORE (deeply nested):
$json[0].keyword_actions.find(k => k.action_type === 'DISABLE_AI').keyword
$json[0].content_collections.find(c => c.collection_id === 'testimonials_1').items[0]
$json[0].agent_prompts[0].system_prompt

AFTER (flat):
$('Edit Fields12').item.json.disable_ai_keyword        → "8"
$('Edit Fields12').item.json.testimonials_1             → ["url1","url2",...]
$('Edit Fields12').item.json.system_prompt              → full text
```
