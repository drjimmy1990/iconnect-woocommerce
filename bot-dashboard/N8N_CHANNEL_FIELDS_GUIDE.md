# دليل حقول إعدادات القنوات في n8n (Channel Configuration Fields)

تقوم عقدة **`HTTP Request`** بجلب إعدادات القناة من Supabase عبر جدول `channels`:

```
channels → channel_configurations, agent_prompts, keyword_actions
```

لتسهيل استخدام هذه الحقول في كامل الـ Workflow، يتم تسطيحها (Flattening) داخل عقدة **`Edit Fields12`**.

---

## 📋 الحقول المعرفة في عقدة `Edit Fields12`

| اسم الحقل | النوع | التعبير (Expression) | الغرض |
|---|---|---|---|
| `platform` | String | `{{ $json.platform }}` | المنصة (`instagram` أو `whatsapp`) |
| `platform_channel_id` | String | `{{ $json.platform_channel_id }}` | معرف القناة في المنصة (Account ID) |
| `organization_id` | String | `{{ $json.organization_id }}` | معرف المؤسسة (UUID) |
| `channel_id` | String | `{{ $json.id }}` | معرف القناة الداخلي في Supabase |
| `is_active` | String | `{{ $json.is_active }}` | هل القناة مفعلة |
| `token` | String | `{{ $json.credentials?.token }}` | توكن الوصول |
| `disable_ai_keyword` | String | `{{ $json.keyword_actions?.find(k => k.action_type === 'DISABLE_AI')?.keyword }}` | كلمة إيقاف البوت يدوياً (مثال: `8`) |
| `enable_ai_keyword` | String | `{{ $json.keyword_actions?.find(k => k.action_type === 'ENABLE_AI')?.keyword }}` | كلمة إعادة تفعيل البوت يدوياً (مثال: `9`) |
| `platform_user_id` | String | `{{ $('Code in JavaScript6').item.json.SenderJid }}` | معرف العميل في المنصة |
| `message_platform_id` | String | `{{ $('Webhook').item.json.body.message.id }}` | معرف الرسالة في المنصة |
| `original_message_text`| String | `{{ $('Code in JavaScript6').item.json.Msg }}` | نص رسالة العميل الأصلية |

---

## 🎯 الاستخدام في العقد التالية:
* **تحديد الـ Organization للإشعارات:** `{{ $('Edit Fields12').item.json.organization_id }}`
* **ربط الرسائل بالقناة:** `{{ $('Edit Fields12').item.json.channel_id }}`
* **التحقق من الكلمات المفتاحية:** فحص ما إذا كانت رسالة العميل تطابق `disable_ai_keyword` أو `enable_ai_keyword`.
