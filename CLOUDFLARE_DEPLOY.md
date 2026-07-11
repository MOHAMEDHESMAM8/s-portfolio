# Deploying to Cloudflare Pages

This site was migrated off Netlify because Netlify's edge IPs are unreachable
from parts of Egypt (traffic drops inside Telecom Egypt / AS8452). Cloudflare's
network terminates inside Egypt, so it avoids the broken international route.

The site is static HTML/assets plus 4 serverless functions. The functions were
ported from Netlify Functions (`netlify/functions/`) to Cloudflare Pages
Functions (`functions/api/`). The `netlify/` folder is kept so the Netlify site
keeps working as a fallback.

## One-time setup

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**, and pick this repository.
2. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
3. Add the environment variables (Settings → Environment variables), the same
   values you had on Netlify:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `GITHUB_TOKEN`  (a fine-grained PAT with Contents: read & write on this repo)
   - `GITHUB_REPO`   (e.g. `owner/repo`)
   - `GITHUB_BRANCH` (optional, defaults to `main`)

   Add them for **Production** (and Preview if you use preview deploys). Mark
   `GITHUB_TOKEN` and `ADMIN_PASSWORD` as **Secret**.
4. Deploy. Your site will be at `https://<project>.pages.dev`.

## Routes

- Static site: `/`, `/index.html`, `/admin.html`, `/fashion/*`, `/data/links.json`
- Functions (Pages Functions map file path → URL):
  - `functions/api/admin-login.js`         → `POST /api/admin-login`
  - `functions/api/list-fashion-images.js` → `GET  /api/list-fashion-images`
  - `functions/api/update-links.js`        → `POST /api/update-links`
  - `functions/api/upload-fashion-image.js`→ `POST /api/upload-fashion-image`

## Local testing (optional)

Cloudflare Functions need the Workers runtime to run. Static-only previews will
404 on `/api/*` — that's expected. To exercise the functions locally:

```
npx wrangler pages dev . \
  --binding ADMIN_USERNAME=... ADMIN_PASSWORD=... \
  --binding GITHUB_TOKEN=... GITHUB_REPO=owner/repo GITHUB_BRANCH=main
```

## Custom domain

Add your domain under the Pages project → **Custom domains**. Cloudflare issues
the SSL cert automatically. Keep Netlify live until Cloudflare is verified
reachable from the target network, then switch DNS.
