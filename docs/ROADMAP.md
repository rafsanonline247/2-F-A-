# ROADMAP — Lekhok Secure / 2-F-A-

- **Date:** 2026-10-20 (Asia/Dhaka) · **Status:** draft for review (Phase 2 PR)
- **Principles:** every phase is independently reviewable; every capability claim is gated on recorded evidence; **only synthetic data and published RFC vectors** enter the repository; production readiness is never claimed while any gate below is open.
- **Reading the tables:** "Tested in CI" means a concluded GitHub Actions run on the relevant commit; "Tested on device" means physical hardware, recorded with a date and environment; "Externally reviewed" means a named reviewer or security review outside the authoring session. Anything else stays **Pending / Blocked**.

## Phase overview

| Phase | Theme | Depends on | Status |
|---|---|---|---|
| P0 | Repository repair | — | **Done locally** (2026-10-19); PR pending merge |
| P1 | Audit, threat model, platform decision (docs only) | P0 | **This PR** |
| P2 | Prototype hygiene (web, small) | P1 | Not started |
| P3 | Native foundations — shared vector fixtures + Android scaffold | P1 | Not started |
| P4 | Android device verification | P3 + owner hardware | **Blocked** (no device testing yet) |
| P5 | Windows native client | P3 | Not started |
| P6 | Backup & sync (design first, then real OAuth/Drive) | P4 | **Blocked** (design-only until P4) |
| P7 | Signing & distribution | P4/P5 | **Blocked** (owner-held keys) |
| P8 | Independent security review | P5 stable | **Blocked** (external) |

## P0 — Repository repair (done locally, not yet merged)

- Recovered `app/`, `tests/`, `docs/`, `.github/workflows/` from a validated archive; explicit test paths; nested `GitHub-upload-ready.zip` removed. Evidence: `docs/REPOSITORY-REPAIR.md`, bundle SHA-256 `69478daa…647742`, fresh re-run `docs/test-results-2026-10-20.txt`.
- **Gate:** CI run concludes green on the repair PR (currently **pending** — not claimed).
- **Owner action:** review/merge the repair PR.

## P1 — Phase 2 documentation (this PR, docs only)

- Adds `docs/audit/BASELINE.md`, `docs/security/THREAT-MODEL.md`, `docs/architecture/ADR-001-platform.md`, this roadmap; no code changes.
- **Gates:** exact local results recorded (7/7 syntax checks, 6/6 tests, Node v24.21.0 — `docs/test-results-2026-10-20.txt`); CI pending at authoring; all four evidence categories kept distinct in the baseline.
- **Owner actions:** review ADR-001 (accept/change platform decision), confirm S4 rollback acceptance or reject, review the status table in the baseline.

## P2 — Prototype hygiene (web; small, fast, reviewable)

1. Remove or deprecate the legacy v1 crypto path (`app/js/totp.js:198-255` — unused, weaker KDF, no AAD; BASELINE S1).
2. Fix README/engines drift (`README.md:6` vs `package.json` `>=22`; S8); annotate or regenerate stale `docs/test-results.txt` / `docs/repository-preflight.txt` headers (S5).
3. Add unit tests: `parseOtpAuthUri` valid/invalid paths, `fillURI` gate, `forum.verifyCode` **success** path against RFC 6238 vectors, password-generator distribution smoke test.
4. Optional server hardening: `frame-ancestors 'none'` / `X-Frame-Options: DENY` (S6) — decide in review.
5. **jsQR provenance/license verification** (BASELINE §6) — distribution blocker; if unresolvable, replace with a decoder of established license.
- **Gate:** `npm test` green with the new tests; CI green; no new features.

## P3 — Native foundations (Android scaffold + shared fixtures)

- Create `fixtures/rfc4226/` + `fixtures/rfc6238/` (published vectors only) consumed by Node, Kotlin, and C# test suites.
- Android project scaffold: Kotlin + Compose + Keystore-backed envelope v2 design doc; **no claims** beyond code review + CI until P4.
- Finalize envelope v2 spec (OS-wrapped DEK + passphrase-encrypted portable export compatible with the web format).
- **Gate:** RFC fixture suite passes on all three engines in CI.

## P4 — Android device verification (**Blocked until owner provides hardware**)

- Physical-device matrix (min API level, StrongBox vs TEE fallback), biometric unlock, CameraX QR enrollment against synthetic URIs, clipboard behavior, background/lock lifecycle.
- **Gate:** recorded on-device results with device model/OS version; until then the Android column stays "not tested on device" everywhere.

## P5 — Windows native client

- .NET 8 + WinUI 3 port; DPAPI/CNG (TPM) envelope; Windows Hello unlock; MSIX packaging structure (unsigned until P7).
- **Gate:** CI on windows-latest green incl. vector fixtures; on-device results recorded by owner.

## P6 — Backup & sync (design first; **real cloud blocked**)

- Design doc only: encrypted appDataFolder layout, ETag/conflict policy, device revocation, rollback protection (resolves S4 for native).
- Implementation **blocked** on: P4 device evidence, a Google Cloud project, OAuth consent/verification, and a live Drive round-trip test. No Drive capability may be claimed before a recorded live test.

## P7 — Signing & distribution (**Blocked — owner-held secrets**)

- Owner generates/holds keystore + MSIX signing identity (never committed; `.gitignore` already excludes `*.jks`, `*.keystore`, `*.pfx`, `*.p12`, `*.pem`, `*.key`).
- **Gate:** signed builds install on clean devices; signing claims only after that is recorded.

## P8 — Independent security review (**Blocked — external**)

- External review of envelope v2, native key handling, and the threat model; findings folded back before any public release.

## Release blockers (carried from README / AUDIT-BN / baseline)

1. jsQR license/provenance (P2.5) — unresolved.
2. Ownership/license of "supplied project" code (BASELINE §6) — unresolved; do not publish bundles derived from it until cleared.
3. No CI-green repair commit yet (P0 gate) — pending Actions runs.
4. Zero device, Drive, signing, or external-review evidence exists — all such claims are prohibited until each gate above closes.

## Status table (authoritative snapshot, 2026-10-20)

| Capability | Implemented | Tested locally | Tested in CI | Tested on device | Externally reviewed | Blocked |
|---|---|---|---|---|---|---|
| TOTP engine (RFC vectors) | Yes (web) | Yes (28 vectors) | Pending | N/A (web) / Blocked (native) | No | — |
| Encrypted vault/backup (web) | Yes | Yes | Pending | No | No | OS keychain/Argon2id (native phases) |
| URI/QR-file enrollment (web) | Yes | Partial (URI manual; QR untested) | Pending | No | No | jsQR license |
| Native Android client | No | — | — | — | — | **Blocked** (P3/P4) |
| Native Windows client | No | — | — | — | — | **Blocked** (P5) |
| Real OAuth/Drive sync | No | — | — | — | — | **Blocked** (P6) |
| Signed distribution | No | — | — | — | — | **Blocked** (P7, owner keys) |
| Independent security review | No | — | — | — | — | **Blocked** (P8) |
