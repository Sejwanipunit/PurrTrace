# Hosting PawTrace for free

PawTrace's frontend is a static site (Vite build) and Supabase is the backend, so any
free static host works. Below is **Vercel** (recommended, simplest for Vite) with a
**Netlify** alternative. Both give you a free HTTPS URL like `https://pawtrace.vercel.app`.

> Order matters: **deploy first to get your live URL**, then paste that URL into Supabase +
> Google OAuth settings (last section). Otherwise Google sign-in will reject the redirect.

---

## Option A — Vercel (recommended)

### Fastest: the Vercel CLI (no GitHub needed)
```bash
cd pawtrace
npm i -g vercel
vercel            # first run: log in + answer the prompts, accept defaults
vercel --prod     # promotes to your live URL
```
When prompted, accept the detected **Vite** framework, build command `npm run build`,
and output dir `dist`. Add the two env vars when asked (or in the dashboard, below).

### Or: GitHub + dashboard (auto-deploys on every push)
1. Push this project to a GitHub repo (see "Putting it on GitHub" below).
2. Go to <https://vercel.com> → **Add New → Project** → import the repo.
3. Framework preset auto-detects **Vite**. Leave build/output defaults.
4. Add **Environment Variables** (see below) → **Deploy**.

### Set environment variables on Vercel
Project → **Settings → Environment Variables**, add both (for Production + Preview):
| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon/public key |

Redeploy after adding them (`vercel --prod`, or "Redeploy" in the dashboard).
`vercel.json` already handles SPA routing.

---

## Option B — Netlify
1. <https://app.netlify.com> → **Add new site → Import from Git** (or drag-and-drop the
   `dist/` folder for a one-off deploy).
2. Build command `npm run build`, publish dir `dist` (already in `netlify.toml`).
3. **Site settings → Environment variables** → add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` → trigger a redeploy.

`netlify.toml` already handles SPA routing.

---

## Putting it on GitHub (needed for the dashboard/auto-deploy paths)
```bash
cd pawtrace
git init
git add -A
git commit -m "PawTrace app"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/pawtrace.git
git branch -M main
git push -u origin main
```
`.env` is gitignored, so your keys won't be committed — set them in the host dashboard instead.

---

## Final step — point auth at your live URL
Once you know your deployed URL (e.g. `https://pawtrace.vercel.app`):

1. **Supabase → Authentication → URL Configuration**
   - **Site URL**: `https://pawtrace.vercel.app`
   - **Redirect URLs**: add `https://pawtrace.vercel.app` (keep `http://localhost:5173` too for local dev)
2. **Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs**
   - Keep the Supabase callback `https://<your-ref>.supabase.co/auth/v1/callback` (unchanged).
   - (No need to add the Vercel URL here — Google redirects to Supabase, which redirects back to your Site URL.)

That's it — open your live URL, sign in with Google, and the app is fully online.
```bash
npm run build   # sanity-check the production build locally any time
```
