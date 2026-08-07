# n8n Workflow Fixes — Reference Guide

This document outlines all required fixes for `face universal.json` (and equivalent Instagram/WhatsApp workflows).
These changes must be applied manually in the n8n workflow editor.

---

## 🚨 Fix 1: Remove Hardcoded Credentials (CRITICAL)

The following nodes contain plaintext secrets that MUST be moved to n8n environment variables or the credential store:

### Nodes to Fix

| Node Name | What's Exposed | How to Fix |
|-----------|---------------|------------|
| `HTTP Request6` | Supabase service_role JWT in `Authorization` header | Create an n8n Credential of type "Header Auth" with the JWT. Reference it in the node's Authentication settings. |
| `get bearer` | Login email/password (`Khadija@bestlifeeg.com` / `M@ras123`) | Move to n8n Environment Variables: `ECOMMERCE_EMAIL` and `ECOMMERCE_PASSWORD`. Reference as `{{ $env.ECOMMERCE_EMAIL }}`. |
| `create customer` | API key `i9u99tt4-f0w6-71w7-8394-y968t02516r11` | Create an n8n Credential of type "Header Auth". Reference in the node. |
| `get address id1` | Bearer token `1356\|6N1AVxaB...` | Create an n8n Credential of type "Header Auth". Reference in the node. |

> **If this file has been committed to a public git repo, rotate ALL exposed secrets immediately.**

---

## 🐛 Fix 2: Platform Resolution Bug

### Problem
In the "echo" handler branch, the `Create a row2` Supabase node creates new contacts with `platform: "instagram"` hardcoded, even though this is the Facebook workflow.

### Location
Look for the node that creates contacts in the echo/fallback branch. The `platform` field is set to a static value `"instagram"`.

### Fix
Change the static value to a dynamic expression that reads the platform from the channel configuration:
```
{{ $('Edit Fields11').item.json.platform }}
```

Or if `Edit Fields11` isn't upstream in this branch, use:
```
{{ $node["channelConfigNode"].json.platform }}
```

---

## 🐛 Fix 3: Missing `organization_id` and `channel_id` on Message Inserts

### Problem
Some `Create a row` nodes that save AI response messages to the `messages` table are missing the required `organization_id` and `channel_id` fields. This will violate NOT NULL constraints.

### Nodes to Audit
Search for all Supabase "Create a row" nodes that target the `messages` table and ensure each one includes:
- `organization_id`: `{{ $('Edit Fields11').item.json.organization_id }}`
- `channel_id`: `{{ $('Edit Fields11').item.json.channel_id }}`

Specifically check `Create a row7` — it was missing both fields.

---

## 🐛 Fix 4: Broken Audio Attachment URL for Dashboard

### Problem
The `Supabase14` node (audio message save) references `$('Edit Fields11').item.json.attachment_url_for_dashboard` for the `attachment_url` field, but `Edit Fields11` never sets this field. Audio messages end up with a null `attachment_url` in the database.

### Fix
In `Edit Fields11`, add a new field `attachment_url_for_dashboard` that computes the audio file URL.

**Option A — Use Facebook CDN URL directly** (temporary, URLs expire after ~24h):
```
{{ $json.entry[0].messaging[0].message.attachments[0].payload.url }}
```

**Option B — Upload to Supabase Storage first** (recommended, permanent):
1. Add an HTTP Request node before `Supabase14` to download the audio file from Facebook CDN
2. Add a Supabase Storage upload node to upload to the `chat-attachments` bucket
3. Use the returned public URL as `attachment_url`

Also populate `attachment_metadata` with:
```json
{
  "mime_type": "audio/ogg",
  "duration_seconds": null
}
```

---

## ✨ Fix 5: Add Video/Document/Sticker Handling

### Problem
The Switch node only handles `audio`, `image`, and falls through to `text`. Users who send videos, documents, stickers, or locations have their messages silently dropped or misclassified as text.

### Fix
Add new output branches to the Switch node for:

| Attachment Type | content_type Value | Notes |
|----------------|-------------------|-------|
| `video` | `video` | Extract URL from `attachments[0].payload.url` |
| `file` | `document` | Same extraction pattern |
| `fallback` | `sticker` | Sticker images use `attachments[0].payload.url` |

For each new branch:
1. Save the message to the `messages` table with the correct `content_type`
2. Set `attachment_url` to the media URL
3. Set `attachment_metadata` with `{ "mime_type": "..." }`

---

## 🔄 Fix 6: Standardize Graph API Versions

### Problem
The workflow uses a mix of Facebook Graph API versions across different nodes:
- Some nodes use `v20.0`
- Some use `v22.0`
- Some use `v23.0`
- Some use `v24.0`

This can cause subtle bugs when Facebook deprecates older versions.

### Fix
Search all HTTP Request nodes that call `graph.facebook.com` and update all URLs to use `v24.0`:
```
https://graph.facebook.com/v24.0/...
```

### Nodes to Update
Search for any URL containing:
- `graph.facebook.com/v20.0` → change to `v24.0`
- `graph.facebook.com/v22.0` → change to `v24.0`
- `graph.facebook.com/v23.0` → change to `v24.0`

---

## 📋 Verification Checklist

After applying all fixes:

- [ ] Test with a new Facebook message → verify no credential errors
- [ ] Test with a new Instagram message → verify platform is `"instagram"`, not hardcoded
- [ ] Send an audio message from Messenger → verify `attachment_url` is populated in the DB
- [ ] Send a video from Messenger → verify it appears in the dashboard with correct rendering
- [ ] Send a document/PDF from Messenger → verify it appears as downloadable in the dashboard
- [ ] Check all `messages` table rows have `organization_id` and `channel_id` populated
- [ ] Verify no hardcoded credentials remain in the workflow JSON
