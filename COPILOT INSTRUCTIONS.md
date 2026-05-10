# Copilot Instructions

## Auth bootstrap lesson (2026-05-10)

- In auth-state load paths, new users and new devices must not be gated on existing encrypted payloads or preexisting wrapped keys.
- For first bootstrap, initialize a clean default state and continue to app/home.
- Preserve strict failures only for true decryption problems (wrong password/key mismatch leading to decrypt failure).
