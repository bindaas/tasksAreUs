# PLAN: Markdown preview for Task Details (Notes field)

**Branch**: `feat-task-notes-markdown`

## Scope revision — 2026-07-31

Original scope (below) was web-only, on the mistaken assumption that mobile was a deferred/future platform. That assumption was wrong — `mobile/` is actively developed in parallel with web (confirmed via recent git history: Overdue view, board collapse/expand, task edit form improvements, several shipped in the same PR as web). Leaving mobile untouched would mean any task with Markdown-formatted notes shows raw, unrendered syntax (`**bold**`, `- item`, `# Heading`) when viewed/edited on mobile. Scope is now **web + mobile**, both UI-only, both read via the same `notes` API field.

This escalates the plan-review tier: per `RULES_OF_ENGAGEMENT.MD`, "Deployment order ≠ single component" is a mechanical trigger for **Full tier** review, since this now spans two independently-deployed components (`frontend/` web app and the `mobile/` Expo app), even though every touched file is still UI-only with no data-model or API involvement.

## Scope

### Web (`frontend/src/components/TaskForm.tsx`)

Replace the single "Notes" `<textarea>` (shared by both Add Task and Edit Task, rendered via `frontend/src/pages/TaskDetailPage.tsx`) with a two-pane layout:

- **Left**: the existing editable textarea (unchanged behavior — same `notes` state, same `onChange`, same trimming on submit).
- **Right**: a read-only box rendering the current `notes` value as formatted Markdown, live-updating on every keystroke (no debounce needed — `notes` is already a controlled React state value updated per keystroke, so the preview re-renders naturally on each change).

Applies to both Add and Edit modes, since `TaskForm` is the single shared component for both (`isEditMode = !!initialValues`).

### Mobile (`mobile/src/screens/TaskFormScreen.tsx`)

Mobile has one screen for both Add and Edit (no separate read-only detail view — same pattern as web). Given phone screen width, a true side-by-side layout isn't viable (mirrors why web itself stacks below its `md` breakpoint), so mobile gets a **stacked** layout instead of a second column:

- **Notes edit box**: unchanged, stays exactly as today (plain `<TextInput multiline>`).
- **New: read-only preview box below it**, same width, rendering `notes` as formatted Markdown via a React Native markdown renderer. Empty state shows the same italic gray "Nothing to preview yet" placeholder as web.
- Links tapped inside the rendered preview must call the existing `openTaskLink` helper (`mobile/src/utils/taskLinks.ts`, wraps `Linking.openURL`) rather than any in-app navigation — this reuses the same external-open pattern already used for the form's own Links section (`TaskFormScreen.tsx` line ~326), and avoids the same class of data-loss risk Sneezy flagged for web (a link navigating the user away from an in-progress, unsaved form).
- Editing stays plain-text only on mobile — no dual-pane editing there, just edit box + read-only preview underneath.

## Out of scope

- No backend, data model, or API changes on either platform. `notes` is already stored as free-text on the task; Markdown is purely a client-side rendering interpretation of that same string at display time.
- No changes to any field other than `notes`, on either platform.
- No new mobile screen — reuses the existing `TaskFormScreen.tsx`.

## Dependencies to add

**Web (`frontend/`)**:
- `react-markdown` — renders Markdown to React elements (not `dangerouslySetInnerHTML`), so no separate HTML-sanitization step is needed for XSS safety.
- `remark-gfm` — adds GFM extensions (tables, strikethrough, `- [ ]` task-list checkboxes, autolinks) on top of CommonMark, since task notes plausibly use checklists/strikethrough.
- `@tailwindcss/typography` (dev dependency) — provides `prose`/`prose-sm` utility classes for readable default styling of rendered headings/lists/code/blockquotes, registered in `frontend/tailwind.config.js`'s `plugins` array. Standard pairing for the pinned `tailwindcss: ^3.4.19` is the 0.5.x line; exact version to be confirmed against the npm registry at install time.

**Mobile (`mobile/`)**:
- Maintained fork of `react-native-markdown-display` — **not** the unscoped original package named in earlier drafts of this plan. Sneezy's Full-tier review found the original hasn't published in ~12 months and flagged an open question about compatibility with this project's `newArchEnabled: true` (Expo SDK 54 / New Architecture) setup; the user chose the maintained fork over the stale original. Exact npm package name to be confirmed at implementation time by checking the fork's actual published name on the npm registry (Sneezy's review identified it by GitHub org/repo, `RonRadtke/react-native-markdown-display`, not a confirmed npm package name) — install and do an on-device/simulator smoke test under Expo SDK 54 + New Architecture before committing further.
- `markdown-it-task-lists` (or equivalent `markdown-it` plugin) — the user chose parity over divergence for GFM checklist rendering: the base library is CommonMark + tables/strikethrough only, with no built-in task-list support, so a plugin is required to render `- [ ] item` as an inert checkbox on mobile the same way `remark-gfm` does on web. Wired in via a custom `markdown-it` instance passed to `<Markdown>`.
- Both remain pure-JS/no native modules, preserving **OTA-eligibility** (`eas update`) — no `app.json`/`eas.json` changes needed. To be confirmed at install time.

## UI changes

### Web (`frontend/src/components/TaskForm.tsx`)

- Replace the current `<div>` wrapping the Notes `<label>` + `<textarea>` (currently lines ~233–242) with:
  - A `<label>` "Notes" (unchanged).
  - A responsive grid: `grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch` — stacked (edit on top) below the `md` breakpoint, side-by-side (edit left / preview right) at `md` and above. Rationale: a forced side-by-side at all widths would cramp both boxes into the page's `max-w-xl` (~576px) container on narrow screens. `items-stretch` (grid's default) sizes both cells to the row's tallest content, so the preview box height tracks the textarea's `rows={7}` height without a guessed pixel value.
  - Left cell: the existing `<textarea>`, same props/classes/rows as today.
  - Right cell: a bordered `<div className="h-full max-h-80 overflow-y-auto ...">` (the `h-full` fills the stretched grid row at `md`+; `max-h-80` caps growth at the `grid-cols-1` (stacked, narrow) breakpoint where `h-full` has no definite basis, so a very long note scrolls inside the box instead of growing the page unboundedly), containing:
    - `notes.trim() === ''` → italic gray placeholder text "Nothing to preview yet".
    - otherwise → `<ReactMarkdown remarkPlugins={[remarkGfm]} components={{...}}>{notes}</ReactMarkdown>` wrapped in a `prose prose-sm max-w-none` container, with a `components` override:
      - `a`: renders with `target="_blank" rel="noopener noreferrer"` so a click opens a new tab instead of navigating the SPA away from the in-progress form and discarding unsaved edits (title, dates, links, tags).
      - `input` (GFM task-list checkboxes): forced `disabled` so they render inert, not interactive — to verify at implementation time that this is in fact the library's default and doesn't need an explicit override.
- No changes to `handleSubmit`'s use of `notes` (still trimmed plain text sent to the API unchanged).

### Mobile (`mobile/src/screens/TaskFormScreen.tsx`)

- Below the existing Notes `<TextInput>` (unchanged), add a new `<View>` containing the read-only preview, capped with a `maxHeight` + `ScrollView`/`overflow: 'scroll'` so a very long note can't make the screen arbitrarily tall (mirrors the same decision made for web below).
  - `notes.trim() === ''` → italic gray placeholder Text "Nothing to preview yet", styled consistent with the rest of the form (`border border-gray-300 rounded-xl px-4 py-3`).
  - otherwise → `<Markdown markdownit={customMarkdownIt} onLinkPress={(url) => { openTaskLink(url); return false; }} style={taskNotesMarkdownStyle}>{notes}</Markdown>` from the maintained fork package, imported alongside the existing `openTaskLink` import from `../utils/taskLinks`.
    - `markdownit`: a `markdown-it` instance with `markdown-it-task-lists` (or equivalent) registered, so GFM checklists render as inert checkboxes matching web.
    - `onLinkPress` returning `false` tells the library not to use its own default link-opening behavior, so `openTaskLink`'s external-open (`Linking.openURL`) is the only path taken — confirmed accurate against the library's `onLinkPress` contract by Sneezy's Full-tier review.
    - `style`: an explicit node-type style map (`body`, `heading1`, `link`, `bullet_list`, etc.) using the app's existing indigo-600/gray-300/gray-700 palette — NativeWind `className` does not propagate into this library's internal render tree (same limitation already documented in `ARCHITECTURE.MD` for mobile label badge colors), so without this the preview would use the library's own default look instead of matching the rest of the screen.

## Files to modify

- `frontend/package.json` — add `react-markdown`, `remark-gfm`, `@tailwindcss/typography`.
- `frontend/tailwind.config.js` — register `@tailwindcss/typography` in `plugins`.
- `frontend/src/components/TaskForm.tsx` — the two-pane Notes UI described above.
- `mobile/package.json` — add the maintained `react-native-markdown-display` fork (exact package name TBD at implementation time) and `markdown-it-task-lists`.
- `mobile/src/screens/TaskFormScreen.tsx` — the stacked preview UI described above.
- `frontend/package-lock.json` / `mobile/package-lock.json` — updated automatically by the respective package manager when the above deps are added.

No other files need changes; `TaskDetailPage.tsx` (web) already passes `notes` through `initialValues`/`onSubmit` unchanged, and mobile has no separate read-only task-detail screen (`TaskFormScreen.tsx` is the only screen touching `notes`).

## Test plan

- No new pure utility function is introduced on either platform (this only wires a rendering library into existing form markup), so no unit test is added per this project's convention of targeting pure utilities in `frontend/src/utils/` (web) / equivalent mobile utils dir.
- Manual verification via the `/run` skill, web:
  - Add Task: type into Notes, confirm the right pane renders Markdown live (headers, bold/italic, lists, a GFM checklist, a link).
  - Edit Task (existing task with notes): confirm existing notes render correctly on load, and edits update the preview live.
  - Empty notes: confirm placeholder text shows, and clearing notes back to empty restores it.
  - Clicking a rendered link opens a new tab and does **not** discard in-progress unsaved form edits.
  - GFM task-list checkbox in the preview is inert (not clickable/toggleable).
  - A very long note scrolls within the capped (`max-h-80`) preview box at narrow (stacked) widths rather than growing the page unboundedly.
  - Submit in both modes: confirm the saved/reloaded task's notes are unaffected (still plain text, trimmed) — Markdown rendering must not mutate what's persisted.
  - Narrow vs. wide viewport: confirm stacked layout below `md`, side-by-side at/above `md`.
- Manual verification via the `/run` skill, mobile (iOS or Android simulator/Expo Go):
  - Smoke test the chosen markdown package under Expo SDK 54 + New Architecture (`newArchEnabled: true`) before relying on it further — confirms Sneezy's flagged compatibility question.
  - Add Task: type into Notes, confirm the preview below renders Markdown live, styled with the app's own palette (not the library's default look).
  - Edit Task (existing task with Markdown notes written on web, including a `- [ ]` checklist item): confirm it renders correctly on mobile — including the checklist rendering as an inert checkbox, matching web — proving cross-platform consistency of the same `notes` string.
  - Empty notes: placeholder shows.
  - Tapping a rendered link opens externally (not in-app navigation) and does not discard unsaved form state.
  - A very long note scrolls within the capped preview box rather than growing the screen unboundedly.
  - Submit in both modes: confirm saved/reloaded notes are unaffected.
- `tsc --noEmit` and full Vitest suite must still pass on web (no regressions to existing form tests). Mobile's `jest` (jest-expo preset) suite must still pass.

## Pre-implementation checklist

- Confidence in solution: 4/5 (web portion has been through two review passes; mobile portion now has a settled package choice and checklist-parity plan, but the fork's exact npm name and its New Architecture behavior are unverified until installed and smoke-tested)
- Regression risk: 2/5 (touches two existing, actively-developed shared form components — `TaskForm.tsx` and `TaskFormScreen.tsx` — but only the Notes rendering; submit/trim logic for `notes` is unchanged on both)
- Data model changes: none
- Test changes needed: none (no new pure utility function on either platform); manual browser + simulator verification as above, including an explicit on-device smoke test of the mobile markdown package under New Architecture before relying on it further
- Deployment order: two components, both independent — `frontend/` (web) and `mobile/` (Expo). Neither depends on the other or on any backend/API contract change (none exists here), so they can deploy in either order with no backward-compat window to manage. Recommend web first only because Sneezy has already reviewed it once; not a technical requirement.
- Mobile update type: **OTA** (`eas update`) — both the maintained markdown-display fork and `markdown-it-task-lists` are pure JS/TS with no native modules, and no `app.json`/`eas.json` changes are needed. To be confirmed at install time; if the on-device smoke test surfaces a New Architecture incompatibility, this would need to be revisited before shipping.

## Deploy tagging

- `frontend/` files change → triggers a Railway deploy per `CLAUDE.md` (no `[skip deploy]`).
- `mobile/` changes do not trigger the Railway deploy (per `CLAUDE.md`'s "Does not trigger" list) — mobile ships independently via `eas update`.

---

## Sneezy's Review — 2026-07-31

**Tier:** LIGHT — no proposed file (`frontend/package.json`, `frontend/tailwind.config.js`, `frontend/src/components/TaskForm.tsx`) falls under a model/schema/router/API-contract area; plan declares no data model changes and single-component (frontend-only) deployment. No grounds found during review to escalate — `TaskForm.tsx` has exactly one consumer (`TaskDetailPage.tsx`; the only other repo hit for "TaskForm" is a comment in `frontend/src/api/tasks.ts`), so blast radius is as narrow as the plan claims.

**Verdict:** Approved with concerns

### Issues

1. **[Risk]** `frontend/src/components/TaskForm.tsx` (new right-cell rendering, described at plan lines 32–34) — the plan doesn't address that Markdown links (`[text](url)`) rendered by `react-markdown` produce plain `<a href="...">` tags with no `target`/`rel` override by default. Clicking a rendered link inside the live preview will navigate the whole SPA away from the in-progress Add/Edit Task form, discarding any unsaved edits (title, links, dates, tags) with no confirmation. This is a real, user-reachable data-loss path introduced by this feature and isn't mentioned anywhere in the plan's UI changes or test plan sections.
2. **[Gap]** Plan line 32: "a bordered `<div>` matching the textarea's height (`rows={7}` equivalent via `min-h`)" gives no concrete Tailwind value. `rows={7}` on the textarea combines with `text-sm`/`px-3 py-2` to produce a specific rendered height; the plan leaves translating that to a `min-h-*` utility entirely to implementer judgment, which risks a visually mismatched two-pane layout that has to be eyeballed and fixed post-hoc.
3. **[Nit]** `frontend/package.json` is listed under "Files to modify" but `frontend/package-lock.json` (which will also change once the three new deps are installed) is not mentioned. Cosmetic only — it happens automatically — but the "Files to modify" list isn't fully exhaustive as stated.

### Unverified assumptions

- "no separate HTML-sanitization step is needed for XSS safety" (line 22) — consistent with `react-markdown`'s documented default behavior (renders to React elements, no `dangerouslySetInnerHTML`, no raw HTML pass-through without `rehype-raw`, which the plan doesn't add). Plausible and standard, but not verified against an installed copy of the package since the dependency isn't added yet.
- Implicit assumption that GFM task-list checkboxes (`- [ ]`) render as inert/`disabled` in the preview, not as clickable inputs — this is `react-markdown`'s typical default, but wasn't verified against the actual rendered output since the package isn't installed. Worth a quick manual check during implementation, since a checkbox that looks interactive but silently does nothing (or worse, is genuinely interactive but not wired to update `notes`) inside a `<form>` would be a confusing UX regression.
- "@tailwindcss/typography (dev dependency)... registered in tailwind.config.js's plugins array" against the pinned `tailwindcss: ^3.4.19` (confirmed in `frontend/package.json`) — the 0.5.x line of `@tailwindcss/typography` is the standard pairing for Tailwind v3, but exact version compatibility wasn't checked against the npm registry.

### Suggestions

- Add a custom `a` component override to the `ReactMarkdown` instance (`components={{ a: ... }}`) that sets `target="_blank" rel="noopener noreferrer"` at minimum, so an accidental click opens a new tab instead of navigating away from unsaved form state. A `preventDefault` + confirm-if-dirty guard would be even safer but may be overkill for this feature's scope.
- Replace "`rows={7}` equivalent via `min-h`" with a concrete class (e.g. `min-h-[168px]` or whatever measured value matches the textarea at `rows={7}` with the shared padding/font-size classes) so implementation doesn't have to reverse-engineer the intended sizing.
- Given `react-markdown` + `remark-gfm` pull in the unified/micromark ecosystem (a non-trivial bundle addition) and this app doesn't currently use any `React.lazy` code-splitting, consider whether the added weight on `TaskDetailPage`'s critical path is acceptable as-is, or whether it's worth a follow-up to lazy-load the preview pane. Not blocking for this plan, but worth a conscious decision rather than a default.

— *Sneezy*

---

## Response to Sneezy's Full-tier review — 2026-07-31

- **Issue 1 (checklist parity risk)**: Addressed. User chose parity over divergence — `markdown-it-task-lists` added as a mobile dependency, wired via a custom `markdown-it` instance passed to `<Markdown>`. See "Dependencies to add" and "UI changes → Mobile".
- **Issue 2 (mobile package health risk)**: Addressed. User chose the maintained fork over the stale original. Exact npm package name is not yet pinned — flagged explicitly as "to be confirmed at implementation time" rather than guessed, since Sneezy's review identified the fork by GitHub org/repo, not a verified npm package name. An on-device/simulator smoke test under Expo SDK 54 + New Architecture is now an explicit step in "Test plan" and the "Mobile update type" checklist line, before relying on the package further.
- **Issue 3 (styling gap)**: Addressed. Explicit `style` prop (node-type style map using the app's existing indigo-600/gray-300/gray-700 palette) added to mobile's `<Markdown>` in "UI changes → Mobile," consistent with the existing NativeWind-limitation pattern documented in `ARCHITECTURE.MD` for mobile label badge colors.
- **Issue 4 (unbounded preview height nit)**: Addressed on both platforms. Web: `max-h-80` added to the right cell's className. Mobile: `maxHeight` + scroll added to the new preview `<View>`.
- **Suggestions**: all four adopted (task-list plugin, explicit style map, max-height decision, deliberate package pick over defaulting to the stale original) — none deferred.

Plan is now considered final pending the user's explicit "Shall I proceed?" approval, per `RULES_OF_ENGAGEMENT.MD`'s Development Plan Lifecycle.

---

## Sneezy's Review — 2026-07-31 (re-review, scope expanded to web + mobile)

**Tier:** FULL — per the "Scope revision" section and Grumpy's stated reasoning: the plan now spans two independently-deployed components (`frontend/` web, `mobile/` Expo app), which mechanically triggers Full tier under `RULES_OF_ENGAGEMENT.MD` ("Deployment order ≠ single component") even though every touched file is UI-only. Confirmed correct on inspection — no grounds to escalate further or de-escalate. Blast radius is as narrow as claimed: `TaskForm.tsx` has exactly one consumer (`TaskDetailPage.tsx`) and `TaskFormScreen.tsx` has exactly one consumer (`TasksScreen.tsx`), verified via grep.

This review (a) re-verifies the three fixes made in response to the prior LIGHT-tier findings, and (b) reviews the new mobile content on its own merits, including live verification of third-party library behavior via the library's own README/docs (not just the plan's claims about it).

### Re-verification of prior LIGHT-tier findings

1. **Link target/rel (prior Issue 1)** — Addressed. Plan line 58 now specifies `target="_blank" rel="noopener noreferrer"` on the `a` component override. Additionally verified (see Unverified assumptions below) that `react-markdown`'s default `urlTransform` independently blocks dangerous URL schemes (`javascript:`, `data:`, etc.), which the original LIGHT review did not check — so the link-click risk is closed on two independent layers, not just one.
2. **Min-height gap (prior Issue 2)** — Addressed via a materially better mechanism than the suggested fix: `items-stretch` on the grid container + `h-full` on the right cell (lines 53, 55), rather than a guessed pixel `min-h`. This correctly tracks the textarea's actual rendered height at the `md`+ breakpoint (grid items stretch to the row's tallest content by construction) and degrades gracefully below `md` (where the two cells are in separate rows, so `h-full` has no definite basis and the box simply sizes to its own content) — confirmed sound by reasoning through CSS Grid's percentage-height/containing-block rules. One residual gap not addressed: at `grid-cols-1` widths (including the entire mobile-web viewport range), `overflow-y-auto` has nothing to actually constrain against, so a very long Markdown note can make the preview panel — and the page — arbitrarily tall. See Issues below.
3. **package-lock.json nit (prior Issue 3)** — Addressed. Plan line 76 now lists both `frontend/package-lock.json` and `mobile/package-lock.json` explicitly. Confirmed both platforms use npm (`package-lock.json` present, no `yarn.lock`/`pnpm-lock.yaml` in either directory).

### Issues

1. **[Risk]** Plan lines 27, 41, 66–67, 93 — `react-native-markdown-display` does **not** support GFM task-list checkboxes (`- [ ] item`) out of the box; verified against the library's own README (fetched directly): it is "100% compatible CommonMark" plus tables and strikethrough built in, but task lists require an additional `markdown-it` plugin (e.g. `markdown-it-task-lists`) that is not in this plan's dependency list. The plan's framing at lines 66–67 ("verify at implementation time whether it renders them inert by default; if not, override") presumes checkboxes render as *something* interactive that just needs disabling — the actual likely outcome is that `- [ ] Buy milk` renders as a plain bullet with the literal text `[ ] Buy milk`, not a checkbox at all. This directly undermines the plan's own test-plan claim at line 93 ("Edit Task (existing task with Markdown notes written on web): confirm it renders correctly on mobile, proving cross-platform consistency") for any note that uses a checklist — web (via `remark-gfm`) will render a real, inert checkbox; mobile will render raw bracket text for the same string. Since checklists are explicitly named as a reason for adding `remark-gfm` on web (line 41), this is a real, foreseeable content-type where the two platforms will visibly diverge, not just a `to verify at implementation time` footnote.
2. **[Risk]** Plan line 45 — the plan asserts `react-native-markdown-display` is a sound, OTA-safe choice but doesn't verify the package's health. Live lookup shows the unscoped `react-native-markdown-display` package (the exact name in the plan) has not published a new version in roughly the last 12 months, and an actively-maintained fork exists under a different package name (`RonRadtke/react-native-markdown-display`, published under a scoped/renamed npm package). Some third-party sources also raise a New Architecture (Fabric) compatibility question for the original package — this project has `newArchEnabled: true` in `mobile/app.json`. The pure-JS-dependency-tree argument for OTA-eligibility (verified independently below) still holds regardless of which fork is chosen, but the choice of *which* package to install is not actually settled by this plan and should be a concrete decision (with an on-device/simulator smoke test under Expo SDK 54 + New Architecture) rather than an implicit default.
3. **[Gap]** Plan's mobile "UI changes" section (lines 62–67) specifies no `style` prop for `<Markdown>`. Unlike web's `prose prose-sm` Tailwind styling, NativeWind's `className` does not propagate into `react-native-markdown-display`'s internally-rendered `View`/`Text` tree (the library expects a `style` prop object keyed by node type — `body`, `heading1`, `link`, `bullet_list`, etc. — not a `className`). This is the same category of limitation `ARCHITECTURE.MD` already documents elsewhere ("Mobile label badge colors (NativeWind)": "Dynamic Tailwind class interpolation is unsafe in NativeWind v4... inline `style` props" is "the approved pattern"). Without an explicit style map, the rendered preview will use the library's own default look (its own default link/heading colors and spacing) rather than the app's indigo-600/gray-300 design language used everywhere else on this screen.
4. **[Nit]** Carried forward from re-verification item 2 above: no max-height/scroll cap on the preview box at narrow (`grid-cols-1`) web widths or on mobile (where the preview is a plain stacked `View`, not height-matched to anything) — a very long note produces an arbitrarily tall page/screen. Minor, but worth a conscious `max-h-*` + scroll decision rather than an implicit unbounded box, especially on mobile where `notes` has no length cap at the schema level (`TEXT`, nullable, per `DATA_MODEL_AND_API.MD`).

### Unverified assumptions

- **Now confirmed (was unverified in the prior LIGHT review):** "no separate HTML-sanitization step is needed for XSS safety" — verified against `react-markdown`'s own documentation: it applies a `defaultUrlTransform` to all link/image URLs by default (independent of the plan's own `components={{ a: ... }}` override, which only adds `target`/`rel` attributes and doesn't touch URL transformation), allowing only `http`, `https`, `irc`, `ircs`, `mailto`, `xmpp`, and same-protocol-relative URLs — `javascript:`/`data:` links typed into a task's free-text Notes are blocked from executing on click by default, with no `rehype-sanitize` needed. This closes what would otherwise be a real (if low-severity, single-tenant, self-XSS-only) gap.
- **Confirmed:** `react-native-markdown-display`'s `onLinkPress(url)` contract matches the plan's description exactly (line 66) — returning `false` suppresses the library's own `Linking.openURL` call, handing full control to the caller (`openTaskLink`). Returning `true` would trigger the library's own open. The plan's choice to return `false` and delegate entirely to the existing, already-vetted `openTaskLink()` (which itself re-validates the URL scheme via the same `http(s)`-only regex used for the dedicated Links field before calling `Linking.openURL`) is sound and arguably safer than web's default-`urlTransform` allowlist, since it's stricter (http/https only, vs. web's broader allowlist including `mailto`/`irc`/`xmpp`).
- **Confirmed:** the claimed OTA-eligibility (plan line 45) is structurally sound — `react-native-markdown-display`'s dependency tree (`markdown-it`, `css-to-react-native`, `prop-types`, `react-native-fit-image`) is pure JS with no native linking step (`react-native-fit-image` itself only calls the core `Image.getSize` API, already present in every RN app), and `mobile/app.json`'s `runtimeVersion.policy` is `"appVersion"` (not `"fingerprint"`), so adding this JS-only dependency does not by itself force a new native build — provided `app.json`'s `version` field isn't bumped as part of this change (not mentioned either way in the plan, but consistent with "no native changes needed").
- **Still unverified** (plan already flags this as "to be confirmed at install time," unchanged since the LIGHT review): `@tailwindcss/typography`'s exact version compatibility with the pinned `tailwindcss: ^3.4.19`.
- **Newly unverified:** whether `react-native-markdown-display` (the specific, unscoped package the plan names) actually renders correctly under Expo SDK 54 / RN 0.81.5 with `newArchEnabled: true` — see Issue 2. Not something that can be confirmed by reading docs alone; needs an on-device/simulator check during implementation.

### Suggestions

- If checklist notes are a meaningfully common case (the plan's own rationale for adding `remark-gfm` on web suggests they are), consider passing a custom `markdownit` instance to `<Markdown>` on mobile with a task-list plugin registered, to achieve genuine parity with web rather than accepting silent divergence for that one syntax.
- Add an explicit `style` prop to mobile's `<Markdown>` mapping key node types to the app's existing indigo-600/gray-300/gray-700 palette, for visual consistency with the rest of `TaskFormScreen.tsx`.
- Decide and state a `max-height` + scroll behavior for the preview box at narrow web widths and on mobile, rather than leaving it unbounded by default.
- Before implementation, do a quick side-by-side check of `react-native-markdown-display` vs. its maintained fork (`RonRadtke/react-native-markdown-display`) for current maintenance status and New Architecture compatibility, and pin whichever is chosen deliberately rather than defaulting to the first search result.

— *Sneezy*

---

## Response to Sneezy's Full-tier re-review — 2026-08-01

- **Issue 1 (checklist parity gap)**: Addressed. `markdown-it-task-lists` added as a mobile dependency, wired via a custom `MarkdownIt` instance. The renderer family used has no default `html_inline` rule, so a `rules.html_inline` override was added to actually render the plugin's injected `<input type="checkbox">` HTML strings as inert checkboxes instead of letting them fall through to `unknown: () => null`. See `mobile/src/screens/TaskFormScreen.tsx`.
- **Issue 2 (mobile package health / New Architecture risk)**: Partially addressed, with a deviation from this plan's named candidate. At implementation time, neither `react-native-markdown-display` nor the fork Sneezy identified by GitHub org/repo (`RonRadtke/react-native-markdown-display`) was used — a further registry check at install time found `@believer/react-native-markdown-display`, which has a smaller dependency footprint (`markdown-it` only, no `@react-native-vector-icons/material-design-icons` → `@expo/config-plugins` chain that would force a native rebuild) and peer deps matching this project exactly (`react >=19`, `react-native >=0.80`). This was a reasonable implementation-time judgment call within the plan's own authorization to confirm the exact package at install time, but it means **no review round — LIGHT or FULL — has evaluated this specific package by name**, and the on-device/simulator smoke test under Expo SDK 54 + New Architecture that this plan (line 111), the "Mobile update type" checklist (line 113), and both Sneezy reviews (line 97, line 177) require "before relying on the package further" has **not been run** in the implementation environment (no simulator available). This is flagged as an open item in the PR body's test-plan checklist and in Dopey's code review; it is not resolved by this response and must be completed before the mobile bundle ships via `eas update`.
- **Issue 3 (styling gap)**: Addressed. Explicit `style` prop (`notesMarkdownStyle`, a node-type map using the app's indigo-600/gray-300/gray-700 palette) passed to `<Markdown>`.
- **Issue 4 (unbounded preview height nit)**: Addressed. Mobile preview `<View>` capped at `maxHeight: 200` with a nested `ScrollView`.
- **Suggestions**: all four adopted (task-list plugin, style map, height cap, deliberate package pick) — the package pick landed on a third option not named in either review, per Issue 2 above, rather than either of Sneezy's two candidates.

— *Grumpy*
