# Udyog / BillMitra — CI/CD Documentation

Complete reference for the staging → production deployment pipeline across both backend and frontend repos.

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

## 5. Mobile Deployment Model (`udyog-mobile`)

Unlike web applications (which automatically deploy to web roots upon branch push), mobile applications follow a dev-client and app-bundle lifecycle:

* **No Web-Style Live Deploy**: There is no automatic production server deployment for mobile code changes upon git push.
* **Dev Client Iteration (`expo start --dev-client`)**: Pure JavaScript changes (UI updates, API integration, hooks, styling) are tested dynamically by reloading the JS bundle against an already-installed EAS development build APK on a physical Android device or emulator.
* **Native Build Requirement (`eas build`)**: Any modification to native manifests (`app.json`), permission configurations (microphones, storage), Expo plugins, or installation of native C++/Java dependencies requires building a new native development build (`eas build --platform android`).
* **Branch Isolation Status**: Mobile development during this session was conducted exclusively on branch `fix/maya-text-endpoint`. Release/main-branch merges and production app bundle builds have NOT yet occurred for this feature set.

---

## 6. Required Local Files (NOT in git, must exist on EC2 manually)

These are excluded by `.gitignore` and must be manually present on the server. If the EC2 instance is ever rebuilt/migrated, **all of these must be manually recreated** or the pipeline will fail.

| File | Location | Purpose |
|---|---|---|
| `.env.production` | `~/billmitra-backend/` | Real secrets for production container (RDS DB, live Clerk/Razorpay keys) |
| `.env.production` | `~/billmitra-backend-staging/` | Secrets for staging, despite the filename (legacy naming — historically copied from prod template) |
| `.env.staging` | `~/billmitra-backend-staging/` | **Required by the GitHub Actions `--env-file` flag.** Must exist or the staging container fails to start with `docker: --env-file: open .env.staging: no such file or directory`. Currently an exact copy of `.env.production` in the same directory (both point to the same Neon staging DB). |
| `.env` | `~/billmitra-frontend/` | Local dev frontend env — also used as a manual reference; actual deploy values come from GitHub Secrets, not this file. |

---

## 7. Incident Log & Case Studies

### Staging Backend Outage (resolved June 21, 2026)
* **Symptom:** Staging frontend showed a crash / redirect-to-onboarding loop. `udyog-backend-staging` container was stopped.
* **Root Cause:** `.env.staging` did not exist in `~/billmitra-backend-staging/`. Pipelines failed at `docker run --env-file .env.staging`.
* **Fix Applied:** `cp ~/billmitra-backend-staging/.env.production ~/billmitra-backend-staging/.env.staging`.

### GST Rate Missing on Maya Text Chat Drafts (resolved July 2, 2026)
* **Symptom:** `/ai/maya-chat` returned `tax_rate: 0.0` on catalog items.
* **Root Cause:** `items_context` construction in `ai_billing.py` omitted `gst_rate`.
* **Fix Applied:** Added `"gst_rate": float(getattr(item, 'gst_rate', 0.0))` to `items_context` dict.

### Case Study A — Missing Python Imports Crash-Loop (July 2026 Production Incident)
* **Symptom:** Production backend container (`udyog-backend`) entered a rapid crash-loop after merging `dev` → `main`. API returned 502 Bad Gateway across all endpoints.
* **Root Cause:** Unverified Python imports were introduced in backend AI modules:
  1. `schemas/ai.py` referenced `BaseModel` without importing it (`from pydantic import BaseModel` was missing).
  2. `ai_billing.py` referenced FastAPI dependency objects (`APIRouter`, `UploadFile`, `File`, `Depends`, `Query`, `Form`, `HTTPException`) without importing them from `fastapi`.
* **Underlying Failure Mode:** Code was written and committed directly to `dev` and merged to `main` without ever being executed locally or checked with an interpreter (`python -m py_compile` / `pytest`).
* **Prevention Rule:** NEVER push backend code to `dev` or `main` without running local linting/compilation checks (`python3 -c "import app.main"` or `python -m py_compile <file>`).

### Case Study B — Direct-on-Server Git Commit Incident (July 2026 Operational Incident)
* **Symptom:** Unintended commits and file edits were created directly on the production EC2 host working tree instead of the local development environment.
* **Root Cause:** A terminal command executed `cd /Users/rounak/Projects/BillMitra/billmitra-backend` while the active shell was inside an SSH session on the EC2 server (`ubuntu@3.111.202.127`). Because `/Users/rounak/...` is a macOS path, the `cd` failed silently on Linux. The terminal remained connected to the production server. Subsequent git commands (`git commit`, `git push`) were mistakenly executed directly on production.
* **Prevention Rule & Exact Lesson:** Always verify terminal working directory (`pwd`) and prompt host context (`ubuntu@...` vs `macbook...`) before issuing git commit/push commands, especially after executing any `cd` command that could fail silently in cross-platform environments.

---

## 8. Operational Rules & Host Safeguards

### Docker Container Name Conflicts ("Conflict. The container name already in use")
* **Symptom:** Deploy script outputs `Error response from daemon: Conflict. The container name "/udyog-backend" is already in use by container "<hash>"`.
* **Diagnostic Finding:** Confirmed as a harmless timing quirk between `docker-compose down` (or `docker stop`) and `docker-compose up -d --build`. The Docker daemon occasionally retains the container name registration for 2-5 seconds while cleaning up networks/volumes after the container stops.
* **Verification Steps:**
  1. Run `docker ps -a | grep udyog-backend` to verify current container state.
  2. Inspect container age, status (`Up X seconds (healthy)`), and mapped ports.
  3. If the container is running and healthy, the error was transient and no action is required. If the container exited, re-run `docker-compose down && docker-compose up -d --build api`.

### EC2 Out-Of-Memory (OOM) Build Safeguard
* **Symptom:** Running `npm run build` for the frontend on the production EC2 host fails abruptly with `Killed` and exit code 137, without printing any error stack trace.
* **Root Cause:** The production EC2 `t2.micro` instance has 1GB total RAM. When the backend container (`udyog-backend`) is running alongside active system services, Next.js / Vite build memory allocation exceeds available RAM + swap space, triggering the Linux kernel OOM Killer to terminate Node.js.
* **Standard Fix Protocol**:
  ```bash
  # Step 1: Temporarily stop backend to free ~400MB RAM
  docker stop udyog-backend

  # Step 2: Run frontend build
  cd ~/billmitra-frontend && npm run build

  # Step 3: Immediately restart backend container
  docker start udyog-backend
  ```

### Production Git Branch Discipline & Deployment Protocol
To prevent drift, unauthorized server commits, and deployment failures, all production deployments must follow this strict sequence:
1. **Feature Branch**: Work exclusively on dedicated feature branches (e.g. `fix/maya-text-endpoint`).
2. **Dev Merge**: Merge feature branch into `dev` for staging verification.
3. **Main Merge**: Merge `dev` into `main` after staging health check succeeds.
4. **Pre-Deploy Rollback Tag**: Create a local git tag on production before pulling:
   ```bash
   git tag -a prod-backup-$(date +%Y%m%d-%H%M) -m "Rollback tag before deploy"
   ```
5. **Drift Verification**: Check for uncommitted local changes on the production server before pulling:
   ```bash
   git status
   ```
   *Note: Stray uncommitted edits occurred at least twice during this session due to direct server testing. Run `git checkout .` or `git stash` to clean production working tree before pulling.*
6. **Pull & Hash Verification**: Pull changes on production and verify the target commit hash matches:
   ```bash
   git pull origin main
   git rev-parse HEAD  # Must match local 'main' HEAD hash exactly
   ```

---

## 9. Manual Deploy Commands (bypass pipeline — use with caution)

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

**Critical:** never run the production-targeting build command (`npm run build`, no `--mode staging`) when you mean to deploy to staging, and never copy a staging build into `/var/www/frontend/`.

---

## 10. Verifying a Deploy Actually Happened

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

## 11. Key Lessons (do not relearn the hard way)

1. **A coding assistant running `git commit`/`push`/migrations on its own machine may not be touching the same database or repo state as production.** Always verify with a direct command on EC2, in the same session, against the real container — never trust a self-reported "success" for anything touching shared/production data.
2. **`.env.staging` is not in git.** If staging ever breaks with `--env-file` errors again, this is the first thing to check.
3. **Staging and production use genuinely different databases** (Neon vs RDS). This is intentional. Don't "fix" this by trying to unify them.
4. **The backend pipeline's staging health-check gate on `main` pushes is a safety feature, not a bug** — if it's failing, fix staging, don't bypass the gate.
5. **Always verify python compilation (`py_compile`) locally** before committing backend code to prevent production container crash-loops.
6. **Always verify terminal host prompt (`ubuntu@...`) and `pwd`** before running `git commit`/`push` commands to prevent accidental direct-on-server commits.