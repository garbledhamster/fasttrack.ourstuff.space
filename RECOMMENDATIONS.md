# Recommendations

## 2026-05-10 — Auth bootstrap and encrypted state recovery

- Treat missing or invalid encrypted state payloads as bootstrap conditions, not hard failures.
- Only block auth flow for real unlock failures (`missing-password` for existing encrypted data, or `decrypt-failed` after attempted decrypt).
- Keep local crypto primitives fail-soft on new devices/browsers by self-healing IndexedDB key storage.
