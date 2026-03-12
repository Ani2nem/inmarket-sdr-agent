# Backend (Express API)

Node.js + Express backend that exposes HTTP endpoints for the SDR workflows and delegates external integrations to the MCP microservice.

## Key files

- `src/server.js`: Express app, health check, and SDR workflow routes
- `src/sdr/sdrController.js`: High-level orchestration for research and email drafting
- `src/services/mcpClient.js`: Spawns the MCP microservice as a child process and calls tools
- `mcp-server/`: Standalone MCP-style microservice for external APIs

## Running

From the repo root:

```bash
npm run dev:backend
```

This will start the backend on port `4000`. The frontend should call the backend instead of talking directly to any external APIs.
