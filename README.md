# tasksAreUs

## Prerequisites
- dcb45f1b-5dfe-4028-b2e4-4405d3ff5719
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- https://tasksareus-production.up.railway.app/api/v1/health

- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasksareus python3 tests/test_api.py

- BASE_URL=https://tasksareus-production.up.railway.app/api/v1 DATABASE_URL=postgresql://postgres:vutcOZXtrMlhjmIPbbNGvamdnLdGwwNJ@interchange.proxy.rlwy.net:38123/railway python3 tests/test_api.py

- git rev-parse --short HEAD
-  curl -s https://tasksareus-production.up.railway.app/api/v1/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['version'])"
## Setup

Copy the env file and add your Anthropic API key:
```bash
cp backend/.env.example backend/.env
# edit backend/.env and set ANTHROPIC_API_KEY
```

## Start

```bash
cd backend && docker-compose up -d
 cd backend && docker-compose up -d --build
```

Open **http://localhost:5173**

## Stop

```bash
cd backend && docker-compose down
```

## Other ports

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:5173      |
| Backend  | http://localhost:8000/docs      |
| pgAdmin  | http://localhost:5050      |
