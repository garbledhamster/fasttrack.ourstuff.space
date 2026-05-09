# Fast Track — Modularization Developer Doc

> **Philosophy: KISS (Keep It Simple, Stupid)**
> Every split must earn its place. If a module boundary adds confusion without real separation of concerns, don't add it. Prefer flat, named files over deep folder nesting. LLMs (GPT-5.5+, Opus, Mythos, etc.) should be able to read any single module and fully understand it without needing to jump to five other files.

---

## Current State Snapshot

| File | Lines | Role |
|---|---|---|
| `script.js` | ~5,430 | **Everything** — one monolithic ES module |
| `index.html` | ~777 | All markup, inline Tailwind config |
| `style.css` | ~761 | All custom CSS |
| `firebase-config.js` | 10 | Firebase credentials exposed to window |
| `sw.js` | ~45 | Service-worker cache |
| `*.yaml` | varies | Data files (fast types, themes, calorie tips, hourly data) |

**Root problems:**
- `script.js` mixes constants, state, crypto, auth, UI rendering, and feature logic all in one flat namespace.
- No separation between pure logic and DOM manipulation.
- Hard to add, remove, or test any single feature without touching everything else.
- LLM context windows fill up fast when the whole app lives in one file.

---

## Target Module Layout

```
js/
  config.js          ← constants, field arrays, default state, enums
  utils.js           ← pure helpers: clone, $(), formatters, date utils
  crypto.js          ← key derivation, encrypt/decrypt, device key wrap/unwrap
  firebase.js        ← Firebase init, Firestore doc-ref helpers
  state.js           ← load/save/merge/normalize state, encrypted cache helpers
  auth.js            ← auth UI, auth listener, auth flow, sign-in/sign-up/reset
  loader.js          ← fetch + parse YAML data files (themes, fast-types, hourly, calorie-tips)
  fasting.js         ← fast start/stop, timer tick, milestones, ring progress
  calories.js        ← calorie target, calorie ring, nutrition tracker, calorie tips
  notes.js           ← notes CRUD, note editor, notes overlay/drawer, post-fast note modal
  history.js         ← history list, calendar, day-details panel, edit/delete history entry
  settings.js        ← settings UI, theme picker, OpenAI config, alerts opt-in
  ai.js              ← OpenAI model list, calorie estimation, prompt building
  ui.js              ← tabs, nav tooltips, toast, modals/drawers open/close helpers
  theme.js           ← apply theme colors to CSS vars, preset resolution, legacy migration
  render.js          ← renderAll() and top-level orchestration (imports from all feature modules)
```

`index.html` and `style.css` stay as single files. HTML `<script>` tags switch from one `script.js` to `type="module"` pointing at `js/render.js` (the entry point).

---

## Phased Implementation Plan

Each phase is self-contained. The app must be fully functional at the end of every phase — no broken builds mid-refactor.

---

### Phase 1 — Config & Constants Extraction

**Goal:** Pull every constant, field definition, and default-state object out of `script.js` into `js/config.js`. No logic moves — only data.

#### Checklist

- [ ] Create `js/config.js`
- [ ] Move all `const` declarations that are pure data (not closures, not DOM-dependent):
  - [ ] `ENCRYPTED_CACHE_KEY`, `WRAPPED_KEY_STORAGE_KEY`, `DEVICE_KEY_DB`, `DEVICE_KEY_STORE`, `DEVICE_KEY_ID`
  - [ ] `RING_CIRC`, `ENCRYPTION_VERSION`, `PBKDF2_ITERATIONS`
  - [ ] `_NOTES_SCHEMA`
  - [ ] `DEFAULT_THEME_ID`, `DEFAULT_THEME_COLORS`
  - [ ] `CALORIE_VIEWS`, `MACRO_FIELDS`, `MICRO_FIELDS`, `VITAMIN_FIELDS`
  - [ ] `NUTRIENT_TRACKER_DEFINITIONS`, `NUTRIENT_GOAL_INPUT_FIELDS`, `NOTE_EDITOR_NUTRIENT_FIELDS`
  - [ ] `NUTRIENT_DECIMAL_THRESHOLD`, `NUTRIENT_NUMBER_FORMAT`
  - [ ] `DEFAULT_OPENAI_MODEL`, `OPENAI_REASONING_EFFORTS`, `OPENAI_CHAT_MODEL_PATTERN`, `OPENAI_REASONING_MODEL_PATTERN`
  - [ ] `defaultState` (deep-frozen object, built with `buildDefaultNutrientGoals()`)
  - [ ] `buildDefaultNutrientGoals()` (pure function, move with the data)
- [ ] Export all items from `js/config.js`
- [ ] In `script.js`, replace definitions with `import { … } from './js/config.js'`
- [ ] Run `npm run lint` — must pass
- [ ] Smoke-test the app in a browser — all features still work

---

### Phase 2 — Pure Utilities

**Goal:** Move all side-effect-free helper functions to `js/utils.js`.

#### Checklist

- [ ] Create `js/utils.js`
- [ ] Move pure utility functions:
  - [ ] `$(id)` — `document.getElementById` shorthand
  - [ ] `clone(x)` — JSON deep clone
  - [ ] `isTouchDevice()`
  - [ ] `decodeBase64(base64)` / `encodeBase64(bytes)`
  - [ ] `formatHMS(ms)`, `formatElapsedShort(ms)`, `formatDateTime(d)`, `formatTimeShort(d)`
  - [ ] `formatDateKey(d)`, `parseDateKey(dateKey)`, `toLocalInputValue(d)`
  - [ ] `formatDateTimeLong(date)`, `isSameLocalDay(a, b)`
  - [ ] `startOfMonth(d)`, `getDaysInMonth(d)`, `addMonths(d, amount)`
  - [ ] `formatCalories(value)`, `formatNutrientValue(value, unit)`, `csvCell(v)`
  - [ ] `computeDurationHours(startTs, endTs)`, `mergeTimestamp(existing, incoming, picker)`
  - [ ] `parseCalorieValue(value)`, `parseCalorieInput(value)`, `parseEstimatedNutritionValue(value)`
  - [ ] `formatNutritionInlineSummary(dateKey)`
- [ ] Export all from `js/utils.js`
- [ ] Update `script.js` imports
- [ ] Run `npm run lint` — must pass
- [ ] Smoke-test

---

### Phase 3 — Firebase & Firestore Helpers

**Goal:** Isolate Firebase initialization and all Firestore document-reference helpers.

#### Checklist

- [ ] Create `js/firebase.js`
- [ ] Move Firebase init block (reads `window.FIREBASE_CONFIG`, calls `initializeApp`, `getAuth`, `getFirestore`, `getAnalytics`)
- [ ] Move doc-ref helpers:
  - [ ] `getStateDocRef(uid)`
  - [ ] `getUserDocRef(uid)`
  - [ ] `getNotesCollectionRef(uid)`
  - [ ] `getNoteDocRef(uid, noteId)`
- [ ] Export `auth`, `db`, `firebaseApp` and all ref helpers
- [ ] Update `script.js` imports
- [ ] Run `npm run lint` — must pass
- [ ] Smoke-test auth + Firestore sync

---

### Phase 4 — Crypto Module

**Goal:** Isolate all encryption/decryption logic. This is security-critical — move carefully and test thoroughly.

#### Checklist

- [ ] Create `js/crypto.js`
- [ ] Move all crypto functions:
  - [ ] `deriveKeyFromPassword(password, saltBytes)`
  - [ ] `encryptStatePayload()`
  - [ ] `decryptStatePayload(payload)`
  - [ ] `encryptNotePayload(notePayload)`
  - [ ] `decryptNotePayload(payload)`
  - [ ] `encryptApiKey(apiKeyValue)`
  - [ ] `decryptApiKey(payload)`
  - [ ] `saveSecureKey(keyName, keyValue)`
  - [ ] `loadSecureKeys()`
  - [ ] `openDeviceKeyDb()`
  - [ ] `loadDeviceWrappingKey()`
  - [ ] `saveDeviceWrappingKey(key)`
  - [ ] `getOrCreateDeviceWrappingKey()`
  - [ ] `wrapEncryptionKeyForDevice(uid)`
  - [ ] `unwrapEncryptionKeyFromDevice(uid)`
- [ ] Move crypto-related state vars (`cryptoKey`, `keySalt`, `pendingPassword`, `needsUnlock`) — keep as module-level lets, export getters/setters as needed
- [ ] Move cache helpers:
  - [ ] `getEncryptedCache()` / `setEncryptedCache(payload)`
  - [ ] `getWrappedKeyStorage(uid)` / `setWrappedKeyStorage(uid, payload)` / `clearWrappedKeyStorage(uid)`
- [ ] Export only what other modules need
- [ ] Update `script.js` imports
- [ ] Run `npm run lint` — must pass
- [ ] Smoke-test: sign in, data loads, sign out, sign back in — encryption round-trips correctly

---

### Phase 5 — State Module

**Goal:** Encapsulate all app state management — load, save, merge, and normalize.

#### Checklist

- [ ] Create `js/state.js`
- [ ] Move state management functions:
  - [ ] `mergeStateWithDefaults(parsed)`
  - [ ] `normalizeHistoryEntries(entries)`
  - [ ] `resolveEncryptedPayload(uid)`
  - [ ] `resolveUserSalt(uid, payloadSalt)`
  - [ ] `loadState()`
  - [ ] `saveState()`
  - [ ] `handleNotesDecryptError(err)`
- [ ] Move note normalization helpers:
  - [ ] `normalizeGoalMetric(value)`
  - [ ] `normalizeNutrientGoalSettings(nutrientGoals)`
  - [ ] `normalizeGoalContext(goalContext)`
  - [ ] `normalizeCalorieEntry(entry)`
  - [ ] `normalizeNutrientGroup(group, fields)`
  - [ ] `hasAnyNutrientValue(...)`
  - [ ] `normalizeFastContext(fastContext, createdAt)`
- [ ] Move mutable module-level state vars (`state`, `appInitialized`, etc.) — keep as module-level `let`, export a `getState()` / `setState()` pair
- [ ] Export `loadState`, `saveState`, `getState`, `setState`
- [ ] Update imports throughout
- [ ] Run `npm run lint` — must pass
- [ ] Smoke-test: fresh load, data persistence across refresh

---

### Phase 6 — Data Loaders

**Goal:** Isolate all YAML fetch/parse/normalize logic.

#### Checklist

- [ ] Create `js/loader.js`
- [ ] Move loader functions:
  - [ ] `loadThemePresets()`
  - [ ] `loadFastTypes()`
  - [ ] `loadFastingHourly()`
  - [ ] `loadCalorieTips()`
- [ ] Move normalization helpers consumed only by loaders:
  - [ ] `normalizeFastingHourly(data)`
  - [ ] `normalizeCalorieTips(data)`
  - [ ] `hydrateFastTypes(types, hourly)`
  - [ ] `getHourlyEntry(hour)`
  - [ ] `formatHourlyAction(hour, action)`
  - [ ] `getHourlyActionDetail(hour, opts)`
  - [ ] `buildMilestones(hours, hourly)`
  - [ ] `syncThemeDefaults()`
- [ ] Export `loadThemePresets`, `loadFastTypes`, `loadFastingHourly`, `loadCalorieTips`, `hydrateFastTypes`, `syncThemeDefaults`, `getHourlyEntry`
- [ ] Update `initApp()` imports
- [ ] Run `npm run lint` — must pass
- [ ] Smoke-test: all YAML data loads correctly on app start

---

### Phase 7 — Auth Module

**Goal:** Move all auth UI and auth flow logic.

#### Checklist

- [ ] Create `js/auth.js`
- [ ] Move auth functions:
  - [ ] `initAuthListener()`
  - [ ] `initAuthUI()`
  - [ ] `updatePasswordMatchIndicator()`
  - [ ] `updateAuthMode()`
  - [ ] `showReauthPrompt(message)`
  - [ ] `setAuthFormDisabled(disabled)`
  - [ ] `setVerificationPanel({ visible, email })`
  - [ ] `showVerificationRequired(user)`
  - [ ] `setAuthVisibility(isAuthed)`
  - [ ] `handleAuthSubmit(e)`
  - [ ] `handlePasswordReset()`
  - [ ] `completeAuthFlow()`
  - [ ] `markUserVerified(user)`
- [ ] Move auth state vars: `authMode`, `authRememberChoice`
- [ ] Export `initAuthListener`, `initAuthUI`, `setAuthVisibility`
- [ ] Update `initApp()` and `script.js` imports
- [ ] Run `npm run lint` — must pass
- [ ] Smoke-test: full sign-in, sign-up, password reset, email verification flows

---

### Phase 8 — Feature Modules

Each sub-phase below moves one feature. Do them in order to avoid circular deps.

#### 8a — AI Module

- [ ] Create `js/ai.js`
- [ ] Move: `normalizeOpenAIModel`, `normalizeOpenAIReasoningEffort`, `sanitizeBearerToken`, `isLikelyOpenAIChatModel`, `supportsReasoningEffort`, `resetReasoningSupportToast`, `showReasoningUnsupportedToastOnce`, `syncReasoningSettingForModel`, `renderOpenAIModelOptions`, `loadOpenAIModels`, `estimateCaloriesWithAI`, `parseAIJsonPayload`, `normalizeAIEstimatedNutrition`
- [ ] Export: `loadOpenAIModels`, `estimateCaloriesWithAI`, `renderOpenAIModelOptions`, `syncReasoningSettingForModel`
- [ ] `npm run lint` + smoke-test AI calorie estimation

#### 8b — Notes Module

- [ ] Create `js/notes.js`
- [ ] Move: `buildFastContextAt`, `buildFastContextFromFast`, `buildFastContext`, `buildGoalContext`, `buildInactiveFastContext`, `buildNotePayload`, `buildNoteUpdatePayload`, `createNote`, `updateNote`, `deleteNote`, `openNoteEditor`, `closeNoteEditor`, `persistNoteEditor`, `saveNoteEditor`, `removeNote`, `updateNoteEditorMeta`, `setNoteEditorNutritionFields`, `serializeNoteEditorNutritionFields`, `hasNoteEditorNutritionContent`, `buildCalorieEntryFromEditor`, `handleNoteEditorSwipeDismiss`, `attachNoteEditorSwipeHandlers`, `ensureNotesOverlay`, `openNotesDrawer`, `closeNotesDrawer`, `setNotesNavActive`, `startNotesListener`, `stopNotesListener`, `normalizeNoteSnapshot`, `renderNotes`, `renderHistoryNotes`, `renderNotesTab`, `buildNoteNutritionChips`, `buildNoteCard`, `getNoteTimestampLabel`
- [ ] Move note state vars: `notes`, `notesLoaded`, `notesUnsubscribe`, `editingNote*`, `notesOverlay*`, `notesPortal`, `notesBackdrop`, etc.
- [ ] Export: `startNotesListener`, `stopNotesListener`, `openNoteEditor`, `openNotesDrawer`, `closeNotesDrawer`, `renderNotes`, `renderNotesTab`
- [ ] `npm run lint` + smoke-test notes CRUD

#### 8c — Fasting Module

- [ ] Create `js/fasting.js`
- [ ] Move: `startFast`, `stopFastAndLog`, `startTick`, `stopTick`, `cycleTimeMode`, `updateTimer`, `renderTimerMetaIdle`, `trackMilestoneProgress`, `ensureRingEmojis`, `renderRingEmojis`, `selectRingEmoji`, `getRandomMilestoneDetail`, `updateRingEmojiPanel`, `updateRingEmojiSelectionStyles`, `updateRingEmojiProgress`, `renderFastButton`, `initFastTypeChips`, `highlightSelectedFastType`, `applyTypeToActiveFast`, `openFastTypeModal`, `closeFastTypeModal`, `usePendingFastType`, `resolveFastTypeId`, `getTypeById`, `getActiveType`, `confirmStartFast`, `confirmStopFast`
- [ ] Move fasting state vars: `selectedFastTypeId`, `pendingTypeId`, `tickHandle`, `ringEmoji*`
- [ ] Export: `startFast`, `stopFastAndLog`, `startTick`, `stopTick`, `updateTimer`, `initFastTypeChips`, `renderFastButton`
- [ ] `npm run lint` + smoke-test start/stop fast, timer, milestones

#### 8d — Calories Module

- [ ] Create `js/calories.js`
- [ ] Move: `mergeCalorieSettings`, `getCalorieSettings`, `getCalorieUnitSystem`, `getCalorieTarget`, `getCalorieConsumed`, `getCalorieDisplayDateKey`, `getNoteCaloriesForDateKey`, `getNoteNutritionTotalsForDateKey`, `getEffectiveCalorieConsumed`, `getCalorieView`, `getCalorieRemaining`, `renderCalorieSummary`, `renderCalorieRing`, `renderCalories`, `initCalories`, `renderNutritionTracker`, `formatNutritionInlineSummary`, `getCalorieTipBucket`, `renderCalorieTipOrbs`, `renderCalorieTipLayout`, `selectCalorieTip`, `updateCalorieTipPanel`, `updateCalorieTipSelectionStyles`, `renderCalorieButton`
- [ ] Move calorie state vars: `calorieTipGoalId`, `calorieTipSelectionKey`, `calorieTipLayoutSize`
- [ ] Export: `initCalories`, `renderCalories`, `renderCalorieSummary`, `renderCalorieRing`, `renderCalorieButton`, `getCalorieSettings`, `getCalorieDisplayDateKey`
- [ ] `npm run lint` + smoke-test calorie tracking and nutrition tracker

#### 8e — History & Calendar Module

- [ ] Create `js/history.js`
- [ ] Move: `renderRecentFasts`, `renderCalendar`, `initCalendar`, `buildDayFastMap`, `renderDayDetails`, `openEditStartModal`, `closeEditStartModal`, `saveEditedStartTime`, `openEditHistoryModal`, `closeEditHistoryModal`, `saveEditedHistoryTimes`, `deleteEditedHistoryEntry`, `deleteHistoryEntry`, `exportCSV`, `clearAllData`
- [ ] Move calendar state vars: `calendarMonth`, `selectedDayKey`, `editingHistoryId`
- [ ] Export: `initCalendar`, `renderCalendar`, `renderRecentFasts`, `renderDayDetails`, `exportCSV`
- [ ] `npm run lint` + smoke-test calendar navigation, history edit, CSV export

#### 8f — Settings Module

- [ ] Create `js/settings.js`
- [ ] Move: `initSettings`, `renderSettings`, `applyRingEmojiVisibility`
- [ ] Export: `initSettings`, `renderSettings`
- [ ] `npm run lint` + smoke-test all settings panels

#### 8g — Alerts Module

- [ ] Create `js/alerts.js`
- [ ] Move: `onAlertsButton`, `renderAlertsPill`, `sendNotification`, `handleAlerts`
- [ ] Export: `onAlertsButton`, `renderAlertsPill`, `handleAlerts`
- [ ] `npm run lint` + smoke-test notification opt-in and alerts

---

### Phase 9 — UI Orchestration Modules

**Goal:** Move tab management, tooltips, toast, modal helpers, and theme application out of `script.js`.

#### Checklist

- [ ] Create `js/ui.js`
  - [ ] Move: `initTabs`, `switchTab`, `initNavTooltips`, `showToast`, `openCalorieTargetDrawer`, `closeCalorieTargetDrawer`, `openCalorieGoalDrawer`, `closeCalorieGoalDrawer`, `openConfirmFastModal`, `closeConfirmFastModal`, `confirmFastAction`, `openPostFastNoteModal`, `closePostFastNoteModal`, `confirmPostFastNote`, `initButtons`
  - [ ] Move nav/tab state vars: `currentTab`, `_lastNonNotesTab`, `navHoldTimer`, `navHoldShown`, `suppressNavClickEl`, `toastHandle`, `pendingConfirmAction`, `pendingConfirmCloseFocus`, `pendingPostFastNote`
  - [ ] Export: `initTabs`, `switchTab`, `showToast`, `initButtons`, `openConfirmFastModal`, `openPostFastNoteModal`

- [ ] Create `js/theme.js`
  - [ ] Move: `resolveThemePresetId`, `getLegacyThemeColors`, `getCustomThemeColors`, `setCustomThemeColor`, `setThemePreset`, `applyThemeColors`, `getThemeSettings`
  - [ ] Export: `applyThemeColors`, `setThemePreset`, `getThemeSettings`, `resolveThemePresetId`

- [ ] Run `npm run lint` — must pass
- [ ] Smoke-test all tabs, modals, toasts, theme switching

---

### Phase 10 — Entry Point Cleanup

**Goal:** `script.js` becomes `js/render.js` — a thin entry point that wires everything together.

#### Checklist

- [ ] Create `js/render.js` with:
  - [ ] `initApp()` — orchestrates module initialization in correct order
  - [ ] `renderAll()` — calls render functions from each feature module
  - [ ] `initUI()` — wires up all event listeners (delegates to each module's init)
  - [ ] `loadAppState()` — delegates to `state.js`
  - [ ] `DOMContentLoaded` listener pointing at `initApp`
- [ ] Update `index.html`:
  - [ ] Change `<script src="script.js">` to `<script type="module" src="js/render.js"></script>`
  - [ ] Remove `<script src="firebase-config.js">` (firebase init moves into `js/firebase.js`)
  - [ ] Keep `<script src="https://cdn.tailwindcss.com">` (CDN, unchanged)
- [ ] Update `sw.js` asset list to include all `js/*.js` files (or use a catch-all)
- [ ] Delete `script.js` once `js/render.js` is fully working
- [ ] Run `npm run lint` — must pass
- [ ] Full browser smoke-test: auth, fasting, calorie tracking, notes, AI, calendar, settings, theme, CSV export, PWA install

---

### Phase 11 — Validation & Documentation Pass

**Goal:** Confirm the modularization is complete and maintainable.

#### Checklist

- [ ] Every module has a one-line comment block at the top describing its responsibility
- [ ] No circular imports (A imports B imports A) — verify manually or with a dependency graph tool
- [ ] No module exceeds ~500 lines (if so, split further)
- [ ] `sw.js` updated — all new `js/*.js` files are cached
- [ ] `README.md` updated with new file layout
- [ ] `npm run lint` passes clean
- [ ] `npm run validate` passes clean
- [ ] Manual smoke-test on mobile (iOS Safari + Android Chrome) — PWA install, fast tracking, notes
- [ ] Update this document to mark all phases complete

---

## Module Dependency Map

```
render.js
  ├── config.js          (no deps)
  ├── utils.js           (no deps)
  ├── firebase.js        → config.js
  ├── crypto.js          → config.js, utils.js
  ├── loader.js          → config.js, utils.js
  ├── state.js           → config.js, utils.js, crypto.js, firebase.js
  ├── auth.js            → config.js, utils.js, firebase.js, state.js, crypto.js, ui.js
  ├── ai.js              → config.js, utils.js, state.js
  ├── theme.js           → config.js, utils.js, state.js
  ├── notes.js           → config.js, utils.js, firebase.js, state.js, ai.js, ui.js
  ├── fasting.js         → config.js, utils.js, state.js, notes.js, ui.js, loader.js
  ├── calories.js        → config.js, utils.js, state.js, notes.js, ai.js, ui.js
  ├── history.js         → config.js, utils.js, state.js, notes.js, ui.js
  ├── settings.js        → config.js, utils.js, state.js, ai.js, theme.js, ui.js
  ├── alerts.js          → config.js, utils.js, state.js, ui.js
  └── ui.js              → config.js, utils.js
```

> **Rule:** Dependencies flow downward only. Lower modules never import from higher ones.

---

## KISS Rules for This Project

1. **One concern per module.** If you can't describe the module in one sentence, split it or merge it.
2. **No magic abstractions.** No event bus, no reactive store, no framework — plain ES modules with explicit imports.
3. **Explicit exports.** Every `export` is intentional. Nothing leaks.
4. **Keep HTML as the template.** Don't generate component trees in JS — keep markup in `index.html` and let JS read/write DOM directly as it does today.
5. **No build step.** All modules use native ES module `import` with CDN URLs. No Webpack, Vite, or Rollup unless the team explicitly decides otherwise.
6. **Lint on every phase.** Run `npm run lint` before committing any phase. Never merge a phase with lint errors.
7. **Smoke-test on every phase.** A broken phase blocks the next one.
8. **Commit per phase.** Each phase gets its own git commit with a clear message like `refactor(phase-1): extract constants to js/config.js`.

---

## Quick-Reference: What Lives Where (Post-Modularization)

| What you need to change | Go to |
|---|---|
| A constant or default value | `js/config.js` |
| A date/format/utility function | `js/utils.js` |
| Encryption or key management | `js/crypto.js` |
| Firebase refs or init | `js/firebase.js` |
| How state is loaded or saved | `js/state.js` |
| Sign-in / sign-up / email verification | `js/auth.js` |
| YAML data loading or normalization | `js/loader.js` |
| OpenAI / AI calorie estimation | `js/ai.js` |
| Fast timer, milestones, ring | `js/fasting.js` |
| Calorie ring, nutrition tracker, tips | `js/calories.js` |
| Note editor, notes list, overlay | `js/notes.js` |
| Calendar, history, CSV export | `js/history.js` |
| Settings panel, theme picker | `js/settings.js` |
| Push notifications, alerts | `js/alerts.js` |
| Tabs, toasts, modals, buttons | `js/ui.js` |
| CSS variable application, theme presets | `js/theme.js` |
| App boot, renderAll, DOMContentLoaded | `js/render.js` |
