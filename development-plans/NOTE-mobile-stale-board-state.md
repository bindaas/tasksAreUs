# NOTE: latent stale-board-state bug on mobile (not yet planned/fixed)

Same root cause as `PLAN-fix-stale-board-state-on-identity-change.md` (web), but not yet reported or fixed on mobile:

- `mobile/src/context/BoardContext.tsx` fetches boards once per mount (`fetchBoards` in an empty-deps `useEffect`) — same pattern as the web bug.
- `mobile/src/navigation/AppNavigator.tsx` mounts `BoardProvider` gated only on `user !== null`, not remounted on identity change — only remounts on explicit sign-out (which passes through `null`).
- `mobile/src/context/AuthContext.tsx` also auto-signs-in anonymously and can later upgrade to Google/magic-link auth without an intervening `null` emission — same anon→real uid swap as web.

Not yet manifesting as a user-visible bug because mobile's "All"-equivalent view (the `tasks-view-redesign-mobile` plan) hasn't shipped — today's closest view (`viewMode: 'detailed'`) is board-scoped the same way and would likely hit the same failure once reachable, or via any other board-scoped action taken after an anon→real upgrade.

**To do later:** write a proper plan and fix — likely keying the provider tree on `user.uid` in `AppNavigator.tsx`, mirroring the web fix.
