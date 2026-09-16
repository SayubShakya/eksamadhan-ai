# 📱 Meta (Facebook & Instagram) Configuration Guide

This document defines exactly which URLs you need to paste into your [Meta App Dashboard](https://developers.facebook.com/). These URLs are dynamically generated based on your `serveo` tunnel.

## 🛠️ App Settings (Basic)
Copy these into **Settings > Basic**:

| Field | Value |
| :--- | :--- |
| **App Domains** | `TUNNEL_DOMAIN` (e.g. `xxxx.serveousercontent.com`) |
| **Privacy Policy URL** | `https://TUNNEL_DOMAIN/api/auth/privacy` |
| **Terms of Service URL** | `https://TUNNEL_DOMAIN/api/auth/privacy` |

---

## 🔐 OAuth Redirect Settings
Copy these into **Facebook Login > Settings > Valid OAuth Redirect URIs**:

| Platform | Redirect URI |
| :--- | :--- |
| **Facebook** | `https://TUNNEL_DOMAIN/api/auth/facebook/callback` |
| **Instagram** | `https://TUNNEL_DOMAIN/api/auth/instagram/callback` |

---

## 🔔 Webhook Settings
Copy these into **Messenger > Settings** AND **Instagram > Settings** (Webhooks section):

| Field | Value |
| :--- | :--- |
| **Callback URL** | `https://TUNNEL_DOMAIN/api/webhook` |
| **Verify Token** | (Find `WEBHOOK_VERIFY_TOKEN` in your `.env` file) |

---

## 🚀 How to get your current URLs
Every time you run `./run.sh`, the terminal will look like this:

```bash
✅ TUNNEL ESTABLISHED: https://xxx-xxx.serveousercontent.com

📱 META (FACEBOOK/INSTAGRAM) CONFIGURATION:
--------------------------------------------------------
🔗 App Domains:          xxx-xxx.serveousercontent.com
🔗 Privacy Policy URL:    https://xxx-xxx.serveousercontent.com/api/auth/privacy
🔗 Terms of Service URL:  https://xxx-xxx.serveousercontent.com/api/auth/privacy

🔗 FB Redirect URI:       https://xxx-xxx.serveousercontent.com/api/auth/facebook/callback
🔗 IG Redirect URI:       https://xxx-xxx.serveousercontent.com/api/auth/instagram/callback
🔗 Webhook Callback URL:  https://xxx-xxx.serveousercontent.com/api/webhook
🔗 Webhook Verify Token:  (Check your .env)
--------------------------------------------------------
```

> **Note**: If you restart the tunnel and the URL changes, you MUST update these fields in the Meta Dashboard for the integration to work.
