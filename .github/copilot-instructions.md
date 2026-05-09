# GitHub Copilot Instructions — Fast Track

> Read this file before suggesting any code for this repository.

---

## What This App Is

**Fast Track** is a progressive web app (PWA) for intermittent fasting and nutrition tracking. Key facts:

- **No build step.** Native ES modules, CDN imports (Firebase v9, js-yaml, Tailwind CDN). No Webpack/Vite/Rollup.
- **Firebase backend.** Firestore for cloud sync, Firebase Auth for user accounts.
- **End-to-end encryption.** All user data is encrypted client-side with AES-256-GCM before writing to Firestore. Never log, return, or suggest storing plaintext passwords or unencrypted state.
- **PWA.** Service worker (`sw.js`) caches assets. When adding new JS files, update the asset list in `sw.js`.
- **No framework.** Plain DOM manipulation — `document.getElementById()` aliased as `$()`. No React, Vue, Svelte, etc.
- **Data from YAML.** Fast types, themes, hourly fasting data, and calorie tips come from `.yaml` files fetched at runtime.

---

## Repository Layout (Current → Target)

The app is being modularized from a single `script.js` (~5,400 lines) into focused ES modules under `js/`. See `docs/MODULARIZATION.md` for the full phased plan.

**Current files:**
```
script.js            ← monolith being split across phases
index.html           ← all markup
style.css            ← all custom CSS
firebase-config.js   ← exposes window.FIREBASE_CONFIG
sw.js                ← service worker
*.yaml               ← runtime data files
```

**Target module layout (add files here as phases complete):**
```
js/
  config.js    ← constants, field arrays, default state
  utils.js     ← pure helpers, formatters, date utilities
  crypto.js    ← encryption, key derivation, device key wrap
  firebase.js  ← Firebase init, Firestore doc-ref helpers
  state.js     ← load/save/merge/normalize app state
  auth.js      ← auth UI, listener, sign-in/sign-up/reset flows
  loader.js    ← YAML fetch, parse, normalize
  ai.js        ← OpenAI model list, calorie estimation
  fasting.js   ← fast start/stop, timer, milestones, ring
  calories.js  ← calorie ring, nutrition tracker, tips
  notes.js     ← notes CRUD, editor, overlay, post-fast modal
  history.js   ← calendar, history list, CSV export
  settings.js  ← settings panel, theme picker, OpenAI config
  alerts.js    ← push notifications, alerts opt-in
  ui.js        ← tabs, toast, modals, nav tooltips, buttons
  theme.js     ← CSS var application, preset resolution
  render.js    ← entry point: initApp(), renderAll()
```

---

## Coding Rules

### 1. KISS — Keep It Simple, Stupid
- Prefer the simplest solution that works. No clever abstractions.
- If a helper function is used in only one place, keep it inline until it's needed elsewhere.
- No event bus, no reactive store, no pub/sub — use plain function calls.

### 2. ES Modules Only
- Every file uses `export` and `import`. No `window.*` globals except `window.FIREBASE_CONFIG` (legacy, being phased out).
- Use named exports. Avoid default exports.
- Import from CDN URLs exactly as they appear in the existing code (Firebase v9, js-yaml). Don't change CDN versions without updating `sw.js`.

### 3. Module Dependency Direction
Dependencies flow **downward only**:
```
render.js → features → state/crypto/firebase → utils/config
```
Lower-level modules (config, utils, crypto) must never import from feature modules. If you find yourself needing to, that's a design smell — restructure.

### 4. DOM Access
- Always use `$(id)` (the `document.getElementById` shorthand) for element lookups.
- Guard every DOM access: `const el = $('my-id'); if (!el) return;`
- Don't cache DOM references at module load time — the DOM may not be ready. Cache inside functions that run post-DOMContentLoaded.

### 5. State Management
- App state lives in the `state` object (defined in `js/state.js` post-modularization, `script.js` pre-modularization).
- Always call `saveState()` after mutating state.
- Never mutate state directly from UI event handlers — call a named function.

### 6. Security — Non-Negotiable
- **Never** log, return, or suggest logging: passwords, raw encryption keys, decrypted state, API keys.
- All writes to Firestore go through `encryptStatePayload()` or `encryptNotePayload()`.
- The OpenAI API key is encrypted at rest via `saveSecureKey()`. Never store it in state in plaintext.
- Don't introduce `eval()`, `innerHTML` assignments from user input, or any XSS vector.
- Don't add new `window.*` globals.

### 7. Error Handling
- Every `async` function must have a `try/catch` or be called inside one.
- Surface errors to the user via `showToast(msg)` — not `alert()`.
- Log errors with `console.error(...)` including context, but never log sensitive values.

### 8. CSS & Styling
- Tailwind utility classes are used for layout and spacing.
- Custom CSS lives in `style.css` using CSS custom properties (`var(--primary-color)`, etc.).
- Theme colors are applied dynamically by `applyThemeColors()` — don't hardcode color values in JS.
- Don't add inline `style` attributes to HTML elements unless absolutely necessary for dynamic values (e.g., `strokeDashoffset`).

### 9. YAML Data Files
- `fast-types.yaml`, `themes.yaml`, `fasting-hourly.yaml`, `calorie-tips.yaml` are the source of truth for content.
- Never hardcode fast-type lists, theme presets, or tip content in JS — keep it in the YAML files.
- All YAML data goes through a normalizer function before use (see `normalizeFastingHourly`, `normalizeCalorieTips`, etc.).

### 10. Linting
- Run `npm run lint` after every change. All lint errors must be resolved before committing.
- The linter stack is: **Biome** (format + lint), **html-validate** (HTML), **stylelint** (CSS), **ESLint** (JS).
- Don't disable lint rules with `// eslint-disable` or `/* stylelint-disable */` comments unless there is a genuine false positive, and document why.

---

## Modularization Phase Tracking

When working on the modularization described in `docs/MODULARIZATION.md`:

- Work **one phase at a time**. Don't mix phase work.
- At the end of each phase, run `npm run lint` and do a browser smoke-test.
- Commit with message format: `refactor(phase-N): <description>` (e.g., `refactor(phase-1): extract constants to js/config.js`)
- Check off completed items in `docs/MODULARIZATION.md` as each phase finishes.
- Never delete `script.js` until Phase 10 is complete and all features are confirmed working from the new modules.

---

## Feature Inventory (What the App Does)

Use this as a reference when adding or modifying features:

| Feature | Key Functions | Data |
|---|---|---|
| Auth | `initAuthUI`, `handleAuthSubmit`, `completeAuthFlow` | Firebase Auth |
| Fast Timer | `startFast`, `stopFastAndLog`, `updateTimer`, `startTick` | `state.activeFast` |
| Fast Types | `initFastTypeChips`, `getTypeById`, `applyTypeToActiveFast` | `fast-types.yaml` |
| Milestones | `buildMilestones`, `trackMilestoneProgress`, `renderRingEmojis` | `fasting-hourly.yaml` |
| Calorie Tracking | `initCalories`, `renderCalories`, `renderCalorieRing` | `state.settings.calories` |
| Nutrition Tracker | `renderNutritionTracker`, `getNoteNutritionTotalsForDateKey` | Notes' `calorieEntry` |
| Calorie Tips | `renderCalorieTipOrbs`, `selectCalorieTip` | `calorie-tips.yaml` |
| AI Estimation | `estimateCaloriesWithAI`, `loadOpenAIModels` | OpenAI API |
| Notes | `createNote`, `updateNote`, `deleteNote`, `openNoteEditor` | Firestore `notes` collection |
| Calendar | `renderCalendar`, `buildDayFastMap`, `renderDayDetails` | `state.history` + notes |
| History | `renderRecentFasts`, `openEditHistoryModal`, `exportCSV` | `state.history` |
| Settings | `initSettings`, `renderSettings` | `state.settings` |
| Themes | `applyThemeColors`, `setThemePreset` | `themes.yaml` |
| Alerts | `onAlertsButton`, `sendNotification`, `handleAlerts` | Service Worker |
| Encryption | `encryptStatePayload`, `decryptStatePayload`, `deriveKeyFromPassword` | IndexedDB + localStorage |

---

## Common Patterns

### Fetching and parsing a YAML file
```js
const response = await fetch('./data.yaml', { cache: 'no-store' });
if (!response.ok) throw new Error(`data.yaml failed (${response.status})`);
const data = loadYaml(await response.text());
```

### Safe DOM update
```js
const el = $('element-id');
if (!el) return;
el.textContent = value;
```

### Show user feedback
```js
showToast('Your message here');
```

### Save state after mutation
```js
state.settings.someValue = newValue;
await saveState();
renderAll();
```

### Adding a new YAML-driven data type
1. Add the `.yaml` file to the root directory.
2. Add a loader function in `js/loader.js` (or `script.js` pre-modularization) that fetches and normalizes it.
3. Add it to the `ASSETS` array in `sw.js`.
4. Call the loader in `initApp()`.

---

## What to Avoid

- ❌ `window.*` globals (except reading `window.FIREBASE_CONFIG`)
- ❌ `innerHTML` with user-controlled content
- ❌ Hardcoding color values, fast type lists, or tip content in JS
- ❌ `console.log` of any sensitive data (passwords, keys, decrypted payloads)
- ❌ Circular imports between modules
- ❌ Adding npm runtime dependencies (devDependencies for linting are OK)
- ❌ Build tools (Webpack, Vite, Rollup) unless the team explicitly decides
- ❌ `alert()` or `confirm()` — use the existing modal/toast patterns
- ❌ Skipping `npm run lint` before committing
