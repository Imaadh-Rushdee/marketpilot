# Supabase + Netlify setup

Netlify project created: `marketpilot-imexra`, under your Imexra account. Target URL: https://marketpilot-imexra.netlify.app. Publishing the connected app requires the Supabase credentials and migration below.

## 1. Connect Supabase

Create or select your Supabase project. From the Connect dialog, copy its Project URL and publishable key. Fill the blank Supabase placeholders in the existing `web/.env` file. Its Gemini key is preserved. Example values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
GEMINI_API_KEY=YOUR_GEMINI_KEY
GEMINI_MODEL=gemini-3.6-flash
CLOUDFLARE_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_AI_API_TOKEN=YOUR_WORKERS_AI_TOKEN
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
MARKETPILOT_DEMO_MODE=false
```

The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported. Do not supply a service-role or `sb_secret_` key. Gemini credentials remain server-only.

Run the SQL in `supabase/migrations/202609140001_marketpilot.sql` once in the project's SQL Editor. It creates a private workspace per account, enables row-level security, and adds an atomic save function. No service-role key is needed by the app.

Next, run `supabase/migrations/202609140002_marketpilot_v2.sql` once. This adds the private `marketpilot-assets` storage bucket, owner-only upload/download policies and saved graphics library. Run both migrations in the same project used by `.env`. If you previously saw `PGRST205`, the first migration is required; the second migration does not replace it.

Then run `supabase/migrations/202609160001_subscriptions.sql`. It creates the Free, Basic, Plus and Premium subscription records, weekly usage counters, row-level security and the atomic usage function used by the API. Content generation and workspace saving intentionally return a setup error until this migration exists.

Run `supabase/migrations/202609150003_social_connections.sql` once to add owner-only encrypted social connection records.

## 2. Configure email authentication

In Supabase Authentication → Providers, enable Email. Keep email confirmation enabled and configure a minimum password length of 8 characters.

Under Authentication → URL Configuration, set Site URL to the final Netlify URL. Allow these redirects for production and local testing:

```text
https://marketpilot-imexra.netlify.app/auth/callback
https://marketpilot-imexra.netlify.app/auth/callback?next=/auth/update-password
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?next=/auth/update-password
```

Add an individual preview deploy's URL if testing authentication there. The standard Supabase email templates work with the PKCE callback when the link is opened in the browser that requested it. For confirmation/reset links that should work on another browser, use these token-hash links in the Supabase email templates:

Confirm signup:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Confirm email</a>
```

Reset password:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

These templates use the configured Site URL. Configure custom SMTP before opening public registration: Supabase's default email sender is limited and intended for testing.

## 3. Verify locally

From `web`:

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

Sign up, confirm email, sign in, create a campaign, and refresh. Edits should show Saved to cloud. Sign out and sign into another account: the first account's campaigns must not appear. Test password recovery. Sign in on another device to verify the same workspace loads.

The former local workspace is not imported automatically into a new account. Use Business profile → Import previous browser data, or restore an exported JSON backup. Import replaces the current cloud workspace after confirmation. Existing local data is preserved.

Concurrent updates show a conflict rather than overwriting another device's changes. Export unsaved changes before reloading the cloud version. Failed saves remain visible and can be retried.

## 4. Deploy to Netlify

Connect the repository's root folder through the Netlify dashboard. The root `netlify.toml` sets base directory `web`, build command `npm run build`, publish directory `.next`, and Node 22. Do not deploy this app by dragging a static folder; authentication and Gemini generation require server functions.

Set these environment variables in Netlify **before building**:

| Variable | Scope |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Builds and Functions |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Builds and Functions |
| GEMINI_API_KEY | Functions; keep secret |
| GEMINI_MODEL | Functions |
| CLOUDFLARE_ACCOUNT_ID | Functions |
| CLOUDFLARE_AI_API_TOKEN | Functions; keep secret |
| CLOUDFLARE_IMAGE_MODEL | Functions; `@cf/black-forest-labs/flux-1-schnell` |
| MARKETPILOT_DEMO_MODE | Functions; `false` for live AI |
| NEXT_PUBLIC_APP_URL | Builds and Functions; final site origin |
| SOCIAL_TOKEN_ENCRYPTION_KEY | Functions; base64 32-byte secret |
| META_APP_ID / META_APP_SECRET | Functions; Meta developer app |
| TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET | Functions; TikTok developer app |

Supabase public values are bundled at build time. Changing them requires a new deployment. The root configuration loads Netlify's current Next.js adapter.

For a CLI upload, run from the project root (the folder containing `netlify.toml`):

```powershell
netlify login
netlify link
netlify env:import web/.env
netlify deploy --build
netlify deploy --build --prod
```

The preview command creates a review deployment; `--prod` publishes the app. The existing Netlify project can be selected when linking. If using Git instead, connect the repository in Netlify and add the environment variables in its dashboard.

The local `.env` file is ignored by Git. Add the same variable values in Netlify; changing a local file alone does not configure hosting. A `.env.local` file, if present, takes precedence over `.env` locally.

## 5. Production verification

Check the live login page and sign-up email, confirm the email, create/edit a campaign, refresh to verify persistence, check user isolation, and test sign-out and reset-password. Verify that `/api/workspace` and `/api/generate` reject requests without a session. Data must never be served from a shared cache; authenticated routes use private, no-store responses.

The app is prepared for hosting without Supabase values, but it displays Workspace setup required until they are supplied. This does not count as a completed Supabase connection.

## V2 business onboarding and graphics

New sign-ups provide business name, type, description, expected platform outcome and optional keywords. These details seed their private workspace and guide caption and graphic generation. Existing accounts can fill the same fields in Business profile.

In Business profile, choose a brand color, upload a logo and optionally up to five product/reference images (PNG/JPEG/WebP below 2 MB). Assets are private and require the signed-in owner to download. The original logo is composited onto the finished image without asking the AI to redraw it.

Graphics studio creates social posts, ads and banners in square (1080x1080), portrait (1080x1350) and landscape (1600x900) formats. Supply a brief, a short headline and a CTA. You can also upload finished PNG, JPEG or WebP artwork up to 10 MB. Generated and uploaded designs save to the same private library and can be attached to a selected post. Caption backups contain brand image paths, not image bytes; download graphics separately. Restoring a backup into another account requires re-uploading its brand images. Removing a profile image reference does not delete its stored file.

Image generation uses Cloudflare Workers AI with the open FLUX.1 Schnell model. Create a free Cloudflare account, open **Workers AI → Use REST API**, create a Workers AI token, and copy the Account ID. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_API_TOKEN`; the model variable can keep its default. Cloudflare provides a free daily allocation, with limits subject to its current plan. Without these credentials, or in demo mode, graphics are clearly marked demo templates. Caption generation can still use `GEMINI_API_KEY`; graphics do not use Gemini. See [Cloudflare's REST API setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/), [free allocation and pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), and [FLUX.1 Schnell](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/).

A campaign creates 1 to 5 distinct posts per day, assigned to every selected platform (Facebook, Instagram, TikTok, LinkedIn, Pinterest or X). Every post has its own hook, caption, CTA, hashtags and optional graphic. Approve each post with the button. Editing its copy returns it to Draft. After publishing on all destinations, use Mark posted on all platforms.

Image model requests time out after 45 seconds so the route has time to save and respond within Netlify's [60-second synchronous function limit](https://docs.netlify.com/build/functions/configuration/). If a generation times out, retry with a simpler brief.

## Social account linking

Apply the third migration and generate the encryption secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keep it server-only and backed up: changing it makes saved provider tokens unreadable. Set `NEXT_PUBLIC_APP_URL` to the exact deployed origin, such as `https://marketpilot-imexra.netlify.app`.

For Meta, create a Meta developer app, add Facebook Login, and register `<APP_URL>/auth/social/callback` as a valid OAuth redirect. Configure the app ID and secret. MarketPilot requests Page publishing and Instagram professional-account publishing permissions, then discovers Facebook Pages and their linked Instagram business accounts. Meta review and live-mode approval are required before people outside the app's developer/tester roles can connect.

For TikTok, create a TikTok developer app, add Login Kit and Content Posting API, register the same callback URL, and configure the client key and secret. Request approval for `video.publish`. TikTok requires a creator-info confirmation screen and verified media URL before direct photo publishing; unaudited clients are restricted to private visibility. The current V3 screen completes secure OAuth account linking and disconnection. Publishing controls are the next integration boundary and remain disabled until those provider requirements are satisfied.

TikTok's sharing rules also prohibit unwanted superimposed brand names, logos, watermarks, links, or promotional text. The branded Facebook/Instagram creative therefore cannot automatically be reused for TikTok. A compliant TikTok-specific media variant and consent screen are required before enabling its Publish action.
