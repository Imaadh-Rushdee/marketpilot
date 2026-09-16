# MarketPilot V2

MarketPilot turns a business offer into a social media campaign shared across every selected social destination.

## Included

- Email/password sign-up, sign-in, email confirmation, sign-out and password recovery through Supabase Auth
- A private cloud workspace for each user with row-level security
- Business onboarding, keywords and expected outcomes used by AI
- Dashboard, business profile, 1-5 posts-per-day campaign creator, Content Studio and content calendar
- Animated marketing site, dedicated pricing page and four server-enforced subscription tiers
- Logo/reference uploads, finished artwork uploads, brand colors and private storage
- AI branded post graphics, ads and banners with a saved PNG library
- One daily post assigned to all selected destinations and a direct approval button
- Live Gemini generation or a template-based demo mode
- Automatic cloud saves, save retries and protection against stale edits from another device
- Content editing, regeneration, copy, download, deletion and manual publishing status
- JSON backup/restore and explicit import of the previous local browser workspace
- Netlify build configuration for the Next.js server and API routes

## Setup

Requires Node.js 22 or newer. From `web`:

```bash
npm install
npm run dev
```

Set the Supabase public project URL and publishable key in `.env`, and apply the both supplied SQL migrations before signing in. Setup is required: the app no longer opens an anonymous local workspace.

Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for database setup, Cloudflare Workers AI, email confirmation/reset configuration and Netlify deployment. `.env.example` lists the environment variables. Gemini uses `gemini-3.6-flash` for captions. Graphics use Cloudflare's free-tier FLUX.1 Schnell model. Missing provider credentials or `MARKETPILOT_DEMO_MODE=true` enables demo generation after authentication.

Plan limits are defined once in `src/app/lib/plans.ts` and enforced by authenticated APIs. Apply `supabase/migrations/202609160001_subscriptions.sql` before deploying this version. Upgrading a plan currently requires a trusted server or Supabase administrator to update `marketpilot_subscriptions`; payment checkout/webhooks should be connected after choosing a billing provider.

## Validation

```bash
npm run lint
npm run build
npm run test:auth
```

`test:auth` starts an isolated local mock Supabase service and Next.js server. It checks the real authentication guards, SSR cookies, cloud API behavior, save conflicts, password recovery redirects, multi-platform assignment, private uploads, logo compositing and graphics library isolation without touching your live database. Live Supabase RLS, email delivery and the deployed site must also be checked after the project is connected.

`test:smoke` requires a signed-in test session supplied through `TEST_COOKIE`, a demo-mode server and optional `TEST_BASE_URL`. Do not share session cookies.

## Workflow

1. Create an account, confirm your email, then sign in.
2. Save your business details, brand color and logo, then create a campaign with 1 to 5 distinct posts per day.
3. Review/edit the content, approve it, and set publish dates.
4. Build a branded PNG or upload finished artwork in Graphics studio, attach it to a post, publish to every selected destination, and mark the post Posted.
5. Wait for Saved to cloud before leaving. If saving fails, retry or export a backup.

Regeneration preserves the platform, format and publish date and returns content to Draft. The old browser workspace is preserved and can be imported explicitly from Business profile. Imports replace the current account's profile and campaigns after confirmation.

Social account linking, automatic posting, payments, AI video generation, team workspaces and advanced analytics are not included.
