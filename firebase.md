# Firebase Authentication Plan

## Scope

Migrate the **existing browser app** to Firebase Authentication. Mobile (iOS/Android) and Apple Sign-In are out of scope for now but the data model and backend are designed to accommodate them without breaking changes when the time comes.

**Auth modes in scope:** Anonymous, Magic Link (email), Google

**Platform in scope:** Browser (React + Vite)

---

## Human Prerequisites (outside the codebase)

These steps must be completed by a human before any code is deployed. Capture the values produced here — they feed into backend and frontend environment variables.

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and create a new project.
2. In the project, go to **Authentication → Sign-in method** and enable:
   - **Anonymous**
   - **Email/Password → Email link (passwordless sign-in)**
   - **Google**
3. Under **Authentication → Settings → Authorized domains**, add:
   - `localhost` (for local dev)
   - Your production domain (e.g. `tasksareus.up.railway.app`)
4. Go to **Project Settings → General → Your apps** and add a **Web app**. Copy the Firebase config object — you will need: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
5. Go to **Project Settings → Service accounts** and click **Generate new private key**. Download the JSON file. This becomes `FIREBASE_SERVICE_ACCOUNT_JSON` for the backend. **Never commit this file.**

> **For future Apple Sign-In:** enable the Apple provider in the same console, add the Service ID and key from your Apple Developer account. No backend or schema changes needed.

---

## Auth Behaviour

**Anonymous auth is browser-storage-sticky.** Firebase stores the anonymous UID in `indexedDB`. Same browser on the same device always gets the same UID, as long as the user does not clear browser storage. This is functionally identical to the current `device_uuid` in `localStorage` — Firebase just takes ownership of it.

On iPhone (future): Firebase stores the UID in the Keychain, which survives app reinstalls. Genuinely device-sticky.

**Anonymous users do not sign out.** Sign-out is only meaningful for users who have explicitly upgraded to Google or Magic Link. Anonymous users have no "sign out" concept — they are always the same user on the same browser.

If an already-authenticated (non-anonymous) user signs in on a different device that has anonymous data, those anonymous tasks are left untouched. Two different Firebase `uid`s = two separate users = data never mixes.

---

## How Firebase Solves the Upgrade Problem

Firebase issues every user (including anonymous ones) a `uid`. When an anonymous user links a Google or email account on the same device, Firebase **keeps the same uid** and just upgrades the provider. The client calls `linkWithCredential()`; the backend sees the same user record with the same `uid`. No server-side migration endpoint needed for this flow.

---

## Data Model Changes

### `users` table — new columns (additive only, no drops)

```sql
ALTER TABLE users ADD COLUMN firebase_uid VARCHAR UNIQUE;
ALTER TABLE users ADD COLUMN email        VARCHAR;
ALTER TABLE users ADD COLUMN display_name VARCHAR;
```

These are **manual SQL statements** run against the live database before deploying Phase 1. The backend uses `Base.metadata.create_all()` on startup, which does not add columns to existing tables — these `ALTER TABLE` statements must be run explicitly.

- `firebase_uid` — primary lookup key going forward, set for every user (anonymous included). Indexed.
- `auth_provider` (already exists) — updated to use Firebase provider strings: `anonymous`, `google.com`, `password` (magic link).
- `auth_provider_id` (already exists) — retained for reference.
- `device_uuid` (already exists) — retained for the one-time migration of pre-Firebase browser users.
- `email` — stored for magic-link users; also available from Google JWT claims.
- `display_name` — display name from Google (cosmetic, nullable).

> **Future-proofing:** `apple.com` is a valid Firebase provider string. Adding Apple Sign-In later requires no schema changes — just enabling it in the Firebase console and adding the client-side button.

---

## Backend Changes

### New dependency

Add `firebase-admin` to `requirements.txt`. Initialize once at app startup using a service account JSON in the environment variable `FIREBASE_SERVICE_ACCOUNT_JSON`. If the env var is missing or malformed, the app must **fail fast at startup** with a clear error message — do not silently fall back.

### New environment variables

```
FIREBASE_SERVICE_ACCOUNT_JSON=<full JSON string of the service account key>
FIREBASE_PROJECT_ID=<project id>
```

Also update `backend/.env.example` with these keys (values left blank).

### Auth dependency (`dependencies.py`)

Replace `get_current_user_id()` with `get_current_user()`:

1. Reads `Authorization: Bearer <firebase_id_token>` header.
2. Calls `firebase_admin.auth.verify_id_token(token)` — validates signature, expiry, and audience.
3. Extracts `uid`, `provider_id`, `email`, `name` from the decoded claims.
4. Looks up the user by `firebase_uid`. If not found, creates the row.
5. Returns the internal `user_id` UUID — all existing routers are unchanged downstream.

**Backward compat:** Also accepts the legacy `X-User-ID` header during the transition window. Both paths resolve to the same `user_id` return type so no router changes are needed. Bearer token takes precedence if both headers are present.

### `POST /users` endpoint (`routers/users.py`)

Keep the endpoint. The old `device_uuid` creation path stays as a fallback during the transition window. After Phase 3, this endpoint can be removed or repurposed — it becomes redundant because `get_current_user()` auto-creates the user row on first authenticated request.

### New endpoint: `POST /users/migrate` (`routers/users.py`)

One-time migration for pre-Firebase browser users who already have data.

- **Auth:** Bearer token (client calls `signInAnonymously()` first, then sends the resulting token).
- **Body:** `{ "device_uuid": "<string>" }`
- **Logic:** find the user row by `device_uuid`; verify `firebase_uid` is not already claimed by another row; write `firebase_uid` onto it; return existing `user_id`.
- **Idempotent:** if `firebase_uid` already matches, return success.
- **If `device_uuid` not found in DB:** return 404. Client treats this as "no prior data" and proceeds as a fresh anonymous user — does not retry.

### Unit tests (`backend/tests/unit/`)

New unit tests required for:
- `get_current_user()` — Bearer token path, legacy `X-User-ID` path, missing token → 401, invalid token → 401.
- `POST /users/migrate` — success, idempotent repeat, `device_uuid` not found, `firebase_uid` already claimed by a different user.

---

## Browser Frontend Changes

### New environment variables

The Firebase web SDK requires config values. Add to `frontend/.env.example` (values blank):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### New files

| File | Purpose |
|------|---------|
| `src/firebase.ts` | Firebase app init + auth instance export |
| `src/context/AuthContext.tsx` | Wraps app; exposes `user`, `sendMagicLink()`, `signInWithGoogle()`, `linkAccount()`, `signOut()` |
| `src/pages/LoginPage.tsx` | Sign-in screen shown only after explicit sign-out. Options: **Google** and **Magic Link** only — no anonymous option (anonymous is the automatic default, not a user choice). |
| `src/hooks/useAuth.ts` | Thin hook over `AuthContext` |

### Changed files

| File | Change |
|------|--------|
| `src/api/client.ts` | Replace sync `X-User-ID` header with async `Authorization: Bearer <token>`. `apiFetch` calls `await auth.currentUser?.getIdToken()` at the top of each request — the SDK returns a cached token and refreshes transparently when near expiry. |
| `src/hooks/useUser.ts` | Replace `device_uuid` / `user_id` localStorage bootstrap with Firebase `onAuthStateChanged` listener. On first load with no session, auto-call `signInAnonymously()` — zero-friction, same UX as today. |
| `src/App.tsx` | Wrap with `AuthProvider`. Route guard: auth state explicitly null (post sign-out) → `LoginPage`; anonymous and named users go straight to tasks. |
| `src/pages/SettingsPage.tsx` | Add "Account" section: current provider, email (if set), "Upgrade account" button (Google / Magic Link). **Sign out button is only shown for non-anonymous users** (Google / Magic Link). Anonymous users have no sign-out option. |

### Sign-in UX

Anonymous users land directly in the app — no login screen, same as today. Firebase persists the anonymous UID in `indexedDB`, so they are automatically restored on every return visit to the same browser.

The `LoginPage` only appears when auth state is explicitly null — i.e., a named user has deliberately signed out. It offers Google and Magic Link sign-in only.

### Unit tests (`frontend/src/__tests__/`)

New unit tests required for:
- `AuthContext` — anonymous auto-sign-in on first load, sign-out only rendered for non-anonymous users.
- `client.ts` — `apiFetch` attaches Bearer token, handles missing `currentUser` gracefully.

---

## One-Time Data Migration for Existing Browser Users

**The problem:** existing browser users have a `device_uuid` in `localStorage` and a matching `users` row. Firebase assigns them a new anonymous `uid`. Without bridging these, their existing tasks become unreachable.

**The flow — client-driven, silent, on first load after the upgrade:**

1. `useUser.ts` checks `localStorage` for a `device_uuid` (old key) and absence of a Firebase session.
2. If found: calls `auth.signInAnonymously()` to get a new Firebase `uid`. Use `getIdToken(true)` (force refresh) to ensure a fresh token before the migrate call.
3. Calls `POST /users/migrate` with the Firebase Bearer token + `{ device_uuid }` in the body.
4. On success: backend stitches the `firebase_uid` onto the existing user row. Client clears `device_uuid` and `user_id` from `localStorage`. From this point on, all auth is by Firebase token.
5. On 404 (no matching row): treat as fresh anonymous user, clear `device_uuid` from `localStorage`, proceed normally.

The user sees nothing — their tasks appear as always.

---

## Deployment Order

### Phase 1 — Backend (non-breaking, deploy first)

**Pre-deploy:** run these SQL statements against the live database:
```sql
ALTER TABLE users ADD COLUMN firebase_uid VARCHAR UNIQUE;
ALTER TABLE users ADD COLUMN email        VARCHAR;
ALTER TABLE users ADD COLUMN display_name VARCHAR;
```

**Then deploy:**
- `firebase-admin` added to `requirements.txt`, initialized in `main.py` (fails fast if env var missing).
- `dependencies.py` updated to support both `Authorization: Bearer` and legacy `X-User-ID`.
- `POST /users/migrate` endpoint added.
- `backend/.env.example` updated with new env vars.

Existing browser frontend continues to work on `X-User-ID` with no changes.

### Phase 2 — Browser frontend

- Frontend env vars added (`VITE_FIREBASE_*`).
- Firebase init, `AuthContext`, `LoginPage`, `useAuth` hook.
- `client.ts` switched to async Bearer token.
- `useUser.ts` migration flow.
- `SettingsPage.tsx` account section (sign-out for non-anonymous users only).
- `App.tsx` wrapped with `AuthProvider`.

### Phase 3 — Cleanup (within days of Phase 2 being stable in production)

- Remove `X-User-ID` header support from `dependencies.py`.
- Remove `device_uuid` bootstrap and migration flow from `useUser.ts`.
- Remove `user_id` and `device_uuid` reads from `localStorage` (both now unused).
- `device_uuid` column retained in DB (historical data); no longer written or read.

---

## Security Notes

- Firebase ID tokens expire after **1 hour**. `user.getIdToken()` (no `forceRefresh`) returns a cached token and refreshes transparently — call it on every request.
- `FIREBASE_SERVICE_ACCOUNT_JSON` must never be committed or logged. Confirm set/unset only in logs.
- Magic link emails are sent by Firebase's default mailer at no cost. Custom domain/branding requires a third-party SMTP integration (e.g., SendGrid via Firebase Extensions).
