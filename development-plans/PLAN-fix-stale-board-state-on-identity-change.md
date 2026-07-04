# PLAN: fix-stale-board-state-on-identity-change

## Bug report

Brand-new user, fresh laptop (no prior browser/localStorage state), logs in and navigates to the "All" view → gets `Board not found`.

## Root cause

`frontend/src/context/AuthContext.tsx:68-70` auto-signs a first-time visitor in **anonymously** (`signInAnonymously`) for zero-friction onboarding. This is a real Firebase user (uid A), and the backend lazily seeds a default board for it the first time any board-resolving endpoint is hit (`backend/app/services/board_service.py:48-90`, `ensure_board_seeded`).

When the user then actually authenticates (Google popup or magic link), `AuthContext.tsx:97-99` explicitly notes `signInWithPopup` creates a **new, unlinked** Firebase session — a different uid (B). `user` transitions directly from anon-A to real-B without passing through `null`.

`frontend/src/App.tsx:87-104` mounts `FilterProvider` → `BoardProvider` → `ViewProvider` gated only on `user !== null`:
```tsx
if (user === null) return <LoginPage />;
return (
  <FilterProvider>
    <BoardProvider>
      <ViewProvider>
        ...
```
Since both anon-A and real-B are non-null, React never remounts this subtree. `BoardContext.fetchBoards` (`BoardContext.tsx:28-51`) only runs once per mount (empty-deps `useEffect`), so `boards`/`activeBoard` keep referencing anon-A's board.

Clicking "All" (`TasksPage.tsx:103-109`) writes that stale board id into the request; `api/client.ts` attaches uid-B's current token; backend's `resolve_board_id` (`board_service.py:38-44`) filters `Board.id == X AND Board.user_id == B` → no match → `404 "Board not found"`.

Side effect of the same root cause (not separately reported, fixed for free by the same change): `FilterContext`'s `selectedLabelIds` also isn't reset on this transition, since the public `setActiveBoard` wrapper that clears labels is bypassed when `fetchBoards` sets `activeBoard` state directly.

**Confirmed not the cause:** `TaskDetailPage.tsx:29-32` doesn't validate a URL `board` query param against `boards[]` before trusting it — a real latent gap, but not reachable from opening "All" view (the FAB only ever passes a real board id). Left out of scope for this fix.

## Fix (REVISED after Sneezy's review — see responses below)

~~Original proposal: add `key={user.uid}` to `FilterProvider` in `App.tsx`.~~ Superseded — see "Response to Sneezy's Review" section.

**Revised approach:** effect-based refetch instead of provider remount.

- `BoardContext.tsx`: import `useAuthContext`, depend `fetchBoards`'s effect on `user?.uid`, and reset `boards`/`activeBoard` to `[]`/`null` when the uid changes before refetching for the new identity.
- `FilterContext.tsx`: import `useAuthContext`, clear `selectedLabelIds` when `user?.uid` changes.

This re-triggers board/label state for the newly-authenticated identity without unmounting the routed page tree, avoiding the regression Sneezy found (see below). Does not affect normal page reloads (uid stable across reload) or explicit sign-out (already routes through `user === null` → `LoginPage`, which already unmounts the tree).

## Scope

- Files to modify: `frontend/src/context/BoardContext.tsx`, `frontend/src/context/FilterContext.tsx`
- Data model changes: none
- API/contract changes: none
- Test changes: none available — frontend unit tests (`frontend/src/__tests__/`) target pure utility functions only; this is provider-lifecycle/React behavior with no existing harness to cover it. Flagged as a coverage gap, not silently skipped.
- Deployment order: single component (frontend only — no backend or mobile files touched)
- Mobile update type: n/a (no mobile files touched)
- Confidence in solution: 5/5
- Regression risk: 2/5 (no remount, no unmounting of unrelated page state; only new surface is importing `useAuthContext` into two context files)

## Manual verification plan

1. Run the app locally (`/run` skill).
2. Open in a fresh/incognito browser profile (simulates fresh laptop, no prior storage).
3. Load the app → confirm anonymous sign-in happens silently.
4. Sign in with Google (or magic link) to "upgrade" from anonymous.
5. Click the "All" view tab.
6. Confirm tasks load without a "Board not found" error, and the board tab shown belongs to the authenticated account (check `GET /boards` response / DB row `user_id` matches the authenticated uid).

---

## Sneezy's Review — 2026-07-03

**Tier:** LIGHT — sole proposed file (`frontend/src/App.tsx`) is a one-line `key` prop addition, no proposed file falls under a model/schema/router/API-contract area, and the plan declares "Data model changes: none" / "Deployment order: single component". Gate confirmed correct on inspection — no escalation to FULL.

**Verdict:** Approved with concerns

### Issues

1. **[Risk]** `frontend/src/App.tsx:87-105`, `frontend/src/pages/SettingsPage.tsx:407-563` — The plan describes the blast radius of the `key={user.uid}` remount as `FilterProvider → BoardProvider → ViewProvider`, but the actual remounted subtree also includes `BrowserRouter`, `Routes`, `Layout`, and whichever routed page is currently mounted — because they are all nested *inside* `FilterProvider` in the JSX (confirmed by reading `App.tsx:87-105`). The anon→real transition is not confined to `LoginPage`: `SettingsPage.tsx:556-563` (`handleGoogleSignIn`) is a second, real call site of `signInWithGoogle`, reachable while already anonymously "inside" the app (anon `user` is non-null, so the app renders the routed tree, not `LoginPage`). `SettingsPage` holds substantial local, unsaved state at the moment that call resolves — `questions[]`, `modeLabels`/`typeLabels` edits in progress, `magicLinkEmail`, `connStatus`, etc. (`SettingsPage.tsx:415-441`). When `signInWithPopup` resolves and `AuthContext` flips `user` to the new uid, the `key` change unmounts and remounts the very `SettingsPage` instance that initiated the sign-in, silently discarding any in-progress unsaved edits on that page. This is a real regression introduced by the fix (today, without the `key`, that state survives the transition — it's the stale-board data that doesn't refresh). Not a blocker for the reported bug, but the plan's "what does not change" framing is incomplete and should say so explicitly.

2. **[Gap]** Plan's Scope section omits two fields `RULES_OF_ENGAGEMENT.MD` (lines 19-25) mandates for every code change regardless of size: `Confidence in solution: X/5` and `Regression risk: X/5`. Worth adding before presenting the checklist to the user in step 3 of the plan lifecycle.

3. **[Nit]** Minor line-citation drift: `App.tsx:87-104` is cited for the provider-mount block; the actual block is `87-105` (one line short — the closing tag). Immaterial to the fix itself.

### Unverified assumptions

- **Interaction with the recent URL-persistence commit (`abe0216`, "restore URL-based view/board persistence, self-heal stale labels board") is not mentioned anywhere in the plan.** Verified by reading `TasksPage.tsx:79-101`: after the fix's remount, `TasksPage` re-mounts too (it's inside the same subtree, see Issue 1), `viewMode` resets to `'focused'`, and then the restore-effects at lines 81-89 and 91-101 re-read `?view=` / `?board=` from the URL (which still contains the anon session's stale board id, since `BrowserRouter`'s history is window-backed and survives the remount). This *could* re-introduce the exact bug via a second path — but on inspection the `found && found.id !== activeBoard?.id` guard at line 98 makes it a no-op when `boardParam` doesn't match any of the freshly-fetched real-user boards, so no 404 resurfaces. This was not a stated assumption in the plan, but verification shows it holds. Flagging because the plan should have surfaced this recent related change as a checked assumption rather than leaving it for the reviewer to discover.
- Plan asserts `TasksPage.tsx:103-109` is where "Clicking 'All' ... writes that stale board id into the request." Verified: lines 103-109 are actually the `setView` function (not `handleBoardTabSelect` at 111-115, which is a distinct, unrelated handler) — `setView('all')` does write `activeBoard.id` into the `board` URL param at line 107. Citation is correct, just worth noting it points to `setView`, not the board-tab click handler.
- Plan's "Confirmed not the cause" claim about `TaskDetailPage.tsx:29-32` trusting an unvalidated `board` URL param — confirmed accurate (no validation against `boards[]` exists there), and confirmed the FAB (`TasksPage.tsx:119,123`) only ever passes `activeBoard.id` or `defaultBoard.id`, both already-validated real board objects, never raw user input. Claim holds.

### Suggestions

- Consider a one-line addendum to the "what does NOT change" note in the Fix section acknowledging that in-progress local state on the page that triggers the identity upgrade (most likely `SettingsPage`) will be discarded by the remount, and that this is judged an acceptable tradeoff given how rarely a user has unsaved settings edits open at the exact moment they click "Sign in with Google."
- Add the missing `Confidence in solution` / `Regression risk` checklist fields per `RULES_OF_ENGAGEMENT.MD` before presenting to the user.

— *Sneezy*

## Response to Sneezy's Review

1. **[Risk] Remount blast radius / SettingsPage unsaved-state loss** — **Addressed by changing approach.** Dropped the `key={user.uid}` remount entirely in favor of an effect-based refetch in `BoardContext`/`FilterContext` (see revised Fix section). This touches only board/label state and never unmounts `BrowserRouter`/routed pages, so the `SettingsPage.tsx:556-563` sign-in-from-Settings path no longer loses in-progress local state. Root regression eliminated, not just mitigated.
2. **[Gap] Missing Confidence/Regression-risk fields** — **Addressed.** Added to Scope section above.
3. **[Nit] `App.tsx:87-104` vs `87-105` line citation** — **No longer applicable** — `App.tsx` is no longer part of the fix.

### Unverified assumptions responses

- **`abe0216` interaction** — Sneezy verified this holds safely under the (now-abandoned) remount approach via `TasksPage.tsx:98`'s `found &&` guard. Under the revised effect-based approach there's no remount at all, so `TasksPage` never re-mounts and this interaction doesn't arise in the first place — moot.
- **`TasksPage.tsx:103-109` is `setView`, not `handleBoardTabSelect`** — noted, citation confirmed accurate as written.
- **`TaskDetailPage.tsx:29-32` confirmed not the cause** — unchanged, still out of scope for this fix.
