# tasksAreUs

## Railway-URLs
- https://tasksareus-production.up.railway.app/api/v1/health
- https://tasksareus-production.up.railway.app/


## Railway-Test

- BASE_URL=https://tasksareus-production.up.railway.app/api/v1 DATABASE_URL=postgresql://postgres:vutcOZXtrMlhjmIPbbNGvamdnLdGwwNJ@interchange.proxy.rlwy.net:38123/railway python3 tests/test_api.py


## Local-URLs

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:5173      |
| Backend  | http://localhost:8000/docs      |
| pgAdmin  | http://localhost:5050      |


## Local-Start

- cd backend && docker-compose up -d
- cd backend && docker-compose up -d --build


## Local-Stop
- cd backend && docker-compose down


## Local-Test
- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasksareus python3 tests/test_api.py


## Railway-Deploy
- git rev-parse --short HEAD
-  curl -s https://tasksareus-production.up.railway.app/api/v1/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['version'])"
