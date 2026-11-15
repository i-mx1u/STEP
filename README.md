# STEPWISE — Saudi STEP Practice Studio

A polished full-stack practice platform for the Saudi **STEP** English proficiency exam.
STEPWISE turns the supplied Model 5–51 question files into structured, playable mock
tests with a timed exam interface, sticky reading passages, bookmarks, detailed review,
history, and cross-device sync.

![stack](https://img.shields.io/badge/React-19-149eca)
![stack](https://img.shields.io/badge/TypeScript-5-3178c6)
![stack](https://img.shields.io/badge/Express-5-000000)
![stack](https://img.shields.io/badge/Supabase-Postgres-3ecf8e)

## Highlights

- **Custom tests** — choose one or many models, Reading / Grammar / Both, question
  counts, and seconds per question.
- **Exam interface** — countdown timer, numbered question map, answered / unanswered /
  bookmarked states, Show Answer, Bookmark, Next Question, Finish Test.
- **Reading-first layout** — the passage stays sticky beside the questions on desktop;
  mobile switches between Passage and Question tabs.
- **Review and history** — score, per-section breakdown, answered-vs-unanswered
  distinction, full review, retake, and delete.
- **Bookmarks** — save individual questions or “save all mistakes” after a test.
- **Guest + account modes** — guests use localStorage; signed-in users sync history and
  bookmarks to the API. Guest data can be imported after registering.
- **Bilingual controls** — English labels with Arabic sublabels throughout.
- **Resilient data pipeline** — build-time parser cleans OCR noise, dedupes repeated
  questions across models, and keeps only answerable questions in scored tests.

## Bank at a glance

| Metric | Value |
| --- | --- |
| Models | 47 (Model 5 → Model 51) |
| Passages | 542 |
| Parsed questions | 3,358 |
| Playable questions | 2,986 (1,446 reading / 1,540 grammar) |
| Image-based passages | 24 |

Questions without a recoverable answer key, fewer than four usable options, or broken
text are kept in the bank for traceability but excluded from generated tests. See
[Data pipeline](#data-pipeline) and [Known limitations](#known-limitations).

## Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, React Router, Lucide icons
- **Backend:** Node.js, Express 5, TypeScript, Zod, JWT, bcrypt
- **Database:** Supabase Postgres (production) or local SQLite via Node's built-in
  `node:sqlite` (zero configuration)
- **Hosting:** Vercel (frontend) + Render (API) + Supabase (database)

## Project structure

```text
STEP/
├── client/                    React + Vite application
│   ├── src/pages/             Dashboard, Practice, Test, Results, History, Bookmarks, Auth
│   ├── src/lib/               API client, localStorage helpers, results sync
│   └── vite.config.ts         /api dev proxy → localhost:4000
├── server/                    Express API
│   ├── data/step-bank.json    Generated question bank (committed)
│   ├── scripts/parse-models.mjs
│   ├── scripts/validate-data.mjs
│   ├── src/bank.ts            Test generation, scoring, bookmark snapshots
│   ├── src/db/                SQLite + Supabase adapters
│   └── supabase/schema.sql    Required Supabase tables
├── html/models_5_to_51_text/  Original source text files (read-only)
├── render.yaml                Render Blueprint for the API
├── vercel.json                Vercel SPA build configuration
└── .node-version              Pins Node 24 for Render / version managers
```

## Local development

### Prerequisites

- Node.js **22.5+** (Node 24 recommended; the SQLite adapter uses `node:sqlite`)
- npm 10+
- No database needed for local development

### Run it

```bash
npm install
npm run parse          # regenerate server/data/step-bank.json from the text files
npm run validate:data  # quality gate for the generated bank
npm run dev
```

- Web app: <http://localhost:5173>
- API: <http://localhost:4000>
- Health: <http://localhost:4000/api/health>

Vite proxies `/api` to the Express server. By default the API stores data in
`server/data/stepwise.db` (SQLite). Copy `.env.example` to `server/.env` only when you
need to override defaults.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start API and Vite dev server together |
| `npm run parse` | Parse Model 5–51 source files into the JSON bank |
| `npm run validate:data` | Validate bank structure, options, keys, and totals |
| `npm run typecheck` | Typecheck server and client |
| `npm run build` | Build the React app and compile the server |
| `npm start` | Run the compiled Express server |
| `npm run dev -w server` | API only |
| `npm run dev -w client` | Frontend only |

### Production build locally

```bash
npm run build
npm start
```

Express serves `client/dist` on <http://localhost:4000> when it exists (controlled by
`SERVE_STATIC`). This is also the simplest single-service deployment mode.

## Environment variables

The server loads `server/.env` and then the repository-root `.env`. Variables already
set in the hosting dashboard take precedence.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API port (Render sets this automatically) |
| `NODE_ENV` | `development` | Use `production` when deployed |
| `JWT_SECRET` | dev fallback | **Set a long random value in production** |
| `JWT_EXPIRES_IN` | `30d` | Login token lifetime |
| `CLIENT_ORIGIN` | localhost URLs | Comma-separated allowed browser origins |
| `DATABASE_PROVIDER` | `sqlite` | `sqlite` or `supabase` |
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service-role key; server-side only |
| `SQLITE_PATH` | `server/data/stepwise.db` | Local SQLite file |
| `STEP_BANK_FILE` | `server/data/step-bank.json` | Bank path override |
| `STEP_SOURCE_DIR` | `html/models_5_to_51_text` | Parser source override |
| `SERVE_STATIC` | `true` | Let Express serve `client/dist` |
| `TRUST_PROXY` | `true` | Express trust proxy (required on Render) |
| `VITE_API_URL` | empty | Frontend API URL; empty means same origin |

If both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present, the server uses
Supabase even when `DATABASE_PROVIDER` is unset.

> **Security:** never expose `SUPABASE_SERVICE_ROLE_KEY` or `JWT_SECRET` in the
> frontend or commit them to the repository. The Supabase tables have RLS enabled with
> no client policies; only the server's service-role key can read or write.

## Data pipeline

The source files live in `html/models_5_to_51_text/`. They are never modified by the
app. The parser (`server/scripts/parse-models.mjs`) handles the formats and OCR quirks
across Model 5–51, then writes `server/data/step-bank.json`.

What the parser does:

1. Splits each model into Reading and Grammar sections and extracts answer-key blocks.
2. Detects numbered (`Passage 5`) and named (`Passage B: CPU and Memory`) passages.
3. Repairs glued question markers, stray option labels, duplicate option letters, and
   option text that swallowed the next passage.
4. Recovers missing keys from duplicate questions across models when the option text
   matches exactly.
5. Invalidates keys that point to options that do not exist, so the bank stays
   internally consistent.
6. Normalizes ids (`m47-r11`, `m47-g22`) and sequential question numbers.

Run `npm run validate:data` after parsing. It fails on malformed option text,
answer keys that point outside the options, duplicate ids, inconsistent totals, or a
playable-count regression below the quality floor. Warnings report missing keys,
image-only passages, and other source limitations.

To parse a different folder:

```bash
STEP_SOURCE_DIR=/path/to/texts STEP_BANK_OUT=/tmp/step-bank.json npm run parse
```

## API overview

All API routes are under `/api`. Authenticated routes expect
`Authorization: Bearer <token>`.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | — | Service, provider, and bank metadata |
| `GET` | `/catalog` | — | Models and available question counts |
| `POST` | `/tests/generate` | — | Generate a custom test |
| `POST` | `/auth/register` | — | Create an account |
| `POST` | `/auth/login` | — | Log in and receive a JWT |
| `GET` | `/auth/me` | ✓ | Current user |
| `GET` | `/history` | ✓ | List completed tests |
| `POST` | `/history` | ✓ | Save a test and recompute its score server-side |
| `GET` | `/history/:id` | ✓ | Full review for one test |
| `DELETE` | `/history/:id` | ✓ | Delete a test |
| `GET` | `/stats` | ✓ | Dashboard totals and recent activity |
| `GET` | `/bookmarks` | ✓ | List bookmarks with question snapshots |
| `POST` | `/bookmarks` | ✓ | Save a question snapshot |
| `DELETE` | `/bookmarks/:questionId` | ✓ | Remove a bookmark |

`POST /tests/generate` accepts `modelIds`, `sections`, `readingCount`, `grammarCount`,
`secondsPerQuestion`, and optional `questionIds` for bookmark practice. Generation
dedupes repeated questions and passages across models and returns `warnings` when the
requested counts exceed what the selected models can supply.

## Deployment

### Option A — Vercel + Render + Supabase (recommended)

This gives the frontend a global CDN, keeps the API separate, and stores user data in
Postgres so history and bookmarks survive redeploys.

#### 1. Create the Supabase database

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run the contents of
   [`server/supabase/schema.sql`](server/supabase/schema.sql).
3. Copy the **Project URL** and the **service_role** key from
   **Project Settings → API**. Keep the service-role key private.

The schema creates `step_users`, `step_test_history`, and `step_bookmarks`, enabled RLS,
and indexes for the history/bookmark queries. There are deliberately no client RLS
policies; the Express server uses the service-role key.

#### 2. Deploy the API to Render

**Blueprint route**

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint**, select the repository, and apply
   [`render.yaml`](render.yaml).
3. Fill the prompted secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLIENT_ORIGIN` — your Vercel URL (you can update this after step 3)
4. Deploy. Confirm `https://<service>.onrender.com/api/health` returns
   `{ "ok": true, ... }` with `"provider": "supabase"`.

**Manual web-service route**

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Root directory | repository root |
| Build command | `npm ci && npm run build -w server` |
| Start command | `npm start` |
| Health check | `/api/health` |

Set these environment variables:

```text
NODE_ENV=production
JWT_SECRET=<long random string>
SERVE_STATIC=false
TRUST_PROXY=true
DATABASE_PROVIDER=supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CLIENT_ORIGIN=https://<your-app>.vercel.app
```

The blueprint pins `NODE_VERSION=24`, and the repository includes a `.node-version`
file, so `node:sqlite` and the build toolchain work even if Render's default is older.

**Single-service alternative:** in the same Render service, use build command
`npm ci && npm run build`, set `SERVE_STATIC=true`, and point `CLIENT_ORIGIN` at the
Render URL. Express then serves both the API and the React build, and Vercel is not
needed. Supabase is still recommended for persistence; the local SQLite file is
ephemeral on most Render plans.

#### 3. Deploy the frontend to Vercel

1. In Vercel, **Add New → Project** and import the same repository.
2. Leave the root directory at the repository root. The committed
   [`vercel.json`](vercel.json) configures:
   - install: `npm install`
   - build: `npm run build -w client`
   - output: `client/dist`
   - SPA rewrites to `index.html`
3. Add an environment variable for Production and Preview:
   - `VITE_API_URL=https://<service>.onrender.com` (no trailing slash)
4. Deploy. Then copy the production domain and set it as `CLIENT_ORIGIN` on Render;
   redeploy/restart the API so CORS picks it up.

If you use Vercel preview deployments, add their origins as a comma-separated list:

```text
CLIENT_ORIGIN=https://stepwise.vercel.app,https://stepwise-git-main-you.vercel.app
```

#### 4. Verify

1. Open the Vercel URL and build a short guest test.
2. Register an account; guest history/bookmarks can be imported from the dashboard.
3. Complete a test on one device, then sign in on another and confirm history and
   bookmarks appear.
4. Check `/api/health` reports the expected bank totals and `provider: "supabase"`.

#### Troubleshooting

- **CORS error:** `CLIENT_ORIGIN` must match the browser origin exactly, including
  `https://` and without a trailing slash. Add both production and preview origins.
- **`Could not reach the STEPWISE API`:** check `VITE_API_URL`, redeploy the frontend
  after changing it, and confirm the Render health endpoint.
- **API restarts with a database error:** verify the schema SQL ran and that the
  service-role key is present. Do not use the anon key.
- **Free Render cold starts:** the first request after idle can take 30–60 seconds.

### Option B — one Render service (no Vercel)

Use this for a quick private deployment:

1. Create a Render Web Service from the repo.
2. Build: `npm ci && npm run parse && npm run build`
3. Start: `npm start`
4. Set `SERVE_STATIC=true`, `NODE_ENV=production`, a strong `JWT_SECRET`, and the
   Supabase variables above.
5. Set `CLIENT_ORIGIN` to the Render URL (and any custom domain).

The app will be available at `https://<service>.onrender.com`.

## Cross-device sync and guest mode

- Signed out: active test, history, bookmarks, and theme are stored in localStorage.
- Signed in: the server recomputes scores and stores history plus bookmark snapshots;
  the client caches results in sessionStorage for fast review.
- On registration, the dashboard offers to import guest history and bookmarks.
- Reading passages are embedded in generated-test and bookmark snapshots, so review
  still works if the bank is regenerated later.

## Design notes

- Reading tests are generated passage-by-passage with repeated passages deduped, so a
  test never shows the same passage twice.
- Grammar questions are deduped by normalized question + option text.
- The server is the source of truth for scoring; client-side answers alone are never
  trusted.
- The timer auto-submits at zero and survives refreshes via the active-test snapshot.
- All persistence adapters implement the same interface, so switching between SQLite
  and Supabase requires no route changes.

## Known limitations

- Some source files are OCR-damaged or shuffle questions/options. The parser repairs
  what it can and marks the rest unplayable; 2,986 questions are currently playable.
- 24 passages are image-only in the source text. The UI shows an “Image-based passage”
  fallback instead of invented text.
- 339 questions are missing a usable answer key (including keys that pointed at missing
  options).
- Repeated questions across models remain in the bank but are deduped per generated
  test.
- The question content belongs to its original authors and is provided here for study
  purposes. STEPWISE is not affiliated with the Saudi authorities or the official STEP
  exam.

## License

Private study project. Add a license before distributing publicly.
