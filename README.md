## AEI Chatbot

A full‑stack chatbot for researching and conversing with AEI scholar content. The backend (Node/Express) exposes chat and file APIs and uses Together AI for responses. The frontend (React) provides a clean UI to chat across different scholar domains. The chatbotretrieves content by scraping AEI.org live for each query, ensuring accurate, up-to-dateinformation with correct publication dates and citations.

### What you can do
- **Chat** with an assistant scoped to a selected domain (scholar/folder) or general mode
- **Get live, accurate answers** pulled directly from AEI.org articles
- **Upload text files** to enrich the knowledge base per domain
- **Create/delete domains** and view domain stats
- **Persist chat history** locally on the server

### Quick Notes
- Accounts for Render (backend), Vercel (frontend), and Together AI (LLM API) have already been made
- Log in using aeitechpolicy github account
- The chatbot is already deployed under aeitechpolicy on https://aei-chatbot.vercel.app/
- The correct flow when starting a new chat: **select a scholar domain first**, then click NewChat, then ask your question — the domain gets locked in at chat creation

### To-dos
- You need to log into Together AI, deposite $5 to access API Key
- Paste that API key into render's enviornmental variable
<img width="700" alt="Screenshot 2025-08-19 at 2 20 50 PM" src="https://github.com/user-attachments/assets/8d839875-7cd5-484b-822e-5a4a93a999c0" />

- Redeploy the backend, and the chatbot should be running 


---

## Architecture
- **Backend**: `backend/` (Node.js + Express)
  - Chat endpoints: `/api/chat/*`
  - File/knowledge base endpoints: `/api/files/*`
  - Live scraping: `/backend/utils/aeiScraper.js` which scrapes AEI.org in real time per query using DuckDuckGo search + scholar profile pages
  - Local storage: `backend/chats/` for chat sessions, `backend/knowledge_base/` for fallback txt files
  - Uses `together-ai` with model `meta-llama/Llama-3-70b-chat-hf` by default
- **Frontend**: `frontend/` (React + React Scripts)
  - Environment variable `REACT_APP_API_URL` points to the backend URL
  - UI for chat and file management

Ports (default):
- Backend: `3001`
- Frontend: `3000`

---

## How the Live Scraper Works
When the user sends a message in a scholar domain, the backend will do the following:
- Extracts key search terms from the query (strips conversational filler words)
- Searches DuckDuckGo for site:aei.org "[Scholar Name]" [key terms] to find query-specific articles
- Also fetches the scholar's AEI profile page (aei.org/scholar/name or aei.org/profile/name) for recent articles
- Combines both sources, with DuckDuckGo results prioritized
- Scrapes each article page for title, author, publication date, and body text
- If live scraping returns nothing (e.g., General mode or network issues), it falls back to local .txt files in backend/knowledge_base/

---

## Prerequisites
- Node.js 18+ and npm
- A Together AI API key
  - Create an account and generate a key, then set `TOGETHER_API_KEY` in `backend/.env`
- Python 3.10+ and `venv` (used repo‑wide for Python tooling, including the article extractor)

---

## Quick start (local)
Follow these steps exactly in two terminals.

1) Clone the repository
```bash
git clone https://github.com/baekbyte/aei-chatbot.git
cd aei-chatbot
```

2) Create a Python virtual environment (.venv) for the project
```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install requests beautifulsoup4 readability-lxml urllib3 certifi lxml
```

3) Install Node.js dependencies
```bash
cd backend && npm install
cd frontend && npm install
```
*Skip to **Production deployment** if you are deploying production*

4) Configure environment variables
- Create `backend/.env`:
```bash
TOGETHER_API_KEY=your_together_api_key_here
PORT=3001
```
- Create `frontend/.env`:
```bash
REACT_APP_API_URL=http://localhost:3001
```

5) Start the backend
```bash
cd backend
npm start
# Health check: http://localhost:3001/api/health
```

6) Start the frontend (in a second terminal)
```bash
cd frontend
npm start
```

7) Open the app
- Visit `http://localhost:3000`
- Pick a domain (or use General) and start chatting

---

### Python article extractor instructions

Usage
- Step 1: Extract links for a scholar (prompts for name if not provided):
```bash
python backend/article_extractor/aei_links_extractor.py "Brent Orrell"
```
- Step 2: Scrape article pages referenced in the generated URLs and save `.txt` files into `backend/knowledge_base/<Scholar_Folder>/`:
```bash
python backend/article_extractor/aei_scrape_articles.py "Brent Orrell"
```

Notes
- The scraper writes to your local repository; restart the backend to ensure caches refresh, or simply ask the backend to read after upload operations
- Be considerate with scraping; scripts include basic throttling
- Only use these scripts for content you’re allowed to download/store

---

## Knowledge base: domains and files
The assistant can ground its answers in domain‑specific sources. A domain maps to a folder under `backend/knowledge_base/` (e.g., `Brent_Orrell`, `Shane_Tews`).

- Files must be plain text: `.txt`
- Upload limit: 10 MB per file
- The backend maintains a simple cache in `content_cache.json` and domain metadata in `metadata.json`

Ways to add content:
1) Via UI: switch to the File Manager view and upload `.txt` files to a selected domain
2) Manually: place `.txt` files into `backend/knowledge_base/<DomainName>/` and restart the backend
3) Use python scripts to automatically updates txt file (**Recommended**)

Create new domains from the UI or via API. Domain names are sanitized to alphanumeric, dash, underscore.

---

## Frontend usage tips
- The app generates a unique anonymous user ID in `localStorage` to separate chat histories per browser
- Sidebar lets you switch between Chat and Files, create a new chat, select domain, upload files, and delete chats

---

## API reference (backend)
Base URL: `http://localhost:3001`

Health
- `GET /api/health` → backend status

Chat
- `POST /api/chat/new` → create chat
  - Headers: `x-user-id: <uuid>` (frontend sets this automatically)
  - Body: `{ "domainName": "General" | "<Domain>" }`
- `GET /api/chat/history` → list chats for current user (requires `x-user-id` header)
- `GET /api/chat/:chatId` → get chat details
- `DELETE /api/chat/:chatId` → delete chat
- `POST /api/chat/:chatId/message` → send a message
  - Body: `{ "message": "Your question here" }`

Files / Knowledge Base
- `GET /api/files/domains` → list domains and metadata
- `POST /api/files/domains` → create domain
  - Body: `{ "name": "New_Domain", "description": "optional" }`
- `DELETE /api/files/domains/:domainName` → delete a domain
- `POST /api/files/upload/:domainName` → upload `.txt` files (multipart)
- `GET /api/files/content/:domainName` → get all file contents in a domain
- `GET /api/files/content/:domainName/:filename` → get a single file
- `PUT /api/files/content/:domainName/:filename` → update a file
- `DELETE /api/files/content/:domainName/:filename` → delete a file
- `GET /api/files/stats/:domainName` → domain statistics
- `GET /api/files/search?q=term[&domain=Name]` → search across domains

Example: create a chat and send a message (replace `<CHAT_ID>` after step 1)
```bash
curl -s -X POST http://localhost:3001/api/chat/new \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: test-user-123' \
  -d '{"domainName":"General"}'

curl -s -X POST http://localhost:3001/api/chat/<CHAT_ID>/message \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize AEI\'s mission."}'
```

Example: upload files to a domain
```bash
curl -s -X POST http://localhost:3001/api/files/domains \
  -H 'Content-Type: application/json' \
  -d '{"name":"My_Scholar","description":"My corpus"}'

curl -s -X POST http://localhost:3001/api/files/upload/My_Scholar \
  -F 'files=@/path/to/file1.txt' \
  -F 'files=@/path/to/file2.txt'
```

---

## Configuration
Backend (`backend/.env`):
```bash
TOGETHER_API_KEY=your_together_api_key_here
PORT=3001
NODE_ENV=production # or development
```

Frontend (`frontend/.env`):
```bash
REACT_APP_API_URL=https://your-backend-host:3001
```

Model and generation settings
- Default model: `meta-llama/Llama-3-70b-chat-hf`
- Max tokens: 512; Temperature: 0.7 (see `backend/routes/chat.js` to adjust)

Storage layout (backend)
- Chats: `backend/chats/index.json` and `backend/chats/<chatId>.json`
- Knowledge base: `backend/knowledge_base/<Domain>/*.txt`
- Cache: `backend/knowledge_base/content_cache.json`
- Domain metadata: `backend/knowledge_base/metadata.json`

---

## Production deployment
You can deploy backend and frontend separately. Below are common approaches.

Backend (Node/Express)
1) Choose a host (Render, Fly.io, Railway, Heroku, a VM, etc.) (**[Render](https://render.com/) Recommended: Instructions Below**)
2) Set environment variables (`TOGETHER_API_KEY`)
3) Ensure persistent storage for `backend/chats` and `backend/knowledge_base` if you want data to survive restarts
4) Start command: `npm start` in `backend/`

Frontend (Static hosting)
1) Build in `frontend/`: `npm run build`
2) Deploy `frontend/build/` to your static host (Vercel, Netlify, S3+CloudFront, etc.) (**[Vercel](https://vercel.com) Recommended: Instructions Below**)
3) Set `REACT_APP_API_URL` at build time to point to your backend URL

CORS
- The backend enables CORS for all origins by default. If you harden it, allow your frontend origin.

---

### Deploying the backend on [Render](https://render.com/)
Render can run the Node/Express backend directly from your repo.

1) Create a new Web Service
- Pick the GitHub repo, set Root Directory to `backend/`
- Runtime: Node
- Build Command: leave empty (Render auto-installs) or `npm install`
- Start Command: `npm start`

2) Environment variables
- Add `TOGETHER_API_KEY`
- Do not hardcode `PORT` on Render; Render provides `PORT` and the app already uses `process.env.PORT`

3) Verify
- After deploy, open the Render service URL and check `GET /api/health`
- Upload files via UI or Python script; they should persist across redeploys

### Deploying the frontend on [Vercel](https://vercel.com)
Vercel can host the React app frontend directly from you repo.

1) Import project
- New Project → Import from Github → select the repo
- Project Settings → Root Directory: `frontend/`

2) Build settings
- Framework Preset: Create React App (or None)
- Build Command: `npm run build`
- Output Directory: `build`

3) Environment variables
- Add `REACT_APP_API_URL` with your Render backend URL, e.g. `https://<your-render-service>.onrender.com`
- Trigger a redeploy after changing env vars

4) Test and CORS
- Open the Vercel URL; chat and file operations should work
- If you later restrict CORS on the backend, add your Vercel domain to the allowed origins

5) Optional: custom domain
- Point your domain to Vercel for the frontend and to Render for the backend; update `REACT_APP_API_URL` accordingly

---

## Troubleshooting
- Backend won’t start
  - Ensure Node 18+, `npm install` completed, `TOGETHER_API_KEY` is set
  - Port already in use? Change `PORT` in `backend/.env`
- Frontend can’t reach API
  - Confirm `REACT_APP_API_URL` matches your backend and that the backend is reachable
  - Check `http://<backend>/api/health`
- File upload fails
  - Only `.txt` files are allowed; max 10 MB per file
  - Ensure the domain exists before uploading
- Chats not appearing in sidebar
  - The app identifies users by a local UUID; try a hard refresh or clear localStorage
  - Ensure requests include `x-user-id` header (the frontend sets this automatically except for some direct API tests)
- Responses seem generic
  - Add more `.txt` files to the selected domain; the assistant prioritizes provided sources

---

## Future Steps
- **Expand scholar coverage** — add more AEI scholars as domains; the scraper works automatically for any scholar with an AEI profile page
- **Improve DuckDuckGo reliability** — DuckDuckGo occasionally rate-limits requests; consider integrating a paid search API (e.g., Brave Search API) for more consistent results
- **Add streaming responses** — currently the LLM response waits until fully generated; streaming would make the UI feel faster
- **Allow domain switching within a chat** — currently the domain is locked at chat creation; adding mid-chat domain switching would improve usability
- **Persistent deployment storage** — chat history and knowledge base files are stored locally on Render, which resets on redeploys; consider migrating to a persistent database (e.g., PostgreSQL) or cloud storage (e.g., AWS S3)
- **Internal term glossary** — build a mapping of internal AEI shorthand (e.g., "KGM trial" → "social media addiction trial") to improve search accuracy for team-specific terminology

---

## Scripts
Backend (`backend/package.json`):
- `npm run dev` → start with nodemon
- `npm start` → start once with Node

Frontend (`frontend/package.json`):
- `npm start` → run dev server on port 3000
- `npm run build` → production build to `frontend/build/`
- `npm test` → run tests

---

## License
Proprietary – for internal AEI use unless otherwise specified.
