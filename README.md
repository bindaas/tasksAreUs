# tasksAreUs

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) (v18+)

## Setup

1. Copy the env file and add your Anthropic API key:
   ```bash
   cp backend/.env.example backend/.env
   # edit backend/.env and set ANTHROPIC_API_KEY
   ```

2. Install frontend dependencies (one-time):
   ```bash
   cd frontend && npm install
   ```

## Start

```bash
# Terminal 1 — backend
cd backend && docker-compose up -d

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open **http://localhost:5173**

## Stop

```bash
cd backend && docker-compose down
```
