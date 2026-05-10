# Issues Tracker

Tracks completed work, open issues, and deferred items for fasttrack.ourstuff.space.

---

## ✅ Completed

### AI Cost & Token-Usage Optimizations (2026-05-10)

| # | Item | Details |
|---|---|---|
| 1 | Compact AI payloads | Added `compactAIContext(obj)` helper; replaced all `JSON.stringify(payload, null, 2)` at 5 call sites. Strips null, empty strings, empty arrays, empty objects before serializing. |
| 2 | Remove static repeated context | Removed `availableFastTypes` and `physiologyNotes` from `buildFastingScheduleContext()`. These were static arrays sent on every AI request. |
| 3 | Deduplicate trainer context | Removed `previousAITrainerNotes` from `buildTrainerContinuityContext()`. It was a filtered duplicate of `notes`, which is already in the same payload. |
| 4 | Cheaper model for extraction | Added `OPENAI_EXTRACTION_MODEL` constant and `modelOverride` parameter to `callAIChatCompletions`. `estimateCaloriesWithAI` now routes to the cheaper model for OpenAI; BYO providers are unaffected. |
| 6 | Per-tool AI provider matrix | Added `aiToolProviders` to state/settings + `AI_TOOL_PROVIDER_KEYS` constant, `normalizeAIToolProviders`, `getAIToolProvider`. Settings UI matrix table (Settings → AI Features) lets users assign each tool to OpenAI or Custom independently. `getAITrainerProviderOverride` extended to accept a `toolKey` fallback. `estimateCaloriesWithAI` and `recommendGoalPlanWithAI` updated to accept `providerOverride`. All 5 call sites updated. |

---

## ⏭️ Deferred

| # | Item | Reason |
|---|---|---|
| D1 | Hard-cap note history sent to AI | Existing settings already let users control the range (last N notes, or date window). Adding a hard cap on top of that would conflict with user intent. Revisit if very long note bodies become a cost concern. |
| D2 | Hard-cap conversation turns in trainer chat | Same reason as D1 — conversation history is naturally bounded by what users have typed. |
| D3 | Shorten system prompts | `AI_TRAINER_NOTE_PROMPT` and `AI_TRAINER_NOTE_CONVERSATION_PROMPT` could be trimmed of redundant wording. Low priority; deferred for a future focused pass. |
| D4 | Audit active fast / completed fast context for unused fields | `buildTrainerActiveFastContext` and `buildTrainerCompletedFastSummary` include IDs and internal fields the model likely ignores. Low-risk but requires careful review to not remove semantically useful data. |
| D5 | Lower `max_completion_tokens` for extraction tasks | `OPENAI_MAX_TOKENS_STANDARD` (320) could be as low as ~150 for nutrition JSON output. Not implemented yet; token usage logs will inform the right value. |

---

## 🐛 Open Issues

_No known open issues at this time. Add newly discovered bugs or regressions here._

---

## Notes

- Use `[AI] <purpose> — prompt_tokens: N, ...` console logs (added in optimization #5 above) to measure savings and guide future work.
- See `RECOMMENDATIONS.md` for detailed implementation notes.
- See `COPILOT_INSTRUCTIONS.md` for project conventions and guidance on keeping this file updated.
