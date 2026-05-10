# Copilot Instructions — fasttrack.ourstuff.space

This file provides project-specific guidance for GitHub Copilot and coding agents working on this repository.

---

## Project Overview

**fasttrack.ourstuff.space** is a public JavaScript/HTML/CSS progressive web app (PWA) for fasting tracking with AI-powered coaching features.

- **Stack:** Vanilla JS (ES modules), HTML, CSS (Tailwind via CDN), Firebase (auth + Firestore), js-yaml
- **AI providers:** OpenAI (default) and BYO (bring-your-own endpoint). Logic is in `script.js`.
- **Encryption:** All user state and notes are AES-GCM encrypted client-side before being written to Firestore.
- **Service worker:** `sw.js` caches `index.html` and `script.js` (cache name `fasting-tracker-v2`).

---

## Key Files

| File | Purpose |
|---|---|
| `script.js` | All app logic: state, AI calls, encryption, UI rendering |
| `index.html` | App shell and all HTML markup |
| `style.css` | Custom styles beyond Tailwind utilities |
| `sw.js` | Service worker for offline caching |
| `RECOMMENDATIONS.md` | AI cost/usage recommendations and implementation status |
| `ISSUES_TRACKER.md` | Known issues, completed work, and open items |

---

## Coding Conventions

- **No build step.** This is a single-page app served as static files. Do not add bundlers, transpilers, or build pipelines unless explicitly requested.
- **ES modules only.** All JS is `type="module"`. Use `import`/`export` syntax.
- **No external dependencies beyond existing CDN imports.** Do not add new npm packages to the runtime app.
- **Biome** is used for formatting and linting (`npm run lint`). Run it before committing.
- **Validation:** `npm run lint` (biome + html-validate + stylelint + eslint). `npm test` intentionally exits with "Error: no test specified" — there are no automated tests.
- **Comments:** Match the style of surrounding code. Only add comments to explain non-obvious logic.

---

## AI Features

### Call sites (`script.js`)
All AI requests go through `callAIChatCompletions({systemPrompt, userPrompt, purpose, ...})`.

Payload helpers:
- `compactAIContext(obj)` — serialize a payload as compact JSON, stripping null/empty values. **Always use this** instead of `JSON.stringify(payload, null, 2)` for AI payloads.
- `buildFastingScheduleContext()` — current/default fast types only (no full type list).
- `buildTrainerActiveFastContext()` — active fast state with phase info.
- `buildTrainerContinuityContext(range, provider)` — notes + completed fasts for trainer continuity.
- `buildGoalRecommendationProfile()` — user goal/metrics profile.

### Per-tool provider routing
Each AI tool can be assigned to either OpenAI or Custom (BYO) independently via **Settings → AI Features → Per-tool model provider**. The matrix is stored in `state.settings.aiToolProviders` (`trainerNote`, `trainerQuickQuestion`, `trainerConversation`, `recommendation`, `nutritionEstimate`).

Use `getAIToolProvider(toolKey)` to read the effective provider for a tool (falls back to global `llmProvider`). Use `getAITrainerProviderOverride(toolKey)` for trainer tools — it respects the session-level override if active, otherwise falls back to the per-tool setting.

### Cheaper model routing
- `OPENAI_EXTRACTION_MODEL` is set to the cheapest available OpenAI model.
- Pass `modelOverride: OPENAI_EXTRACTION_MODEL` to `callAIChatCompletions` for narrow JSON-extraction tasks (e.g. calorie/nutrition estimation).
- `modelOverride` is **ignored for BYO providers** — always safe to pass.

### Token usage
After every AI call, `usage` is logged to the browser console:
```
[AI] <purpose> — prompt_tokens: N, completion_tokens: N, total_tokens: N
```
Use these logs to measure the impact of future optimizations.

---

## Required Project Files

The following files **must always be present and up to date**:

### `RECOMMENDATIONS.md`
Documents AI cost/usage recommendations with implementation status (✅ done, ⏭️ deferred, ❌ not started). Update when implementing or deferring any recommendation.

### `COPILOT_INSTRUCTIONS.md`
This file. Update when conventions, architecture, or key patterns change.

### `ISSUES_TRACKER.md`
Tracks completed work, newly discovered issues, and open/deferred items. **Always update `ISSUES_TRACKER.md`** when:
- Completing a task (move to "Completed")
- Discovering a bug or regression (add to "Open Issues")
- Deferring a planned item (add to "Deferred")

---

## Encryption Notes

- `createNote()` / `updateNote()` may throw `'missing-key'` from `encryptNotePayload`. Callers should catch and call `handleNotesDecryptError(err)`.
- User state is encrypted with a password-derived AES-GCM key (PBKDF2, 310 000 iterations).

---

## Do Not

- Do not add `console.log` for user-visible or sensitive data.
- Do not change the Firestore schema without updating the encryption/decryption path.
- Do not use `JSON.stringify(payload, null, 2)` for AI payloads — use `compactAIContext` instead.
- Do not send `availableFastTypes` or `physiologyNotes` in per-request AI payloads.
- Do not send `previousAITrainerNotes` in trainer context — it duplicates `notes`.
