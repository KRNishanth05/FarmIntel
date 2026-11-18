# 🌿 FarmIntel — Multilingual Smart Farming Assistant

🔗 **[Live Demo]( https://krnishanth05.github.io/FarmIntel/)** 

FarmIntel is a web app that helps Indian farmers with:

- 🌱 **Crop Recommendation** — suggests the best crops based on soil (N/P/K), temperature, humidity, pH, and rainfall
- 📊 **Yield Prediction** — estimates expected yield per crop and area
- 🔍 **Plant Disease Detection** — upload a leaf photo and get an AI diagnosis + treatment plan (via Groq vision models)
- 💰 **Market Prices** — current mandi prices with trend chart
- 🤖 **AI Chat Assistant** — ask farming questions and get answers in the same language (English, हिन्दी, ಕನ್ನಡ, தமிழ், తెలుగు, മലയാളം). 🎤 Mic converts speech to text in all 6 languages using Groq Whisper; replies are also spoken aloud
- 🌐 **Multilingual UI** — English, Malayalam, Hindi, Kannada, Tamil, Telugu

The app was originally a single `index.html` file. This repo splits it into a
clean **frontend / backend** structure so the Groq API key is never exposed
in client-side code, and so the project is easy to deploy and maintain on
GitHub.

## Project structure

```
FarmIntel/
├── index.html          # Static site (HTML/CSS/JS) — the UI
├── style.css
├── script.js
├── agricultural_db.js  # Generated crop/soil/district knowledge base
├── assets/             # Crop images & static assets
├── data/               # Dataset JSON artifacts
├── Dataset/            # Source agriculture CSV dataset
├── scripts/            # Dataset builders, dev server & test tooling
├── backend/            # Node/Express API that proxies requests to Groq
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```

## How it works

The frontend never talks to Groq directly. Instead:

1. The UI sends chat/vision requests to your own backend at `POST /groq`
2. The backend attaches your Groq API key (kept server-side) and forwards
   the request to `https://api.groq.com`
3. The backend returns Groq's response back to the UI

The "🔑 Enter your free Groq API key" modal in the app posts the key to
`POST /groq-setkey`, so you can also set the key at runtime instead of (or
in addition to) putting it in the backend's `.env` file.

> This key storage is intentionally simple (single in-memory key on the
> server) to match the original app's design, which is fine for local/personal
> use. If you deploy this for multiple simultaneous users, use a per-session
> or per-user key store instead of a single global key.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 18 or later (needed for built-in `fetch`)
- A free Groq API key from [console.groq.com](https://console.groq.com)

### 1. Backend setup

Commands below are shown for macOS/Linux (bash/zsh). On Windows, use
Command Prompt (`copy` instead of `cp`) or PowerShell — both work.

**macOS / Linux**

```bash
cd backend
npm install
cp .env.example .env
# edit .env and paste your GROQ_API_KEY (or leave it blank and set the
# key from the app's UI later)
npm start
```

**Windows (Command Prompt)**

```bat
cd backend
npm install
copy .env.example .env
rem edit .env and paste your GROQ_API_KEY (or leave it blank and set the
rem key from the app's UI later)
npm start
```

**Windows (PowerShell)**

```powershell
cd backend
npm install
Copy-Item .env.example .env
# edit .env and paste your GROQ_API_KEY (or leave it blank and set the
# key from the app's UI later)
npm start
```

The backend runs on `http://localhost:3000` by default.

### 2. Frontend setup

The frontend is plain static HTML/CSS/JS — no build step required.

**Option A — serve it from the backend (simplest for local use)**

Set `SERVE_FRONTEND=true` in `backend/.env`, restart the backend, then open:

```
http://localhost:3000
```

**Option B — serve it separately**

Use any static file server from the project root, e.g.:

```bash
npx serve .
```

(On Windows you can also double-click `index.html` to open it via `file://` —
the app detects that and still talks to the backend on `http://localhost:3000`.)

Then open the printed URL (e.g. `http://localhost:3000` or `:5000`
depending on the tool). If your backend runs on a different origin, open
`script.js` and set:

```js
const API_BASE_URL = 'https://your-backend-url.com';
```

### 3. Set your Groq API key

If you didn't put `GROQ_API_KEY` in `backend/.env`, open the app in your
browser — a setup modal will prompt you for a free Groq key on first load.

## Deployment

- **Backend**: any Node host works (Render, Railway, Fly.io, a VPS, etc).
  Set the `GROQ_API_KEY` environment variable there instead of committing
  a `.env` file.
- **Frontend**: any static host works (GitHub Pages, Netlify, Vercel).
  Just remember to set `API_BASE_URL` in `frontend/script.js` to your
  deployed backend's URL before publishing.

## Tech stack

- **Frontend**: vanilla HTML/CSS/JavaScript (no framework, no build step),
  Web Speech API for voice input/output, `<canvas>` for the price chart
- **Backend**: Node.js + Express, proxying to the [Groq API](https://console.groq.com/docs/models)
  for chat and vision (leaf-disease) inference

## Chatbot languages & voice

- **Reply language**: native-script questions are answered in that language; questions typed in Latin letters (English or romanized, e.g. "kapas ke liye khad") are answered in the language chosen in the app's language selector. If the model ever drifts back to English, the app automatically translates the reply.
- **🎤 Mic**: tap, speak, and it stops by itself after you pause (or tap ⏹). Audio goes to `POST /transcribe` on the backend → Groq `whisper-large-v3` with the selected language as a hint. Needs the backend running and `localhost`/HTTPS (browsers block the mic on plain http for other hosts).
- Put your key in `backend/.env` (`GROQ_API_KEY=...`). Never put it in `script.js`.

## Notes

- **Windows**: everything runs the same on Windows — install [Node.js](https://nodejs.org) 18+ and Python 3, use `copy` instead of `cp` for `.env`, and use `python` (not `python3`) for the dataset scripts in `scripts/`. The dev/test tooling auto-detects Chrome, Chromium or Edge in standard Windows install locations; set the `CHROME_PATH` environment variable if your browser lives elsewhere.
- Groq model IDs change periodically — if you get a "model decommissioned"
  error, check [console.groq.com/docs/models](https://console.groq.com/docs/models)
  and update `GROQ_TEXT_MODEL` / `GROQ_VISION_MODEL` in `backend/.env`.
- If no Groq key is set, the chat assistant still works using a lightweight
  built-in fallback responder; crop recommendation, yield prediction, and
  market prices work entirely client-side and don't need the API.

## License

MIT — feel free to use and adapt this project.
