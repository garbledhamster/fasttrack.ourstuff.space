# Issues Tracker

## Auth flow bootstrap + encrypted state handling

- Status: **Fixed** (2026-05-10)
- Summary:
  - First verified sign-in no longer stalls when no encrypted state exists yet.
  - Missing/corrupt local encrypted-state payload now fail-soft boots into default state.
  - IndexedDB device-key storage now self-initializes missing store paths and allows new-device continuation.
- Remaining manual QA:
  - Verify first sign-in after email verification lands in app/home on a brand-new account.
  - Verify existing account on a brand-new browser prompts for password only when encrypted payload exists and cannot be unlocked via device key.
  - Verify intentionally wrong password during unlock surfaces decrypt failure prompt and does not silently proceed.
