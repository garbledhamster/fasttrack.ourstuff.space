# AI Cost & Token-Usage Recommendations

This document records the AI cost-reduction analysis and the recommendations implemented in this project.

---

## Implemented Optimizations

### 1. Compact AI Payloads (`compactAIContext`)

**Status: ✅ Implemented**

A shared `compactAIContext(obj)` helper was added before `callAIChatCompletions` in `script.js`. It:
- Serializes payloads as compact JSON (no whitespace/indentation).
- Recursively strips `null` values, empty strings `""`, empty arrays `[]`, and empty objects `{}` before serializing.

All five AI call sites that previously used `JSON.stringify(payload, null, 2)` now use `compactAIContext(payload)`:
- `recommendGoalPlanWithAI`
- `estimateCaloriesWithAI`
- `generateTrainerNoteWithAI`
- `generateTrainerQuickQuestionResponse`
- `generateAITrainerNoteConversationResponse`

**Savings:** Eliminates all indentation whitespace tokens and omits null/empty fields on every request.

---

### 2. Remove Static Repeated Context

**Status: ✅ Implemented**

`buildFastingScheduleContext()` previously included:
- `availableFastTypes` — the full list of every fast type. Static, never changes, not needed per-call.
- `physiologyNotes` — first three entries from `FASTING_HOURLY.notes`. Static reference data that belongs in the system prompt, not the payload.

Both fields were removed. The function now returns only `defaultFastType` and `selectedFastType`, which are the only values the model needs to tailor its response.

**Savings:** Removes a large static array from every trainer/recommendation request.

---

### 3. Deduplicate Trainer Context

**Status: ✅ Implemented**

`buildTrainerContinuityContext()` previously computed and returned `previousAITrainerNotes` — a filtered subset of `notes` containing only AI-generated notes. Since `notes` (the full list) is already sent in the same payload, and each note already includes the `isAITrainerNote` flag, the model can distinguish trainer notes from user notes itself.

`previousAITrainerNotes` was removed from the returned context object.

**Savings:** Eliminates a duplicate copy of AI-generated notes from every trainer request.

---

### 4. Note History and Conversation History

**Status: ⏭️ Deferred (handled by existing settings)**

The app already provides user-controlled range sliders and source/context filters for note history. Users can configure exactly how much history the trainer receives. No hard-coded caps were added.

Similarly, conversation history within a note chat is naturally bounded by what the user has typed. No automatic truncation was added.

---

### 5. Cheaper Model for Narrow Extraction Tasks

**Status: ✅ Implemented**

An `OPENAI_EXTRACTION_MODEL = "gpt-5.4-mini"` constant was added. `callAIChatCompletions` was extended with an optional `modelOverride` parameter: when the provider is OpenAI and `modelOverride` is provided, that model is used instead of the user's selected model.

`estimateCaloriesWithAI` now passes `modelOverride: OPENAI_EXTRACTION_MODEL`, routing nutrition JSON-extraction calls to the smallest/cheapest available OpenAI model regardless of what model the user has configured for coaching tasks.

BYO-provider calls are unaffected — `modelOverride` is ignored for non-OpenAI providers.

**Savings:** Calorie/nutrition estimation requests run on a cheaper model, which can reduce cost by up to 80% for that call type.

---

### 6. Token Usage Instrumentation

**Status: ✅ Implemented**

`callAIChatCompletions` now logs token usage to the browser console after every successful AI response when `usage` is present in the response:

```
[AI] AI trainer note — prompt_tokens: 312, completion_tokens: 118, total_tokens: 430
```

The log includes the `purpose` label (trainer note, quick question, conversation, recommendation, nutrition estimate) so each feature's token usage can be measured independently. Logging is developer-facing only — no user-visible UI changes.

---

## Remaining / Future Recommendations

These were identified but not implemented in this pass:

- **Shorten system prompts:** Review `AI_TRAINER_NOTE_PROMPT` and `AI_TRAINER_NOTE_CONVERSATION_PROMPT` for redundant wording. Removing even 20-30 tokens from a system prompt saves them on every call.
- **Send only semantically useful fields:** Audit `buildTrainerActiveFastContext` and `buildTrainerCompletedFastSummary` for internal IDs and storage-oriented fields that the model ignores.
- **Reduce `max_completion_tokens` for extraction tasks:** `OPENAI_MAX_TOKENS_STANDARD` (320) may still be generous for nutrition JSON output, which is typically under 100 tokens. A tighter cap of ~150 for extraction tasks would save cost on completion.
- **Prefer one-line note summaries:** For very long user notes, summarizing to one line before sending could save tokens in high-history scenarios.
