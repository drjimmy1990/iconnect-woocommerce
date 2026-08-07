# n8n Workflow Modification Guide — Hybrid Stage Tracking

## Overview

This guide uses a **hybrid approach** to track client conversation stages:
- **HTTP Nodes** for stages with dedicated intents (testimonials, price, order)
- **AI Agent Tool** for `bmi_collected` (only the AI knows when BMI was calculated)

---

## Architecture

```
AI Agent (grok-4.1-fast)
    │
    ├── Tool: update_client_stage  ← AI calls this for bmi_collected
    │
    └── Output → Switch7 (Intent Router)
                    │
                    ├── sending_testimonials_1 → [HTTP: testimonials_viewed] → existing flow
                    ├── sending_product_image  → [HTTP: price_viewed] → existing flow
                    └── creating_order         → order flow → [HTTP: purchased + bmi_data]
```

---

## API Endpoint (same for all calls)

```
POST https://<YOUR_PROJECT>.supabase.co/rest/v1/rpc/update_client_stage
```

### Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `apikey` | `<YOUR_SUPABASE_ANON_KEY>` |
| `Authorization` | `Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>` |

---

## PART 1: AI Agent Tool — `bmi_collected` Stage

This is a **Tool node** connected to the AI Agent's tool input. The AI decides when to call it.

### Step 1: Add an HTTP Request Tool Node

1. In your n8n workflow, add a new **HTTP Request Tool** node
2. Connect it to the **AI Agent** node's `ai_tool` input (the bottom connector)

### Step 2: Configure the Tool

**General Settings:**
- **Name:** `update_client_stage`
- **Description:** (paste this exactly)
```
Call this tool to update the client's conversation stage in the CRM dashboard.
You MUST call this tool with stage "bmi_collected" immediately after you have collected the client's weight, height, and age and calculated their BMI.
Do NOT call this tool for any other stage — those are handled automatically.
The parameters are:
- stage: must be "bmi_collected"
```

**HTTP Request:**
- **Method:** POST
- **URL:** `https://<PROJECT>.supabase.co/rest/v1/rpc/update_client_stage`

**Headers:**
| Name | Value |
|------|-------|
| `Content-Type` | `application/json` |
| `apikey` | `<ANON_KEY>` |
| `Authorization` | `Bearer <SERVICE_ROLE_KEY>` |

**Body (JSON):**
```json
{
  "p_platform_user_id": "={{ $('Edit Fields11').first().json.platform_user_id }}",
  "p_channel_id": "={{ $('Edit Fields11').first().json.channel_id }}",
  "p_stage": "bmi_collected"
}
```

> **Note:** The `platform_user_id` and `channel_id` come from `Edit Fields11` which is set up early in your workflow from the webhook data.

### Step 3: Update the AI Agent System Prompt

Add this to your system prompt (in Supabase `agent_prompts` table):

```
## CRM Stage Tracking
When you collect the client's weight, height, and age and calculate their BMI, you MUST call the update_client_stage tool with stage "bmi_collected".
```

---

## PART 2: HTTP Node — `testimonials_viewed` Stage

Add this **after** the `sending_testimonials_1` branch of Switch7.

### Where in the workflow:

```
Switch7 → "sending_testimonials_1" output → [NEW: HTTP Request] → existing testimonials flow
```

### Node Configuration:

1. Add an **HTTP Request** node
2. Connect Switch7's `sending_testimonials_1` output to this new node
3. Connect this node's output to the existing testimonials flow (the images/media sending nodes)

**Method:** POST  
**URL:** `https://<PROJECT>.supabase.co/rest/v1/rpc/update_client_stage`

**Headers:** Same 3 headers as above

**Body (JSON):**
```json
{
  "p_platform_user_id": "={{ $('Edit Fields11').first().json.platform_user_id }}",
  "p_channel_id": "={{ $('Edit Fields11').first().json.channel_id }}",
  "p_stage": "testimonials_viewed"
}
```

**Settings:**
- **Continue On Fail:** ✅ ON
- **Timeout:** 10000

---

## PART 3: HTTP Node — `price_viewed` Stage

Add this **after** the `sending_product_image` branch of Switch7.

### Where in the workflow:

```
Switch7 → "sending_product_image" output → [NEW: HTTP Request] → existing product image flow
```

### Node Configuration:

**Method:** POST  
**URL:** `https://<PROJECT>.supabase.co/rest/v1/rpc/update_client_stage`

**Headers:** Same 3 headers

**Body (JSON):**
```json
{
  "p_platform_user_id": "={{ $('Edit Fields11').first().json.platform_user_id }}",
  "p_channel_id": "={{ $('Edit Fields11').first().json.channel_id }}",
  "p_stage": "price_viewed"
}
```

**Settings:**
- **Continue On Fail:** ✅ ON

---

## PART 4: HTTP Node — `purchased` Stage + BMI Data

Add this **at the end** of the `creating_order` chain, after the Telegram notification and order creation.

### Where in the workflow:

```
creating_order → AI Agent15 → create customer → ... → Telegram notification → [NEW: HTTP Request]
```

### Node Configuration:

**Method:** POST  
**URL:** `https://<PROJECT>.supabase.co/rest/v1/rpc/update_client_stage`

**Headers:** Same 3 headers

**Body (JSON):**
```json
{
  "p_platform_user_id": "={{ $('Edit Fields11').first().json.platform_user_id }}",
  "p_channel_id": "={{ $('Edit Fields11').first().json.channel_id }}",
  "p_stage": "purchased",
  "p_bmi_data": {
    "weight": {{ $json.orderData ? $json.orderData.weight || 0 : $json.output.orderData.weight || 0 }},
    "height": {{ $json.orderData ? $json.orderData.height || 0 : $json.output.orderData.height || 0 }},
    "age": {{ $json.orderData ? $json.orderData.age || 0 : $json.output.orderData.age || 0 }},
    "bmi": {{ $json.orderData ? $json.orderData.bmi || 0 : $json.output.orderData.bmi || 0 }}
  }
}
```

> **Important:** The BMI data (weight, height, age, bmi) must be included in the `orderData` JSON that the AI Agent outputs. You may need to update the AI prompt to include these fields in the order output.

**Settings:**
- **Continue On Fail:** ✅ ON

---

## Prompt Update for Order Intent

Your AI agent prompt should instruct the bot to include BMI data in the order output. Add to the system prompt:

```
## Order Data Requirements
When creating an order (intent: creating_order), your orderData JSON MUST include these BMI fields that you collected earlier in the conversation:
- weight (number, in kg)
- height (number, in cm)  
- age (number)
- bmi (number, calculated)

Example orderData:
{
  "customer_name": "Ahmed",
  "customer_phone": "01012345678",
  "full_address": "...",
  "state_name": "Cairo",
  "city_name": "Nasr City",
  "product_sku": "LIPO-FIT-01",
  "product_name": "كبسولات Lipo Fit",
  "product_price": 1000,
  "discount": 0,
  "quantity": 1,
  "shipping_price": 85,
  "total_price": 1085,
  "weight": 87,
  "height": 175,
  "age": 30,
  "bmi": 28.4
}
```

---

## How to Get channel_id

The `channel_id` is already available in your workflow at `$('Edit Fields11').first().json.channel_id` — it's loaded from the Supabase channel configuration early in the flow.

---

## Testing

### Test the AI Tool (bmi_collected)
1. Send a message to the bot with weight/height/age info
2. Check in Supabase: `SELECT conversation_stage, bmi_data FROM crm_clients WHERE ...`
3. Should show `conversation_stage = 'bmi_collected'`

### Test HTTP Nodes (testimonials/price/purchased)
1. Continue the conversation until the bot sends testimonials
2. Check: `conversation_stage = 'testimonials_viewed'`
3. Continue until price is shown
4. Check: `conversation_stage = 'price_viewed'`
5. Complete purchase
6. Check: `conversation_stage = 'purchased'` AND `bmi_data` is populated

---

## Summary

| Stage | Method | Trigger |
|-------|--------|---------|
| `first_contact` | **Automatic** | Set when CRM client is created |
| `bmi_collected` | **AI Agent Tool** | AI calls after collecting weight/height/age |
| `testimonials_viewed` | **HTTP Node** | After Switch7 → `sending_testimonials_1` |
| `price_viewed` | **HTTP Node** | After Switch7 → `sending_product_image` |
| `purchased` | **HTTP Node** | After order creation + includes BMI data |
