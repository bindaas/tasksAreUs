# tasksAreUs

## Prerequisites
- dcb45f1b-5dfe-4028-b2e4-4405d3ff5719
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Setup

Copy the env file and add your Anthropic API key:
```bash
cp backend/.env.example backend/.env
# edit backend/.env and set ANTHROPIC_API_KEY
```

## Start

```bash
cd backend && docker-compose up -d
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
