GitHub Repository Analysis Platform

[![Vercel Deployment](https://img.shields.io/badge/Deployment-Live%20on%20Vercel-success?style=flat&logo=vercel)](https://git-insight.vercel.app)
[![API Status](https://img.shields.io/badge/Backend-Render%20Web%20Service-informational?style=flat&logo=render)](https://gitinsight-api-nd5q.onrender.com/api/health)
[![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-green?style=flat&logo=mongodb)](https://www.mongodb.com/cloud/atlas)
[![AI Engine](https://img.shields.io/badge/AI-Google%20Gemini%203.8%20Flash-blue?style=flat&logo=google)](https://ai.google.dev/)

> **Master of Computer Applications (MCA) Capstone Project**  
> GitInsight is a full-stack MERN application that provides automated repository auditing, static code quality and security scanning, deterministic health scoring, and grounded retrieval-augmented chat (RAG) with exact file and line citations.

---

## 🌐 Live URLs

- **Live Application:** [https://git-insight.vercel.app](https://git-insight.vercel.app)
- **Production API:** [https://gitinsight-api-nd5q.onrender.com](https://gitinsight-api-nd5q.onrender.com)
- **API Health Check:** [https://gitinsight-api-nd5q.onrender.com/api/health](https://gitinsight-api-nd5q.onrender.com/api/health)

---

## 🎯 Key Capabilities

### 1. Public Repository Ingestion & Tree Analysis
- Input any public repository via shorthand (`owner/repo`) or full GitHub URL.
- Concurrently fetches repository metadata, commit logs, primary language distributions, dependency manifests (`package.json`, etc.), and full file tree hierarchies using GitHub REST API v3.
- Automatic offline fallback dataset ensuring zero test interruptions.

### 2. Deterministic 0–100 Repository Health Engine
- Computes an explainable, objective health score without consuming LLM tokens.
- Audits across 6 weighted dimensions:
  1. **Code Quality**: File modularity, naming discipline, linter configs.
  2. **Security**: Detection of exposed secrets, tokens, credential patterns, and lockfile presence.
  3. **Documentation**: README presence, installation guides, contribution guidelines.
  4. **Maintainability**: Release frequency, issue-to-star ratio, package manager hygiene.
  5. **Architecture**: Clean directory separation (MVC, route separation, service layers).
  6. **Testing**: Automated test suite discovery (`jest`, `mocha`, `vitest`, `pytest`).

### 3. Context-Grounded AI Insights
- Generates 2-paragraph summaries, prioritized recommendations, and onboarding roadmaps.
- Strictly conditioned on deterministic findings to eliminate hallucinations.
- Powered by `gemini-3.8-flash` with optimized `thinkingLevel: 'low'` for low latency and zero unnecessary token consumption.

### 4. Codebase-Aware RAG (Retrieval-Augmented Generation) Chat
- Chunks and indexes source files with start/end line tracking.
- Token-frequency relevance scoring tailored to developer questions (Auth, Routing, DB, Middleware, Error Handling).
- **Exact Line Citations**: Every response cites the top relevant source files with line-range links (e.g. `server/server.js #L38–L82`).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Lucide React, Axios, React Router v7 |
| **Backend** | Node.js (v24), Express.js (v4), Mongoose (v8), JWT, bcryptjs |
| **Cloud Database** | MongoDB Atlas (Production M0 Cluster) / Embedded In-Memory MongoDB (Dev) |
| **AI / LLM** | Google Gemini API (`gemini-3.8-flash` via `@google/genai` SDK) |
| **Deployment** | Vercel (Frontend Global Edge Network), Render (Backend Containerized Web Service) |

---

## 📁 Architecture Overview

```text
gitinsight/
├── client/                     # React + Vite Frontend
│   ├── src/
│   │   ├── components/         # Navbar, ProtectedRoute, Modals
│   │   ├── context/            # AuthContext (JWT session state)
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx           # Clean RepoMind-style search & audit cards
│   │   │   ├── Login.jsx               # Validated email/password authentication
│   │   │   ├── Register.jsx            # Validated user registration
│   │   │   ├── RepositoryDetail.jsx    # Tree, dependencies, commits & README
│   │   │   ├── RepositoryAnalysis.jsx  # Health score & static findings breakdown
│   │   │   └── RepositoryChat.jsx      # Grounded RAG chat with line references
│   │   ├── services/           # Axios instance with auth interceptors
│   │   ├── App.jsx             # Route definitions & minimalist hero
│   │   └── main.jsx
│   └── vite.config.js
├── server/                     # Express.js REST API Backend
│   ├── analyzers/
│   │   ├── quality/            # Code quality heuristics
│   │   ├── security/           # Secret leakage & vulnerability heuristics
│   │   └── scoringEngine.js    # Deterministic 0-100 scoring algorithm
│   ├── config/                 # MongoDB Atlas connection & fallback
│   ├── controllers/            # Auth, Repository, Analysis, and RAG controllers
│   ├── middleware/             # JWT auth middleware, error handlers
│   ├── models/                 # User, Repository, Analysis, RepositoryChunk
│   ├── routes/                 # Express API route endpoints
│   ├── services/
│   │   ├── ai/                 # Gemini API client & insight generator
│   │   ├── github/             # GitHub REST API client & parser
│   │   └── rag/                # Chunk indexing & intent-driven retrieval
│   └── server.js               # Application bootstrap & CORS configuration
├── .env.example                # Template configuration
└── package.json
```

---

## 🚦 Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/anshulsharma48/GitInsight.git
cd GitInsight
```

### 2. Install dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
cd ..
```

### 3. Configure environment variables
Create a `.env` file in the project root:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# Optional: leave blank for automatic local embedded in-memory MongoDB
MONGO_URI=

# Optional: GitHub token for higher rate limits
GITHUB_TOKEN=

# Gemini API Key (Get free from https://aistudio.google.com/)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key

VECTOR_DB_TYPE=memory
```

### 4. Run the development servers
In Terminal 1 (Backend):
```bash
cd server
npm run dev
```

In Terminal 2 (Frontend):
```bash
cd client
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 🧪 Verification & Demonstration

To demonstrate GitInsight during presentation or evaluation:
1. Register a new account or log in.
2. In the repository search bar, try testing with either:
   - `karanpratapsingh/tutorials` (full MERN stack with authentication and database)
   - `expressjs/express` (large framework)
   - `anshulsharma48/GitInsight` (auditing GitInsight itself)
3. Click **Import & Analyze** &rarr; review the 0–100 health metrics and categorized findings.
4. Navigate to **Repository Chat** &rarr; click **Index Repository**.
5. Ask architectural questions like:
   - *"How does authentication work?"*
   - *"Where is routing implemented?"*
   - *"How is error handling structured?"*
6. Expand the **Cited Sources** to observe exact file and line references grounding the AI response.

