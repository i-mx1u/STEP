# Saudi STEP Exam Practice App — Deployment Guide

## Overview
This guide explains how to deploy the STEP practice app on **Render** (backend) and **Vercel** (frontend). The app works fully without Supabase—Sync is optional via localStorage fallback.

---

## 1. Backend Deployment (Render)

### Steps:
1. **Create a new Web Service** on Render, pointing at this repo.
2. **Set the root directory** to `.` (repo root).
3. **Build Command**: `npm install && npm run build -w server`
4. **Start Command**: `npm start`
5. **NODE Version**: `24` (matches `.node-version`: `24`)
6. **Health Check Path**: `/api/health`
7. **Plan**: `free`

### Environment Variables on Render (Settings → Environment):
| Variable | Value | sync |
|---|---|---|
| `NODE_VERSION` | `24` | false |
| `NODE_ENV` | `production` | false |
| `JWT_SECRET` | *(generated)* | false |
| `JWT_EXPIRES_IN` | `30d` | false |
| `CORS_ORIGIN` | *(your Vercel URL, e.g. `https://stepwise.vercel.app`)* | false |
| `DATABASE_PROVIDER` | `sqlite` | false |
| `SUPABASE_URL` | *(leave empty for localStorage fallback)* | false |
| `SUPABASE_SERVICE_ROLE_KEY` | *(leave empty for localStorage fallback)* | false |
| `SERVE_STATIC` | `true` | false |
| `TRUST_PROXY` | `true` | false |

### Important Notes:
- The question bank (`server/data/step-bank.json`) is already generated and committed. No `npm run parse` step is needed on Render.
- The server listens on `process.env.PORT` with a fallback of `4000`.
- CORS automatically allows `localhost` origins in development. In production, set `CORS_ORIGIN` to your Vercel URL.
- The `/api/health` endpoint returns `{ ok: true }`—Render uses this for health checks.

---

## 2. Frontend Deployment (Vercel)

### Steps:
1. **Create a new Project** on Vercel, importing this repo.
2. **Framework Preset**: Vite (or "Other" if not auto-detected).
3. **Root Directory**: `.` (repo root).
4. **Build Command**: `npm run build -w client`
5. **Output Directory**: `client/dist`
6. **Root Redirects Rewrites**: Keep the default SPA rewrite:
   ```json
   {
     "source": "/(.*)",
     "destination": "/index.html"
   }
   ```

### Environment Variables on Vercel (Project Settings → Environment Variables):
| Variable | Value | Example |
|---|---|---|
| `VITE_API_URL` | *Your Render API URL* | `https://stepwise-api.onrender.com` |

### Important Notes:
- The client reads `import.meta.env.VITE_API_URL` with a fallback to `http://localhost:3001` (dev proxy) or no fallback (production).
- **Do not** leave `VITE_API_URL` empty in production if you want cross-device sync—set it to your Render URL.
- The React app uses `react-router-dom` with SPA mode (`<base href="/">`), so the Vercel rewrite rule above is required.
- All auth/history/bookmarks data is stored in `localStorage` when Supabase is not configured—fully functional without a database.

---

## 3. Supabase Setup (for cross-device sync)

If you want to keep test history, bookmarks, and user accounts across devices, follow these steps:

1. **Create a Supabase project** at https://supabase.com.
2. **Run the schema** in the SQL Editor (Project → SQL):
   ```bash
   psql "postgresql://postpost.POSTGRESSWORD@db.usuravmzcrlwus Supabase PostgreSQL" < server/supabase/schema.sql
   ```
   Or copy the SQL from `server/supabase/schema.sql` into the Supabase SQL Editor and run it.
3. **Note the keys**:
   - `SUPABASE_URL`: from Project Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY`: from Project Settings → API (Service role key)
4. **Enable on Render**:
   - Set `DATABASE_PROVIDER=supabase` on Render
   - Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (sync: false)
   - Set `CORS_ORIGIN` to your Vercel URL
5. **Rebuild and redeploy** both Render and Vercel.

### Why Supabase is needed:
- SQLite on Render's free plan is **ephemeral**—the database is wiped on every restart/redeploy. Data would be lost.
- Supabase provides a persistent PostgreSQL database with auth, RLS, and real-time capabilities.
- Without Supabase, all user data (register/login/history/bookmarks) is stored in `localStorage` on the user's device only—fully functional but not synced across devices.

---

## 3. Deployment Order

### Without Supabase (localStorage only):
1. **Deploy the Backend first**: Push to Render, wait for the API to be live.
2. **Get the API URL**: e.g., `https://stepwise-api.onrender.com`.
3. **Deploy the Frontend**: On Vercel, set `VITE_API_URL` to the Render URL from step 2.
4. **Test**: Open the Vercel URL, select a model, start a test, verify questions load and timers work.
5. **Result**: All data (register/login/history/bookmarks) is stored in `localStorage` per device.

### With Supabase (cross-device sync):
1. Follow the "Supabase Setup" steps above to create the project and run the schema.
2. Deploy the Backend to Render with `DATABASE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` set.
3. Deploy the Frontend to Vercel, set `VITE_API_URL` to the Render URL.
4. **Test**: Open the Vercel URL, register/login, start a test, verify history and bookmarks sync across devices.
5. **Result**: Data persists across restarts and is accessible from any device.

---

## 3. Local Verification (before deploying)

```bash
# From the repo root
npm install          # install all workspaces
npm run build        # build client + server
npm start            # start server on http://localhost:4000

# Test with curl:
curl http://localhost:4000/api/health
# Expected: {"ok":true,...}

curl http://localhost:4000/api/catalog
# Expected: catalog with 47 models, 2986 playable questions, etc.
```

---

## 4. Files Overview (do not delete)

| Folder | Purpose |
|---|---|
| `server/` | Node/Express API (entry: `server/index.ts`) |
| `client/` | React + Vite SPA (entry: `client/src/main.tsx`) |
| `server/data/step-bank.json` | Pre-parsed question bank (47 models) |
| `server/supabase/schema.sql` | Supabase SQL schema (run once in SQL Editor) |
| `vercel.json` | Vercel rewrite/spa config |
| `render.yaml` | Render blueprint (server service) |
| `package.json` | Root workspaces: `["client", "server"]` |
| `.env.example` | Variables for server and client |
| `.gitignore` | Excludes `node_modules`, `dist`, `.env`, etc. |

---

## 5. Quick Checklist

- [ ] Render deployed, API responding on `/api/health`
- [ ] `CORS_ORIGIN` set on Render (or left empty for dev auto-allow)
- [ ] `VITE_API_URL` set on Vercel to Render URL
- [ ] Vercel SPA rewrite in place
- [ ] Test: open Vercel URL, select Model 5, start a Reading test, timer runs, questions navigate
- [ ] (Optional) Enable Supabase: run schema, set env vars on Render, redeploy
- [ ] (Optional) If using Supabase: verify cross-device sync works (register/login on one device, view history/bookmarks on another)