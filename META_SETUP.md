# Connecting Facebook & Instagram

How to get real Facebook Messenger and Instagram DMs flowing into the inbox.
Budget an hour the first time. Work through it in order — most failures come from
doing step 6 before step 4.

---

## Before you start

You need three things that are **not** part of this codebase:

1. **A Facebook Page.** Not a personal profile. Create one at
   [facebook.com/pages/create](https://www.facebook.com/pages/create) — it can be a
   throwaway test page.
2. **An Instagram Professional account** (Business or Creator), **linked to that
   Page**. A personal Instagram account cannot receive API messages at all. Convert
   in the Instagram app: Settings → Account type and tools → Switch to professional.
   Then link it under the Page's Settings → Linked accounts.
3. **A deployed `meta-proxy`** (see [`meta-proxy/README.md`](meta-proxy/README.md)),
   giving you one stable HTTPS URL. Meta will not accept `localhost`, and your Pinggy
   tunnel URL changes every restart.

Throughout this guide, **`PUBLIC_URL`** means your proxy URL, e.g.
`https://eksamadhan-proxy.vercel.app`.

---

## 1. Create the Meta app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) →
   **Create App**.
2. Use case: **Other** → type: **Business**.
3. Name it anything. Attach a Business Portfolio if prompted.

## 2. Copy your credentials into the project

**Settings → Basic** gives you the App ID and App Secret. Put them in
`backend/.env`:

```bash
FACEBOOK_APP_ID=1234567890
FACEBOOK_APP_SECRET=abc123...
```

While on that page, also set:

| Field | Value |
| :--- | :--- |
| App Domains | your proxy domain, no scheme — `eksamadhan-proxy.vercel.app` |
| Privacy Policy URL | `PUBLIC_URL/api/auth/privacy` |
| Terms of Service URL | `PUBLIC_URL/api/auth/privacy` |

The app serves that privacy page itself — Meta requires it to exist before the app
can go live.

## 3. Add the products

In the left sidebar, **Add Product**:

- **Facebook Login** — the OAuth flow
- **Messenger** — Facebook Page DMs
- **Instagram** — Instagram DMs

## 4. OAuth redirect URIs

**Facebook Login → Settings → Valid OAuth Redirect URIs.** Add both, exactly:

```
PUBLIC_URL/api/auth/facebook/callback
PUBLIC_URL/api/auth/instagram/callback
```

These must match `FACEBOOK_REDIRECT_URI` and `INSTAGRAM_REDIRECT_URI` in
`backend/.env` **character for character**, trailing slash included. A mismatch is
the single most common cause of `redirect_uri` errors.

## 5. Start the stack

```bash
./run.sh
```

It starts PostgreSQL, opens the tunnel, registers it with the proxy, and prints every
URL you need. Confirm you see `✅ TUNNEL ESTABLISHED` — if it says the tunnel failed,
fix that before continuing, because Meta cannot reach you.

## 6. Webhooks

Webhook setup only succeeds while the backend is **running** — Meta immediately calls
your endpoint to verify it.

**Messenger → Settings → Webhooks** (and the same under **Instagram → Webhooks**):

| Field | Value |
| :--- | :--- |
| Callback URL | `PUBLIC_URL/api/webhook` |
| Verify Token | the `WEBHOOK_VERIFY_TOKEN` value in `backend/.env` |

Click **Verify and Save**. Meta sends a `GET` with `hub.challenge`; the app echoes it
back. If it fails, check `backend.log`.

Then **Add Subscriptions** and tick:
- Messenger: `messages`, `messaging_postbacks`
- Instagram: `messages`

Finally, under Messenger → Settings, **add your Page** and generate a page access
token so Meta will deliver that Page's events.

## 7. Connect from the dashboard

Open <http://localhost:5174> and click **Connect Facebook** (or Instagram). You'll be
sent to Meta's consent screen, choose your Page, and land back on the dashboard with
the page listed.

## 8. Test it

Message your Facebook Page **from a different account** — your own messages to your
own Page will not arrive as inbound events. The message should appear in the inbox
within a few seconds. If not, check `backend.log` first; `tunnel.log` second.

---

## While the app is in Development mode

Only people with a **role on the app** can use it — admins, developers and testers.
Add your test accounts under **App Roles → Roles**. Messages from anyone else are
silently dropped, which looks exactly like a broken webhook.

## Going live needs App Review

Public use requires approval for `pages_messaging`, `instagram_basic` and
`instagram_manage_messages`. Review takes **weeks and can be refused**, and needs a
screencast, a written use-case and a working privacy policy.

**Submit this early.** The project plan puts Meta integration in weeks 1–3
specifically so review runs in the background while you build the AI layer.

---

## When it doesn't work

| Symptom | Cause |
| :--- | :--- |
| `URL blocked` / `redirect_uri mismatch` | Step 4 URI doesn't exactly match `backend/.env` |
| Webhook verification fails | Backend not running, tunnel down, or verify token mismatch |
| Verifies but no messages arrive | Subscription fields not ticked, or Page not added in step 6 |
| Worked yesterday, dead today | Free Pinggy tunnel expired — restart `./run.sh` to re-register |
| Instagram connects, no DMs | Account is personal, not Professional, or not linked to the Page |
| Your own messages don't show | Expected — message from a different account |
