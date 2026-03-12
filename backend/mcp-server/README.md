# MCP Server (External API Microservice)

This directory contains a minimal MCP-style microservice that wraps external APIs (LinkedIn, CRM, enrichment, web search, LLM tooling, etc.) behind a small tool interface.

The process is intentionally decoupled from the Express backend:

- The backend calls it via `node backend/mcp-server/index.js <toolName> <jsonArgs>`
- All external I/O happens here, not in the HTTP layer
- You can later host this as an independent container or service without changing the backend contract

## Tool surface

Defined in `src/tools.js`:

- `prospect_research`: fetch and synthesize prospect + account context
- `email_draft`: generate email content based on research

Replace the placeholders with real integrations as you wire in external systems.
