# InMarket SDR Agent

An automated Sales Development Representative (SDR) research and email drafting system. Given a company name, it fetches recent news via the Serper.dev API, synthesizes strategic insights using an LLM, and drafts a personalized outreach email—all through a clean single-page interface.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Setup Instructions](#setup-instructions)
- [Running the Application](#running-the-application)
- [LLM Agent Details](#llm-agent-details)
- [MCP Server Details](#mcp-server-details)
- [Deployment Discussion](#deployment-discussion)

---

## Project Overview

### Public API — Serper.dev

The system uses [Serper.dev](https://serper.dev) as its external data source. Serper provides a Google News search API: given a company name, it returns structured news results including titles, snippets, sources, dates, and URLs. The agent uses the top 3 results as the factual basis for all downstream analysis.

### MCP Server

The MCP (Model Context Protocol) server is a standalone microservice that wraps the Serper API behind a tool-based interface. It exists to enforce a clean separation between external I/O and application logic:

- The backend never calls Serper directly. It sends a JSON-RPC request to the MCP server, which handles the HTTP call, error handling, timeouts, and response normalization.
- This makes the external API dependency swappable, testable, and independently deployable.

### LLM Agent Backend

The Node.js + Express backend hosts a LangChain agent pipeline that orchestrates the full workflow:

1. Receives a company name from the frontend.
2. Calls the `research_company_news` tool (which spawns the MCP server).
3. Feeds the structured news data into an LLM with a detailed system prompt.
4. The LLM produces a Lead Dossier: top news, strategic insights, and a personalized outreach email.
5. Returns the dossier as JSON to the frontend.

### Frontend

A React + Vite + Tailwind CSS single-page application with a minimal dark-mode UI:

- Single input for company name, one Generate button.
- Apple-style animated loading steps: "Fetching news…", "Extracting insights…", "Drafting email…".
- Results display: email draft (with copy-to-clipboard), insights, and top news.

---

## Architecture

### High-Level Diagram

```
┌──────────────────────┐
│      Frontend         │
│  React + Vite + TW   │
│  localhost:5173       │
└──────────┬───────────┘
           │ POST /api/lead-dossier
           │ { companyName }
           ▼
┌──────────────────────┐
│      Backend          │
│  Express (Node.js)    │
│  localhost:4000       │
│                       │
│  ┌─────────────────┐  │
│  │  LangChain Agent │  │
│  │  (sdrAgent.js)   │  │
│  └────────┬────────┘  │
│           │            │
│  ┌────────▼────────┐  │
│  │   MCP Client     │  │
│  │  (mcpClient.js)  │  │
│  └────────┬────────┘  │
└───────────┼───────────┘
            │ JSON-RPC over stdio
            │ (child process)
┌───────────▼───────────┐
│     MCP Server         │
│  (mcp-server/index.js) │
│                        │
│  ┌──────────────────┐  │
│  │ research_company  │  │
│  │ _news tool        │──┼──► Serper.dev News API
│  └──────────────────┘  │     (google.serper.dev/news)
└────────────────────────┘
```

### Request Flow

1. **Frontend** sends `POST /api/lead-dossier` with `{ companyName }` to the backend.
2. **Backend** invokes `runLeadDossier(companyName)` which builds a LangChain `RunnableSequence` pipeline.
3. The pipeline calls the `research_company_news` DynamicTool.
4. The tool triggers **mcpClient**, which spawns the MCP server as a child process and sends a `Content-Length`-framed JSON-RPC 2.0 request over stdin.
5. The **MCP server** dispatches the `tools/call` method to the `research_company_news` handler, which calls the Serper.dev News API.
6. Serper returns news results. The MCP server normalizes them into `{ companyName, news }` and writes a framed JSON-RPC response to stdout.
7. **mcpClient** reads the response, unwraps `result.content[0].text`, parses it, and returns it to the pipeline.
8. The pipeline feeds the news JSON into the LLM with a `SystemMessage` (InMarket SDR persona) and a `HumanMessage` (company + news data).
9. The LLM returns a Lead Dossier JSON object: `{ companyName, topNews, insights, emailDraft }`.
10. The backend sends the dossier back to the frontend as JSON.

### Separation of Concerns

| Layer | Responsibility |
|-------|---------------|
| **Frontend** | User input, loading UX, result display, clipboard |
| **Backend API** | HTTP routing, timeout/fallback handling, CORS |
| **Agent** | LLM orchestration, prompt engineering, JSON parsing |
| **MCP Client** | Child process management, JSON-RPC framing, response unwrapping |
| **MCP Server** | External API calls, error handling, response normalization |
| **Tools** | Individual API wrappers (Serper), timeout protection |

Each layer is independently testable. The MCP server can be replaced, containerized, or pointed at a different API without changing the agent or frontend.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express 5 |
| Agent | LangChain (RunnableSequence, DynamicTool, ChatOpenAI) |
| LLM | OpenAI GPT-4o-mini (configurable) |
| MCP Server | Custom JSON-RPC 2.0 over stdio |
| External API | Serper.dev (Google News search) |
| Fonts | Inter (Google Fonts) |

---

## Repository Structure

```
inmarket-sdr-agent/
├── package.json                  # Root workspace config
├── README.md                     # This file
│
├── frontend/                     # React + Vite + Tailwind
│   ├── index.html                # HTML entry with Inter font
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js        # Custom colors, animations
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx              # React entry
│       ├── App.tsx               # Main UI component
│       └── index.css             # Tailwind base layer + global styles
│
├── backend/                      # Express API + LangChain agent
│   ├── .env                      # OPENAI_API_KEY, SERPER_API_KEY
│   ├── package.json
│   └── src/
│       ├── server.js             # Express app, routes, timeout handling
│       ├── agent/
│       │   ├── sdrAgent.js       # LangChain pipeline + system prompt
│       │   └── testAgent.js      # CLI test runner
│       ├── services/
│       │   └── mcpClient.js      # Spawns MCP server, JSON-RPC framing
│       └── sdr/
│           └── sdrController.js  # Legacy research/email controllers
│
└── backend/mcp-server/           # Standalone MCP microservice
    ├── .env                      # SERPER_API_KEY
    ├── package.json
    ├── index.js                  # JSON-RPC stdio server
    └── src/
        └── tools.js              # research_company_news + other tools
```

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Clone the Repository

```bash
git clone <repository-url>
cd inmarket-sdr-agent
```

### 2. Install Dependencies

```bash
# Frontend
cd frontend && npm install && cd ..

# Backend
cd backend && npm install && cd ..

# MCP Server
cd backend/mcp-server && npm install && cd ../..
```

### 3. Obtain API Keys

**Serper.dev** — Sign up at [serper.dev](https://serper.dev). The free tier provides 2,500 queries. Copy your API key from the dashboard.

**OpenAI** — Sign up at [platform.openai.com](https://platform.openai.com). Create an API key under API Keys. The system defaults to `gpt-4o-mini`.

### 4. Create Environment Files

**`backend/.env`**

```env
OPENAI_API_KEY=sk-...
SERPER_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

**`backend/mcp-server/.env`**

```env
SERPER_API_KEY=...
```

The backend passes `process.env` to the MCP child process, so setting `SERPER_API_KEY` in `backend/.env` is sufficient. The MCP `.env` is a fallback for standalone usage.

---

## Running the Application

Start all three services in separate terminals:

**Terminal 1 — Backend (port 4000)**

```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend (port 5173)**

```bash
cd frontend
npm run dev
```

The MCP server does not need to be started manually — the backend spawns it as a child process on each request.

### Expected URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 |
| Health check | http://localhost:4000/health |

### Example Usage

1. Open http://localhost:5173 in a browser.
2. Enter a company name (e.g. "Nike").
3. Click **Generate**.
4. Watch the animated loading steps: "Fetching news…" → "Extracting insights…" → "Drafting email…".
5. View the results: a personalized outreach email, 3-5 strategic insights, and the top 3 news articles.
6. Click the copy icon to copy the email to clipboard.

### Example Output

```json
{
  "companyName": "Nike",
  "topNews": [
    {
      "title": "Nike Reports Strong Q4 Earnings Driven by Direct-to-Consumer Growth",
      "snippet": "Nike's direct sales channel grew 24% year-over-year...",
      "source": "Bloomberg",
      "date": "2026-03-08",
      "url": "https://..."
    }
  ],
  "insights": [
    "Nike's DTC push signals increased investment in digital marketing — InMarket Activation can reach high-intent shoppers at the moment of purchase decision.",
    "Retail expansion into new markets creates a measurement opportunity — LCI® can track ad-driven foot traffic to new store locations."
  ],
  "emailDraft": "Hi Team,\n\nI saw Nike's latest earnings report highlighting 24% growth in direct-to-consumer sales..."
}
```

### CLI Test

You can test the agent directly without the frontend:

```bash
cd backend
node src/agent/testAgent.js
```

This calls `runLeadDossier("Nike")` and prints the full JSON dossier to the console.

---

## LLM Agent Details

### Tool Definition

The agent registers one LangChain `DynamicTool`:

- **Name**: `research_company_news`
- **Input**: A company name string.
- **Behavior**: Calls `mcpClient.invokeTool('research_company_news', { companyName })` and returns the result as a JSON string for the LLM to consume.

### Pipeline Architecture

The agent uses a `RunnableSequence` with three steps:

1. **Input normalization**: Converts the raw company name string into `{ companyName }`.
2. **Tool execution** via `RunnablePassthrough.assign`: Calls the `research_company_news` tool and attaches the result as `newsJson`.
3. **LLM synthesis**: Sends a `SystemMessage` + `HumanMessage` to ChatOpenAI. The system message contains the full InMarket SDR persona and output schema. The human message includes the company name and the raw tool output.

### Prompt Engineering

The system prompt is designed with several deliberate choices:

- **Company context injection**: The prompt includes InMarket's full value proposition (Audiences, Activation, Measurement/LCI, InSights) so the LLM can map prospect signals to specific capabilities.
- **Structured workflow**: The prompt prescribes a strict sequence — research first, then insights, then email — preventing the LLM from skipping the tool call or hallucinating news.
- **Email structure**: The prompt specifies a 3-paragraph format (news hook → capability connection → low-friction CTA) that mirrors proven SDR outreach patterns.
- **Hallucination guard**: The prompt explicitly states "Only reference facts supported by the news results" and "Using ONLY this data" in the human message.
- **JSON enforcement**: The prompt demands strict JSON output with a defined schema, and the pipeline validates it with `JSON.parse`.
- **Temperature 0.2**: Low temperature for factual consistency while allowing slight variation in phrasing.

### Insights Generation

The prompt instructs the LLM to generate 3-5 single-sentence insights, each identifying a strategic signal from the news (e.g. product launch, retail expansion, marketing spend) and connecting it to a specific InMarket capability. This gives the SDR context beyond just the email.

---

## MCP Server Details

### JSON-RPC Protocol

The MCP server communicates over stdin/stdout using `Content-Length`-framed JSON-RPC 2.0 messages:

**Request format:**

```
Content-Length: <byte_length>\r\n
\r\n
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"research_company_news","arguments":{"companyName":"Nike"}}}
```

**Response format:**

```
Content-Length: <byte_length>\r\n
\r\n
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{...}"}]}}
```

### stdout Isolation

All logging is redirected to stderr (`console.log` is overridden to `console.error` at startup). This ensures stdout is reserved exclusively for JSON-RPC response frames and prevents log output from corrupting the protocol stream.

### Error and Timeout Handling

The `research_company_news` tool implements multiple layers of protection:

| Scenario | Behavior |
|----------|----------|
| Missing `SERPER_API_KEY` | Returns `{ news: [], insights: [] }` immediately |
| Missing or invalid `companyName` | Returns `{ news: [], insights: [] }` immediately |
| Serper returns non-200 status | Caught inside try/catch, returns empty research |
| Serper returns HTML instead of JSON | Detected via `startsWith('<')`, returns empty research |
| Serper returns malformed JSON | Caught by inner `JSON.parse` try/catch, returns empty research |
| Serper request exceeds 15s | `Promise.race` with timeout rejects, caught and returns empty research |
| Network error or DNS failure | Caught by outer try/catch, returns empty research |

The tool never throws. The agent always receives a valid JSON object.

### Backend Timeout

The Express route wraps the entire agent call in a `Promise.race` with a 60-second timeout. If the agent hangs for any reason, the route responds with a fallback dossier:

```json
{
  "topNews": [],
  "insights": ["No insights available for this company."],
  "emailDraft": "Hi, we couldn't fetch recent news for <company>, but would still love to connect."
}
```

---

## Deployment Discussion

### Docker Compose (Recommended for Self-Hosted)

The system has three natural containers:

```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]

  backend:
    build: ./backend
    ports: ["4000:4000"]
    env_file: ./backend/.env

  # MCP server is spawned as a child process by the backend,
  # so it does not need its own container. It ships inside
  # the backend image.
```

The MCP server runs as a child process of the backend, so it does not require a separate container or network endpoint. It ships inside the backend Docker image.

### Serverless Backend

The backend can be deployed as a serverless function (e.g. AWS Lambda, Google Cloud Functions) since each request is stateless. The MCP server would be bundled into the deployment package. Considerations:

- Cold start latency (~2-3s) adds to the LLM call time.
- The 60-second timeout fits within most serverless limits.
- Environment variables are set via the platform's secrets manager.

### Frontend on Vercel / Netlify

The Vite frontend is a static build:

```bash
cd frontend && npm run build
```

Deploy the `dist/` folder to Vercel or Netlify. Set `VITE_API_URL` as an environment variable pointing to the backend URL.

### Environment Variables in Production

| Variable | Where | Description |
|----------|-------|-------------|
| `OPENAI_API_KEY` | Backend | OpenAI API key |
| `OPENAI_MODEL` | Backend | Model name (default: `gpt-4o-mini`) |
| `SERPER_API_KEY` | Backend | Serper.dev API key |
| `PORT` | Backend | Express port (default: `4000`) |
| `VITE_API_URL` | Frontend (build-time) | Backend URL (default: `http://localhost:4000`) |
