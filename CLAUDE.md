# Better Man AI

Personal-coach web app (habits, goals, journal, AI coach, Bible, finances,
learning, "pépites"). Live at https://better-man-ai.vercel.app. The owner is not
a professional developer: explain in plain words, avoid jargon, and say exactly
what to click when something must be done in Vercel, Neon or GitHub.

## Language

- Everything the user sees in the app is **French** (tutoiement: "tu").
  Code comments, README, ROADMAP and commit messages are in French too.
- Answer the owner in the language they write to you in.

## Layout

```
backend/            Node.js + Express API, ES modules ("type": "module")
  index.js          Vercel entry point (must stay at backend/ root, imports express)
  src/app.js        Express app; src/server.js starts it locally
  src/db.js         Data layer: JSON file (lowdb) without DATABASE_URL, PostgreSQL with it
  src/modules/*     One folder per feature, each with its own routes.js
  src/ai/           Text-chat router and providers (Claude, Gemini, Mistral, ...)
  src/config/       Provider lists and model names
  src/shared/       Helpers used by several modules (incl. photo/vision providers)
  public/           COPY of frontend/, rebuilt by `npm run build` — never edit by hand
frontend/           The real front end: plain HTML/CSS/JS, no build tool, no framework
  app.js            Main UI (very large single file) · games.js · speaking.js · sw.js
.github/workflows/  notifications.yml: calls the app every 15 min to send push reminders
```

## Commands (run inside `backend/`)

```bash
npm install
cp .env.example .env     # first time; set JWT_SECRET
npm run dev              # http://localhost:4000, serves ../frontend directly
npm run build            # copies ../frontend into backend/public (what Vercel runs)
```

There is no test suite and no linter. To check a change, start the server and
try it for real: call the route with curl, and for UI changes open the page in
the pre-installed Playwright Chromium and look at a screenshot. Say plainly if
you could not verify something.

## Rules that are easy to break

- **Edit `frontend/`, not `backend/public/`.** `public/` is overwritten at
  build time; anything changed only there is lost.
- **Every data route filters by `userId`.** A user must never read or change
  another user's data. Admin routes return account metadata only, never
  private content (journal, chats, intimacy section).
- **Only use `db.data`, `db.read()`, `db.write()`** from `src/db.js`. New
  collections go in `defaultData` there, so both the JSON and the PostgreSQL
  back ends work. No SQL in the modules.
- **The app must work with zero paid keys.** Every AI, search and vision
  feature goes through a replaceable provider and falls back to an honest
  message ("non configuré") — never invented results, sources or verses.
- **Keep the two strict separations** in generated text: Bible text vs.
  application, and information found online vs. analysis.
- **Model names live in one place each**: `CLAUDE_MODEL` env var /
  `src/ai/providers/claude.js`, and `src/config/geminiModel.js`. Don't
  hard-code a model anywhere else. Before changing a Claude model, API
  parameter or SDK call, load the `claude-api` skill instead of trusting memory.
- **No front-end dependencies or build step.** Charts are hand-made SVG/CSS;
  speech uses the browser's Web Speech API. Keep it that way unless asked.
- **Secrets only in environment variables.** Never commit `.env` or
  `backend/data/`.

## Releases

- User-visible changes get a new entry at the top of the version list in
  `backend/src/modules/meta/routes.js` (the "What's New" screen), with the
  next version number, and the matching line in `README.md`.
- Daily "pépites" additions touch exactly three files:
  `backend/src/modules/pepites/data/pepites.json`, `meta/routes.js`, `README.md`,
  with the commit title `feat: pépites du jour — YYYY-MM-DD`.
- When a phase or feature is finished, tick or add it in `ROADMAP.md`.

## Deployment

- Vercel deploys every merge into `main` automatically. Project settings:
  Root Directory = `backend`, Framework = Express. Vercel ignores `vercel.json`
  rewrites and `api/` in this mode — don't add them.
- Data lives in Neon (PostgreSQL) through `DATABASE_URL`. Without it Vercel
  uses `/tmp`, which is wiped — fine for a demo, not for real use.
- A changed environment variable only applies after a **Redeploy** in Vercel.
- Don't run destructive database operations (drop, delete, reset) without
  asking first; the Neon database holds real user data.

## Skills in this repo

- `3d` (`.claude/skills/3d/`): any 3D model, scene, render or viewer.
- `animate` (`.claude/skills/animate/`): `/animate <idea>` writes the story and prompts for an animated short film.
- `hyperframes` plugin (enabled in `.claude/settings.json`): animated videos from HTML, with voice-over and sound effects. Local French voice needs `pip install kokoro-onnx soundfile`.
