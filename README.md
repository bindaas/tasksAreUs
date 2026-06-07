# tasksAreUs


 1. Start the dev server:
  cd mobile && npx expo start
  1. A QR code appears in the terminal.
  2. On your iPhone: install Expo Go from the App Store (if not already installed), then open the Camera app and scan the QR code. It'll open in Expo Go automatically.
  3. What you should see:
    - App launches, auto-signs in anonymously (no login screen)
    - Four tabs at the bottom: Tasks / Chat / Reports / Settings
    - Settings tab shows "Anonymous user" and a Sign out button
    - Sign out → LoginScreen with Google and magic link options

  That's it. Backend is already running at 10.0.0.35:8000 so the API is live.

## Railway-URLs
- https://tasksareus-production.up.railway.app/api/v1/health
- https://tasksareus-production.up.railway.app/


- fewer-permission-prompts
- For all the permissions you asked me and I said yes- add it to the settings so that you dont have to ask me again    
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
- git commit -m "your message [skip deploy]"


## Local-Stop
- cd backend && docker-compose down


## Local-Test
- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasksareus python3 tests/test_api.py


## Railway-Deploy
- git rev-parse --short HEAD
-  curl -s https://tasksareus-production.up.railway.app/api/v1/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['version'])"
