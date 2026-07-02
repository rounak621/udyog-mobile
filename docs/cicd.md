# Udyog / BillMitra — CI/CD Documentation

Complete reference for the staging → production deployment pipeline across both the backend and frontend repos.

---

## 1. High-Level Flow

```
Push to `dev` branch
    → Auto-deploy to STAGING (backend port 8001, frontend /var/www/staging)
    → Health check staging

Push to `main` branch
    → (Backend only) Re-run staging health check as a gate
    → If staging healthy → Auto-deploy to PRODUCTION
    → If staging unhealthy → Pipeline FAILS, production is NOT touched
```

Both `billmitra-backend` and `billmitra-frontend` repos have their own GitHub Actions workflow file, both named `deploy.yml`, both triggered on push to `dev` or `main`.

---

## 2. Infrastructure Map

| Component | Domain | Port | Path / Container |
|---|---|---|---|
| Production frontend | `app.udyogbook.in` | 443 (nginx) | `/var/www/frontend` |
| Production backend | `api.udyogbook.in` | 443 (nginx) → 8000 | container `udyog-backend`, repo `~/billmitra-backend` |
| Staging frontend | `staging.udyogbook.in` | 443 (nginx) | `/var/www/staging` |
| Staging backend | `staging-api.udyogbook.in` | 443 (nginx) → 8001 | container `udyog-backend-staging`, repo `~/billmitra-backend-staging` |
| Admin panel | `admin.udyogbook.in` | PM2 | `udyog-admin` |
| Landing page | `udyogbook.in` | Vercel | separate repo, not part of this pipeline |

**EC2 server:** `ubuntu@3.111.202.127` (confirm current IP before connecting — has changed before; older docs may reference `13.127.101.184`). SSH key: confirm with Rounak which `.pem` file is currently valid (`udyog-key.pem` vs `udyog-new-key.pem` — has varied across sessions).

**Databases (confirmed June 2026):**
- **Production** uses **AWS RDS PostgreSQL** (`udyog-prod.c7smismgi9rk.ap-south-1.rds.amazonaws.com`, db `udyog_prod`). Connection string in `~/billmitra-backend/.env.production` on EC2.
- **Staging** uses **Neon PostgreSQL** (serverless), a separate database from production. Connection string in `~/billmitra-backend-staging/.env.production` AND `.env.staging` (both files, same value).
- These are genuinely two different databases — staging and production data are NOT shared. Earlier internal confusion about "Neon vs RDS" is resolved: this split is intentional, not a misconfiguration.

---

## 3. Backend Pipeline (`~/billmitra-backend/.github/workflows/deploy.yml`)

### Trigger: push to `dev`
Runs a single job, step "Deploy to Staging (dev branch)":
```bash
cd ~/billmitra-backend-staging
sudo chown -R ubuntu:ubuntu ~/billmitra-backend-staging/storage/ || true
git fetch origin && git reset --hard origin/dev
docker rm -f udyog-backend-staging 2>/dev/null || true
docker build -t udyog-staging-api .
docker run -d \
  --name udyog-backend-staging \
  --restart unless-stopped \
  -p 8001:8000 \
  --env-file .env.staging \
  -v $(pwd)/storage:/app/storage \
  udyog-staging-api
sleep 15
docker exec udyog-backend-staging rm -rf /app/storage/pdfs/ 2>/dev/null || true
curl -sf https://staging-api.udyogbook.in/health && echo "Staging healthy!"
```
This **hard-resets** `~/billmitra-backend-staging` to match `origin/dev` exactly (any uncommitted local changes in that directory are destroyed — never make manual edits there expecting them to survive).

### Trigger: push to `main`
Two sequential steps:

**Step A — "Run Tests Against Staging" (the gate):**
```bash
cd ~/billmitra-backend-staging
# writes a small Python script that GETs https://staging-api.udyogbook.in/health
# exits 1 (fails the whole job) if staging doesn't return 200
```
If staging is down or unhealthy, **this step fails and production deploy never runs.** This is by design — production should never deploy on top of a known-broken staging state. (This is exactly what happened for an extended period — see Section 6, Incident Log.)

**Step B — "Deploy to Production" (only runs if Step A passed):**
```bash
cd ~/billmitra-backend
git fetch origin && git reset --hard origin/main
docker-compose down --remove-orphans
docker system prune -f || true
docker-compose up -d --build api
sleep 15
docker exec udyog-backend alembic upgrade head || true
curl -sf https://api.udyogbook.in/health && echo "Production healthy!"
```
Note: `alembic upgrade head || true` — migration failures do NOT fail the deploy step. If you push a migration, verify it applied by checking manually afterward; don't assume success from a green pipeline run alone.

---

## 4. Frontend Pipeline (`~/billmitra-frontend/.github/workflows/deploy.yml`)

Single workflow, runs on both `dev` and `main` pushes, steps differ by branch via `if: github.ref == ...` conditions.

**Common steps (both branches):** checkout → setup Node 18 → `npm install` (after deleting `package-lock.json` first — intentional, avoids lockfile drift issues) → `npx tsc --noEmit` (type check; **build fails if this fails**) → build.

**`dev` branch build env:**
```
VITE_API_BASE_URL=https://staging-api.udyogbook.in/api/v1
VITE_CLERK_PUBLISHABLE_KEY=<secret>
VITE_RAZORPAY_KEY_ID=<secret>
```
Build command: `npm run build -- --mode staging`

**`main` branch build env:**
```
VITE_API_BASE_URL=https://api.udyogbook.in/api/v1
VITE_CLERK_PUBLISHABLE_KEY=<secret>
VITE_RAZORPAY_KEY_ID=<secret>
```
Build command: `npm run build`

**Deploy (both branches):** SCPs `dist/*` to a temp folder on EC2 (`~/staging-deploy` or `~/prod-deploy`), then a separate SSH step moves it into the real web root (`/var/www/staging` or `/var/www/frontend`), `chown www-data:www-data`, deletes the temp folder, curls the live URL to confirm.

**Note:** the frontend pipeline has no staging-health-check gate before deploying to production — unlike the backend, a `main` push always deploys to production frontend regardless of staging frontend's state. Only the backend pipeline has the staging-gate safety mechanism.

---

## 5. Required Local Files (NOT in git, must exist on EC2 manually)

These are excluded by `.gitignore` and must be manually present on the server. If the EC2 instance is ever rebuilt/migrated, **all of these must be manually recreated** or the pipeline will fail exactly as it did in the June 2026 incident (see Section 6).

| File | Location | Purpose |
|---|---|---|
| `.env.production` | `~/billmitra-backend/` | Real secrets for production container (RDS DB, live Clerk/Razorpay keys) |
| `.env.production` | `~/billmitra-backend-staging/` | Secrets for staging, despite the filename (legacy naming — historically copied from prod template) |
| `.env.staging` | `~/billmitra-backend-staging/` | **Required by the GitHub Actions `--env-file` flag.** Must exist or the staging container fails to start with `docker: --env-file: open .env.staging: no such file or directory`. Currently an exact copy of `.env.production` in the same directory (both point to the same Neon staging DB). |
| `.env` | `~/billmitra-frontend/` | Local dev frontend env — also used as a manual reference; actual deploy values come from GitHub Secrets, not this file. **Known issue:** Antigravity has repeatedly reset the Clerk key in this file back to `pk_test_`. Always `grep CLERK ~/billmitra-frontend/.env` and confirm `pk_live_` before any manual production build. |

---

## 6. Incident Log — Staging Backend Outage (resolved June 21, 2026)

**Symptom:** Staging frontend showed a crash / redirect-to-onboarding loop. Investigation revealed `udyog-backend-staging` container was not running.

**Root cause:** `.env.staging` did not exist in `~/billmitra-backend-staging/`. This caused every pipeline run (`dev` and `main`, going back at least to mid-June) to fail at the `docker run --env-file .env.staging ...` step with:
```
docker: --env-file: open .env.staging: no such file or directory
```
This silently blocked **every subsequent production deploy via the pipeline** too, since the `main`-branch workflow gates on a staging health check that was always failing (502). Confirmed via GitHub Actions history: every run for several weeks showed a red ❌.

**Important implication:** any commits pushed to `main` during this window were NOT actually deployed to production via the pipeline. Manual SSH deploys (`git pull && docker-compose up -d --build api` run directly, bypassing the pipeline) were the only way changes reached production during this period. Always verify production state directly (`docker logs`, direct DB queries) rather than assuming a `main` push = production is updated, for any change made during this window.

**Fix applied:**
```bash
cp ~/billmitra-backend-staging/.env.production ~/billmitra-backend-staging/.env.staging
```
Then manually ran the pipeline's deploy script once to confirm: staging container builds, starts, and health-checks successfully. Confirmed: `{"status":"ok","service":"udyog-backend"}`.

**Status:** Resolved. Both `dev` and `main` push pipelines are now expected to work end-to-end, including the previously-blocked staging-gate → production-deploy flow.

**Lingering risk:** `.env.staging` is a manually-created file, not tracked in git. If this EC2 instance is ever rebuilt, re-provisioned, or this directory is ever wiped, this exact failure will recur silently (the pipeline will fail with the same error) until someone notices and recreates the file.

---

## Incident Log — GST Rate Missing on Maya Text Chat Drafts (resolved July 2, 2026)

**Symptom:** Maya's `/ai/maya-chat` text endpoint returned `tax_rate: 0.0` on catalog items that have a real GST rate set (e.g. 18%), even though the same item correctly showed the right rate via the voice endpoint (`/ai/maya-command`).

**Root cause:** `items_context` construction in `ai_billing.py`'s `maya_chat_endpoint` omitted the `gst_rate` field when building context sent to the Gemini prompt — `ai_voice.py`'s equivalent function included it correctly. Because the field was missing, Maya had no GST info to work with and defaulted to 0.

**Fix applied:** Added `"gst_rate": float(getattr(item, 'gst_rate', 0.0))` to the `items_context` dict in `ai_billing.py`, matching the working pattern in `ai_voice.py`.

**Important lesson:** An earlier attempt at this same fix was reported as "done" with a diff and a live test result, but was never actually committed to git — `git log` showed no matching commit. Always verify a fix exists in `git log --oneline` before trusting a "done" report, even with a shown diff.

**Status:** Fixed, committed (`66652ee`), verified live on both staging and production via direct `/ai/maya-chat` API calls.

---

## 7. Manual Deploy Commands (bypass pipeline — use with caution)

**Backend — staging, manual:**
```bash
cd ~/billmitra-backend-staging
sudo chown -R ubuntu:ubuntu ~/billmitra-backend-staging/storage/ || true
git fetch origin && git reset --hard origin/dev
docker rm -f udyog-backend-staging 2>/dev/null || true
docker build -t udyog-staging-api .
docker run -d --name udyog-backend-staging --restart unless-stopped -p 8001:8000 --env-file .env.staging -v $(pwd)/storage:/app/storage udyog-staging-api
sleep 15
curl -sf https://staging-api.udyogbook.in/health
```

**Backend — production, manual (requires explicit approval before running):**
```bash
cd ~/billmitra-backend
git pull origin main
docker-compose down
docker-compose up -d --build api
docker exec udyog-backend alembic upgrade head
```

**Frontend — staging, manual:**
```bash
cd ~/billmitra-frontend
git checkout dev && git pull origin dev
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build -- --mode staging
sudo mkdir -p /var/www/staging
sudo cp -r dist/* /var/www/staging/
```

**Frontend — production, manual (requires explicit approval before running):**
```bash
cd ~/billmitra-frontend
git checkout main && git pull origin main
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build
sudo chown -R ubuntu:ubuntu /var/www/frontend/
sudo cp -r dist/* /var/www/frontend/
```

**Critical:** never run the production-targeting build command (`npm run build`, no `--mode staging`) when you mean to deploy to staging, and never copy a staging build into `/var/www/frontend/`. These two are easy to confuse and have caused real incidents before.

---

## 8. Verifying a Deploy Actually Happened

Do not trust a green pipeline run alone for critical changes (e.g. database migrations, schema changes). Verify directly:

```bash
# Confirm running container's code matches expected commit
cd ~/billmitra-backend && git log --oneline -1          # for production
cd ~/billmitra-backend-staging && git log --oneline -1  # for staging

# Confirm container is healthy and serving
curl -sf https://api.udyogbook.in/health
curl -sf https://staging-api.udyogbook.in/health

# For DB changes specifically — query the actual table/column directly inside the container
docker exec udyog-backend python3 -c "from sqlalchemy import inspect; from app.db.session import engine; print(inspect(engine).get_table_names())"
```

---

## 9. Key Lessons (do not relearn the hard way)

1. **A coding assistant running `git commit`/`push`/migrations on its own machine may not be touching the same database or repo state as production.** Always verify with a direct command on EC2, in the same session, against the real container — never trust a self-reported "success" for anything touching shared/production data.
2. **`.env.staging` is not in git.** If staging ever breaks with `--env-file` errors again, this is the first thing to check.
3. **Staging and production use genuinely different databases** (Neon vs RDS). This is intentional. Don't "fix" this by trying to unify them.
4. **The backend pipeline's staging health-check gate on `main` pushes is a safety feature, not a bug** — if it's failing, fix staging, don't bypass the gate.
5. **`docker-compose.yml` files can drift or get overwritten between sessions** — always `cat` and review before running, especially in the staging directory, to confirm container names/ports haven't been accidentally set to collide with production.