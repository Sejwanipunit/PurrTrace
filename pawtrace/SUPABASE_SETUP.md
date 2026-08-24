# PawTrace — going live with Supabase + Google sign-in

PawTrace runs in **demo mode** out of the box (in-memory mock data, auto signed-in as a
demo user) so you can develop without a backend. To turn it into a **real multi-user app**
with Google login, a Postgres database, and photo storage, do the four steps below.

It takes ~10 minutes and uses only free tiers.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> → **Start your project** → sign in.
2. **New project** → pick a name (e.g. `pawtrace`), a database password, and a region near you.
3. Wait ~2 min for it to provision.

## 2. Create the database schema

1. In the project, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy its entire contents, paste, and click **Run**.
   - This creates the `profiles`, `pets`, and `sightings` tables, row-level-security policies,
     the `pet-photos` storage bucket, the signup trigger, and a few demo pets.
   - It's safe to re-run.

## 3. Enable Google sign-in

You need Google OAuth credentials, then paste them into Supabase.

**In Google Cloud Console** (<https://console.cloud.google.com>):
1. Create (or pick) a project → **APIs & Services → OAuth consent screen** → configure
   (External, add your email as a test user).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
3. Under **Authorized redirect URIs**, add the callback URL from Supabase:
   - In Supabase: **Authentication → Providers → Google** — copy the **Callback URL** shown there
     (looks like `https://<your-ref>.supabase.co/auth/v1/callback`).
4. Copy the generated **Client ID** and **Client secret**.

**In Supabase:**
1. **Authentication → Providers → Google** → toggle **Enable**.
2. Paste the **Client ID** and **Client secret** → **Save**.
3. **Authentication → URL Configuration** → set **Site URL** to your app URL
   (`http://localhost:5173` for local dev; your real domain in production) and add it to
   **Redirect URLs**.

## 4. Point the app at your project

1. In **Supabase → Project Settings → API**, copy the **Project URL** and the **anon / public** key.
2. In this repo, copy `.env.example` to `.env` and fill them in:

   ```bash
   cp .env.example .env
   ```

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

3. Restart the dev server (`npm run dev`). The app now shows the **Login** screen and requires
   Google sign-in. Reports, sightings, photos, and reunited counts persist in Supabase.

---

## How it works

- **`src/lib/supabase.ts`** — creates the client and exposes `isSupabaseConfigured`. When the env
  vars are absent, the whole app transparently falls back to the mock data layer.
- **`src/context/AuthContext.tsx`** — Google OAuth, session handling, and loading the user's profile.
- **`src/data/petsService.ts`** — every function (`listPets`, `getPet`, `addPet`, `addSighting`,
  `markReunited`, `uploadPhoto`) talks to Supabase when configured, mock data otherwise. The screens
  never changed — they call the same service.
- **Security** — Row Level Security makes reads public (it's a community board) but restricts writes
  to authenticated users, and edits/deletes to the owner of each report.

## Deploying

Any static host works (Vercel, Netlify, Cloudflare Pages):

```bash
npm run build      # outputs dist/
```

Set the two `VITE_SUPABASE_*` env vars in your host's dashboard, and add your production domain to
Supabase **Authentication → URL Configuration** (Site URL + Redirect URLs) and to the Google OAuth
**Authorized redirect URIs**.

---

## Upgrading an existing (live) project to v2

If your database was created from the original `schema.sql`, run
[`supabase/upgrade-v2.sql`](supabase/upgrade-v2.sql) once in the SQL editor. It adds the
`push_subscriptions` table and **fixes a security bug** in `increment_reunited` (any signed-in
user could inflate anyone's reunited counter). New projects can just run `schema.sql`.

---

## Web Push (notifications while the app is closed)

In-app realtime alerts only work while a tab is open. Web Push delivers "new sighting of your
pet" and "found pet nearby" notifications even when the app is closed. It's optional — without
these steps the app keeps using in-app notifications only.

### 1. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

- Put the **public key** in your `.env` (and your host's env vars) as `VITE_VAPID_PUBLIC_KEY`.
- Keep the **private key** for step 3.

### 2. Create the table

Included in `schema.sql` / `upgrade-v2.sql` (the `push_subscriptions` table).

### 3. Deploy the Edge Function

```bash
supabase functions deploy push-notify --no-verify-jwt
supabase secrets set \
  VAPID_PUBLIC_KEY=<public key> \
  VAPID_PRIVATE_KEY=<private key> \
  PUSH_WEBHOOK_SECRET=<any long random string>
```

(`--no-verify-jwt` because the caller is a database webhook, not a signed-in user; the function
checks `PUSH_WEBHOOK_SECRET` instead.)

### 4. Create the database webhooks

Dashboard → **Database → Webhooks → Create a new hook**, twice:

| Name             | Table       | Events | Type          | URL                                              |
|------------------|-------------|--------|---------------|--------------------------------------------------|
| `push-pets`      | `pets`      | Insert | Supabase Edge Function | `push-notify`                           |
| `push-sightings` | `sightings` | Insert | Supabase Edge Function | `push-notify`                           |

On both hooks add an HTTP header: `x-push-secret` = the `PUSH_WEBHOOK_SECRET` you set above.

### 5. Rebuild & deploy the app

`npm run build` — the service worker now includes the push handlers (`public/push-sw.js`).
Devices subscribe automatically after sign-in once notification permission is granted; the
**Nearby alerts** toggle in Profile unsubscribes/resubscribes the device.

### How it fits together

- `src/lib/push.ts` — subscribes the device and stores the subscription in `push_subscriptions`.
- `public/push-sw.js` — service-worker handlers that display the notification and open the app.
- `supabase/functions/push-notify` — sends the pushes, triggered by the webhooks:
  - `sightings` INSERT → notifies the pet's owner (unless they reported it themselves).
  - `pets` INSERT with status `found` → notifies owners of active lost pets within 3 km.
- While a tab is open with push active, in-app duplicate notifications are suppressed.

---

## AI features (Claude vision) — photo auto-tagging & match suggestions

PawTrace uses **Claude** (via a secure Supabase Edge Function, `pet-ai`) for two features:

- **Photo auto-tagging** — in the report flow, "✨ Detect details with AI" reads the uploaded
  photo and fills species / breed / colour / markings / a draft description.
- **AI possible matches** — on an active pet's page, "Find possible matches" compares its photo
  against nearby opposite-status pets of the same species and ranks likely matches with a
  confidence score + reasoning.

The Anthropic API key lives only in the Edge Function (never in the client), and the function
requires a signed-in Supabase user, so the key can't be abused anonymously. Without a key the app
still runs — the client falls back to a demo stub.

### Setup

1. Get an Anthropic API key from <https://console.anthropic.com> → **API Keys**.
2. Deploy the function and set the key:

   ```bash
   supabase functions deploy pet-ai --no-verify-jwt
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```

3. (Optional) Pick a cheaper model — the function defaults to `claude-opus-5`:

   ```bash
   supabase secrets set AI_MODEL=claude-haiku-4-5
   ```

No frontend env var is needed — the client calls the function through the signed-in session.

### How it fits together

- `src/lib/petAI.ts` — client helpers (`describePetPhoto`, `findPossibleMatches`) that invoke the
  Edge Function; demo stubs when Supabase isn't configured.
- `supabase/functions/pet-ai/index.ts` — verifies the caller's Supabase session, then calls the
  Claude Messages API with the image(s) and returns structured JSON.
