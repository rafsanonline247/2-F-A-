# Phase 2 Baseline Audit — Lekhok Secure 0.3.0 (web prototype)

- **Date:** 2026-10-20 (Asia/Dhaka)
- **Scope:** the checked-out tree on branch `phase-2-audit` (repaired web prototype only). This is a browser-based local-first prototype. It is **not** a native Android/Windows app and **not** a production release.
- **Method:** static read of every first-party source file, execution of the existing test suite and CI syntax checks in this session, and targeted greps. No unknown scripts were executed; no credential files were opened; only synthetic credentials and published RFC vectors were used.
- **Evidence policy:** every claim below is tagged. `[Verified]` = directly reproduced in this session (command output or source line cited). `[Prior evidence]` = recorded in 2026-10-19 session artifacts and not re-executed here. `[Suspected]` = plausible from source reading, reproduction still required. Prior-session claims were **not** reused as current test results.

## 1. Environment and exact commands (this session)

| Item | Value |
|---|---|
| OS | Linux (sandbox) |
| Node.js | v24.21.0 |
| npm | 11.19.0 |
| Package deps | none (zero-dependency; `npm test` runs `node --test tests/security.test.js`) |

Commands executed in this session (CI-equivalent, from `.github/workflows/ci.yml`):

```sh
node --check server.js
node --check forum.js
node --check app/js/app.js
node --check app/js/totp.js
node --check app/js/vault.js
node --check app/js/jsQR.js
node --check tests/security.test.js
npm test
```

Result: **7/7 syntax checks OK; 6/6 tests pass** (duration 490.854 ms). Full TAP output preserved in `docs/test-results-2026-10-20.txt`. Prior session (Node v22.15.0, npm 9.8.1, 2026-10-19) also recorded 6/6 in `docs/REPOSITORY-REPAIR.md`; the pre-repair recorded artifacts `docs/test-results.txt` and `docs/repository-preflight.txt` show the older wildcard command `node --test tests/*.test.js` in their headers and are retained as historical evidence only.

GitHub Actions: **no run exists for these branches at authoring time.** CI results are pending and are not claimed anywhere in these documents.

## 2. Verified findings (source/test evidence)

- **V1 — Static server hardening basics.** `server.js:4` serves only `GET`/`HEAD` (405 otherwise), resolves paths under `app/` with `path.resolve(root,'.'+p)` plus a `startsWith(root+path.sep)` traversal guard, binds `127.0.0.1` by default (`HOST`/`PORT` overridable), and sets `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'none'; base-uri 'none'; form-action 'none'`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Zero npm dependencies. `[Verified: source read + node --check]`
- **V2 — No network calls in front-end code.** Grep over `app/js/app.js`, `app/js/vault.js`, `app/js/totp.js`, `app/index.html` for `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `document.write`, `innerHTML`, `eval(` returned **no matches**. The CSP `connect-src 'none'` (V1) enforces this at runtime. The UI footer claim "No cloud login, telemetry, or external time requests" (`app/index.html:8`) is consistent with the code. `[Verified: grep + source read]`
- **V3 — Encrypted vault envelope.** `app/js/vault.js`: PBKDF2-SHA256 at 600,000 iterations (`vault.js:4,8`), AES-256-GCM with a 96-bit random IV per encryption and 128-bit random salt (`vault.js:19`), format identifier bound as AAD (`vault.js:7,19`), keys derived non-extractable (`vault.js:8`), envelope fields pinned on open — including `iterations` — so KDF downgrade envelopes are rejected (`vault.js:22`), plaintext size caps (8 MiB raw, ≤10,000 records, fields ≤100,000 chars, strict TOTP parameter validation) (`vault.js:9-17,21`). Covered by tests 3–5. `[Verified: source read + tests]`
- **V4 — OTP engine matches published RFC vectors.** `app/js/totp.js:80-126` implements RFC 4226 dynamic truncation and RFC 6238 TOTP over WebCrypto HMAC (SHA-1/256/512, 6/8 digits, 15–120 s period). The production engine is exercised by the test suite against **all 10 RFC 4226 Appendix D vectors** and **all 18 RFC 6238 Appendix B vectors** (`tests/security.test.js:6-7`) — 28 vectors, all passing in this session's run. `[Verified: test execution]`
- **V5 — DOM built without injection primitives.** `app/js/app.js:20` constructs cards with `createElement`/`textContent`; combined with V2's grep (no `innerHTML`/`document.write`/`eval`) and CSP `script-src 'self'`, the common stored-XSS sinks are absent from first-party code. `[Verified: grep + source read]`
- **V6 — Input and artifact validation.** otpauth URI ingestion is gated (`app.js:15`: type must be `totp`, algorithm ∈ {SHA1, SHA256, SHA512}, digits ∈ {6,8}, period 15–120 integer, secret `/^[A-Z2-7]{16,200}$/`); QR image decode caps file size at 8 MiB and bitmap at 16 M pixels (`app.js:17`); restore requires an **empty** vault and a ≤8 MiB file (`app.js:11`, `vault.js:4,21`); records get `crypto.randomUUID()` ids (`app.js:18`). `[Verified: source read]`
- **V7 — Forum helper rejects malformed input safely.** `forum.js:64-78` clamps `discrepancy` to 0–2 and `period` to 15–120, requires `/^\d{6}$/`, then compares with `crypto.timingSafeEqual` over equal-length buffers; test 6 confirms `''`, `'1'`, `'1234567'`, `'abcdef'`, `null` all return `false` without throwing. `[Verified: source read + test]`
- **V8 — Session lifecycle.** Auto-lock after 120 s inactivity, lock on tab hide, lock when another tab rewrites the vault key, and a generation counter that invalidates in-flight async writes after lock (`app.js:3,5,7,21,24-27`); the passphrase field is cleared on lock and after successful unlock (`app.js:7,8`). Manual lock, reload-locked, and wrong-passphrase rejection are exercised by the browser check. `[Verified: source read + prior browser evidence]`
- **V9 — Password generator uses rejection sampling.** `vault.js:27` resamples bytes ≥ `256-256%alphabet.length`, avoiding modulo bias; test 5 checks the 24-char default length. `[Verified: source read + test]`
- **V10 — CI workflow is least-privilege.** `.github/workflows/ci.yml`: `permissions: contents: read`, no secrets, `actions/checkout` and `actions/setup-node` pinned to full commit SHAs, 2×2 matrix (ubuntu/windows × Node 22/24), explicit `node --check` on all seven JS files plus `npm test`. `[Verified: source read]`
- **V11 — Repair provenance of this tree.** The repaired tree was delivered as `2-F-A-V1-repository-repair.zip` (SHA-256 `69478daa2013579a8528d035d91593c0772ef88cf0dad72aa0f42d7281647742`, 29 entries, CRC clean — re-verified this session). This branch was constructed from that bundle; `git diff main..repository-repair` is exactly: 15 recovered files under `app/`, `tests/`, `docs/`, `.github/workflows/`; `package.json` updated (test script `node --test tests/*.test.js` → `node --test tests/security.test.js`, `engines.node` `>=20` → `>=22`); redundant `GitHub-upload-ready.zip` removed. `[Verified: this session's git diff]`
- **V12 — Package metadata.** `package.json`: zero runtime dependencies, `engines.node >=22`, explicit test path. Note the repair **changed** root file `package.json` (test script + engines), while other root files were byte-identical and untouched, consistent with `docs/REPOSITORY-REPAIR.md:22`. `[Verified: git show + diff]`

## 3. Suspected issues (reproduction required — not yet confirmed)

- **S1 — Dead legacy crypto path invites misuse.** `app/js/totp.js:198-255` (`encryptData`/`decryptData`) implements an older v1 envelope: PBKDF2 at only 100,000 iterations and **no AAD**, exported at `totp.js:266-267`. Grep shows **no caller** in `app.js`/`vault.js`/`index.html`. Risk is future reuse with the weaker path; recommended for removal or explicit deprecation (see `docs/ROADMAP.md` P2).
- **S2 — localStorage quota vs. restore cap.** Restore accepts backups up to 8 MiB (`app.js:11`, `vault.js:4`) and the schema permits ~10,000 records with ≤100,000-char fields (`vault.js:10-14`), but browser `localStorage` is typically ~5 MB per origin; a large-but-valid vault could fail at `setItem` (`app.js:5,10,11`) with only the generic failure message. No aggregate size cap exists in `validate()`. Needs reproduction with a large synthetic vault.
- **S3 — Multi-tab write race.** Cross-tab changes lock the other tab (`app.js:26`), and the generation counter guards writes within a tab (`app.js:5`), but two tabs unlocked simultaneously can still last-write-win; the `revision` field is not used for conflict detection (`docs/AUDIT-BN.md` notes the same). Targeted reproduction needed.
- **S4 — Backup rollback/replay.** `open()` (vault.js:20-26) authenticates and validates an envelope but has no freshness check, so any old valid backup restores successfully; deletion of a record does not invalidate earlier backups (also stated in `README.md:20`). Design decision to confirm and document as accepted or fix.
- **S5 — Stale recorded evidence headers.** `docs/test-results.txt` and `docs/repository-preflight.txt` were captured with the pre-repair wildcard test command (visible in their TAP headers). They remain as history; current evidence is `docs/test-results-2026-10-20.txt`. Housekeeping: annotate or regenerate in a later pass.
- **S6 — Clickjacking hardening gap.** The server sets no `X-Frame-Options` or CSP `frame-ancestors` (`server.js:4`), so the page can be embedded. Impact is limited (loopback-only server, no auth actions), but unlocking inside a hostile frame is an untested scenario. Reproduction needed before rating.
- **S7 — Dialog-dependent flows.** Record deletion uses `confirm()` (`app.js:20`); in sandboxed/embedded contexts dialogs may be suppressed, making delete appear broken. Minor; needs repro only in embedded contexts.
- **S8 — README/engine version drift.** `README.md:6` says "Node.js 20 or later" while `package.json` now requires `>=22`. Documentation fix (P2). `[Verified inconsistency; listed here as a doc issue to fix, trivially reproducible]`

## 4. Untested features (present in code, no passing test observed)

- **QR image decoding** (`app.js:17` with vendored `jsQR.js`): no unit test, and `docs/browser-results.txt:2` explicitly lists "QR image" as NOT tested.
- **otpauth URI parsing paths** (`totp.js:129-173`, gate at `app.js:15`): no unit tests for valid/invalid URIs.
- **Clipboard copy + 30-second best-effort clear** (`app.js:19`): listed as NOT tested in `docs/browser-results.txt:2`.
- **120-second idle lock and background (visibilitychange) lock** (`app.js:25,27`): boundary not exercised; only manual lock was browser-tested.
- **`forum.verifyCode` success path**: only malformed-input rejection is tested (test 6); no positive verification test with published vectors exists for the Node kit.
- **`start_app.bat`** on a real Windows host (CI runs Windows but only syntax checks + `npm test`).
- **Non-Chromium browsers** (the browser check ran in Playwright Chromium only), **10k-record scale**, and the **screenshots** in `docs/browser-*.png` (synthetic data; image content not re-verified in either repair or this session — consistent with `docs/REPOSITORY-REPAIR.md:14`).

## 5. Missing implementations (absent from the codebase)

- Camera-based enrollment: `Permissions-Policy: camera=()` (server.js:4) denies camera; only image-file QR decoding exists.
- HOTP (counter-based) records in the UI: the URI parser accepts `hotp` (`totp.js:136,158`) but `fillURI` (`app.js:15`) rejects anything but `totp`, and there is no counter UI.
- Record **editing**, categories/favorites, trash/history, password reveal, strength scoring, dedicated recovery-code records (the old prototype's backup-code feature was intentionally not ported — `docs/AUDIT-BN.md`).
- OS-backed key protection: Android Keystore/StrongBox, Windows CNG/TPM, biometric unlock, Argon2id, DEK/device-key wrapping (explicitly non-goals of the browser prototype — `README.md:32`).
- Real cloud features: no OAuth/Drive code exists; the UI states native biometrics and Drive sync are not added (`app/index.html:4`).
- Service worker / offline install; external time synchronization (device clock only, flagged in the health line `app.js:20`).
- Automated browser tests wired into CI (`tests/browser-check.cjs` requires Playwright, which is intentionally not a dependency and contains session-specific hardcoded paths).

## 6. Third-party components and provenance

| Component | Origin | Status |
|---|---|---|
| `app/js/jsQR.js` (10,101 lines) | Vendored third-party QR decoder, inherited from the supplied archive | **License/provenance NOT verified.** `README.md:42` requires upstream license verification and notice retention before any distribution. Unresolved distribution blocker. |
| Core TOTP logic | "Adapted from the supplied project" (`README.md:42`) | Ownership/license of the supplied project **not independently established**; do not treat the root `LICENSE` (MIT, 2026 rafsanonline247) as covering inherited material. |
| `jsQR.js` inclusion surface | Loaded by `app/index.html:8`, same-origin under CSP | No supply-chain runtime risk observed (no remote loading), but provenance review is still required. |
| npm dependencies | none | No dependency audit needed for the prototype itself; Playwright is a separate-environment tool only. |

## 7. Required status table

| Capability | Implemented | Tested locally | Tested in CI | Tested on device | Externally reviewed | Blocked |
|---|---|---|---|---|---|---|
| TOTP generation (SHA-1/256/512, 6/8 digits, 15–120 s) | Yes | Yes — 28 RFC vectors, 2026-10-20 | Pending (no Actions run yet) | N/A (web) | No | — |
| Encrypted vault + encrypted backup (AES-GCM/PBKDF2-600k) | Yes | Yes — tests 3–5 | Pending | No | No | Argon2id / OS keychain: Blocked |
| Manual TOTP enrollment (URI parse) | Yes | Manual only | Pending | No | No | Unit tests: open (P2) |
| QR **image-file** decode | Yes (code) | No | Pending | No | No | jsQR license check: Blocked for distribution |
| Camera QR enrollment | No | — | — | — | — | Blocked (native phase) |
| Password generator | Yes | Yes — constraint test | Pending | No | No | Distribution analysis: open |
| Lock behaviors (manual/reload/restore) | Yes | Yes — browser check (prior session) | Pending | No | No | Idle/background boundaries untested |
| Forum helper (`forum.js`) verification | Partial | Negative tests only | Pending | No | No | Success-path test: open (P2) |
| Cloud/Drive sync, biometrics, native apps | No | — | — | — | — | **Blocked** (future phases) |
| Independent security review | No | — | — | — | — | **Blocked** (external) |

**Production readiness is not claimed.** No physical-device, Google Drive, code-signing, or external-review verification exists as of this document.
