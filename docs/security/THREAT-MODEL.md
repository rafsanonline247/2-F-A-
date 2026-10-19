# Threat Model — Lekhok Secure web prototype (0.3.0)

- **Date:** 2026-10-20 (Asia/Dhaka) · **Status:** draft for review (Phase 2 PR)
- **Scope:** the browser application (`app/`), the loopback static server (`server.js`), the Node helper kit (`forum.js`), and the repository/CI as a supply chain. **Out of scope:** native Android/Windows apps, any real cloud backend, and the old superseded prototype audited in `docs/AUDIT-BN.md`.
- **Evidence basis:** `docs/audit/BASELINE.md` findings (V1–V12, S1–S8). Only synthetic credentials and published RFC vectors have been used anywhere in this project.

## 1. Assets

| ID | Asset | Notes |
|---|---|---|
| A1 | TOTP shared secrets (Base32 seeds) | Highest-value asset; grants code generation for enrolled services |
| A2 | Stored passwords | Co-located in the same vault as A1 |
| A3 | Master passphrase | Unlocks everything; **unrecoverable if lost** |
| A4 | Vault integrity & availability | AES-GCM tamper detection; browser storage may be evicted by the OS (UI footer, `app/index.html:8`) |
| A5 | Encrypted backups (`.lekhokvault`) | Portable; bound to the original passphrase; old backups stay valid (S4) |
| A6 | Code & supply-chain integrity | Vendored `jsQR.js` license/provenance unverified (BASELINE §6) |
| A7 | Server-side verification correctness (forum kit callers) | `forum.js` is a library, **not** a login system (`README.md:39`) |

**Data classification rule:** only synthetic data and published RFC vectors (`RFC 4226` App. D, `RFC 6238` App. B) may be stored or committed. No real accounts, real seeds, screenshots of real OTPs, `.env` files, vaults, or databases — enforced by `.gitignore` (`*.lekhokvault`, `.env`, key stores) and by test design (`tests/security.test.js` uses marker `ONLY-SYNTHETIC-PASSWORD`).

## 2. Adversaries

| ID | Adversary | Capability | In scope? |
|---|---|---|---|
| Adv1 | Local malware / malicious browser extension | Read process memory, page DOM, disk, clipboard; inject content | Yes (partially mitigated at best — see §6) |
| Adv2 | Physical / disk attacker | Device theft, disk imaging of the browser profile | Yes |
| Adv3 | Malicious provisioning input | Hostile QR image, otpauth URI, or oversized/malformed backup file | Yes |
| Adv4 | Network-adjacent attacker | Reaches the server only if it is deliberately rebound off loopback | Yes (config-dependent) |
| Adv5 | Repo/CI attacker | Malicious commit, workflow tampering, dependency substitution | Yes (supply chain) |
| Adv6 | Backup recipient | Obtains a `.lekhokvault` file (e.g., synced to an untrusted location) | Yes |
| Adv7 | Cloud-side attacker | Compromise of Drive/OAuth infrastructure | **Out of scope** (no cloud code exists) |

## 3. Trust boundaries

```
 [User] --(passphrase)--> [Browser page: app/*.js]  <== B1 ==>  [localStorage: ciphertext only]
                                |                                     (origin-scoped, not OS-protected)
   B3: user artifacts ==>  [Parsers: URI / QR image / backup file]
                                |
   B5: page <==> [Clipboard / screen / OS]            (best-effort hygiene only)
                                |
   B2: page --X--> [Network]        CSP connect-src 'none' (server.js:4)
                                |
 [Static file server 127.0.0.1] <== B4/Adv4 ==>  (loopback by default)
                                |
 [Repository + GitHub Actions]  <== B6/Adv5 ==>  read-only workflow, pinned SHAs, no secrets
```

- **B1 (page ↔ persistent storage):** plaintext secrets exist only in page memory during use; persisted state is the encrypted envelope (`app.js:5`, `vault.js:19`). Browser check confirmed no seed material in `localStorage` (`tests/browser-check.cjs:2`, plaintext-leak assertion).
- **B3 (artifacts ↔ parsers):** URI gate `app.js:15`, image caps `app.js:17`, restore-only-into-empty-vault `app.js:11`, schema caps `vault.js:9-17`.
- **B5 (page ↔ OS/clipboard):** JavaScript cannot guarantee clipboard or memory hygiene; clearing is best-effort (`app.js:19`, UI footer).
- **B6 (dev ↔ CI):** workflow is `contents: read`, no secrets, pinned actions (`.github/workflows/ci.yml`) — least privilege verified in BASELINE V10.

## 4. Attack surface and STRIDE status

| Threat | Surface | Mitigation present | Status |
|---|---|---|---|
| **S**poofing | N/A — the prototype has no authentication or remote accounts | Not applicable; `forum.js` explicitly is not a login system and rejects client-supplied secrets as proof (`README.md:39`) | Out of scope by design |
| **T**ampering (vault) | localStorage, backup files | AES-256-GCM + AAD binding format params (`vault.js:7,19`); KDF-downgrade envelopes rejected (`vault.js:22`); bit-flip and iterations-tamper tests pass | **Mitigated (tested)** |
| **T**ampering (rollback) | Old valid backups | None — freshness/revision pinning absent (S4) | **Accepted risk to confirm** |
| **R**epudiation | Single local user, no audit log | Not applicable | Out of scope |
| **I**nfo disclosure (at rest) | localStorage, disk | Envelope-only persistence; plaintext-leak test (`tests/security.test.js:9`); browser profile theft yields ciphertext bound to a ≥14-char passphrase (`vault.js:18`) | **Mitigated (tested), passphrase-gated** |
| **I**nfo disclosure (in use) | Page memory, clipboard, screen | Auto-lock 120 s / on hide (`app.js:25,27`), generation-guarded writes, masked display (`••• •••`), best-effort clipboard clear | **Partially mitigated**; JS memory erasure impossible (UI footer admits this) |
| **I**nfo disclosure (code path) | Malicious URI/QR | Strict URI gate `app.js:15`; parser throws wrapped errors without echoing secrets beyond the input itself | Mitigated (paths unit-tested? no — BASELINE §4) |
| **I**nfo disclosure (network) | Server | CSP `connect-src 'none'`; grep shows no outbound calls (BASELINE V2); loopback bind | **Mitigated** if default bind kept (Adv4) |
| **D**enial of service | Server, storage | GET/HEAD static only; schema caps (≤10k records, 8 MiB restore); no rate limiting (loopback reduces exposure) | Acceptable for prototype; storage-eviction DoS is environmental (footer) |
| **E**levation of privilege | Server process, browser origin | Traversal guard + prefix check (`server.js:4`); no exec, no uploads; CSP `script-src 'self'`; DOM via `textContent` (V5) | **Mitigated (static review)**; embedding possible — S6 |

## 5. Compromise impact — passwords and OTP seeds together

The vault intentionally stores A1 and A2 in one encrypted envelope. A single passphrase compromise (A3) therefore exposes **both** factors at once: an attacker gains reusable passwords *and* the ability to generate future OTP codes offline for every enrolled service until each seed is rotated. This is acknowledged in the UI footer (`app/index.html:8`) and accepted for the prototype. Consequences:

- No second channel exists to detect or revoke a leaked seed in this prototype.
- Backup compromise (Adv6) has the same blast radius as live-vault compromise.
- Remediation direction (native phases): OS-keychain-wrapped per-record DEKs, biometric gating, and per-service revocation/re-enrollment guidance — see `docs/architecture/ADR-001-platform.md`.

## 6. Why browser protections are weaker than native platform protection

| Capability | This prototype (browser) | Android native (Keystore/StrongBox) | Windows native (CNG/TPM + Hello) |
|---|---|---|---|
| Key storage | Derived in-page (PBKDF2) from passphrase; lives in JS heap | Hardware-backed, non-exportable, usage policy enforced by OS | TPM/CNG-backed; Hello gating |
| Biometric unlock | None | BiometricPrompt | Windows Hello |
| Memory hygiene | JS cannot guarantee erasure (documented) | Native buffers can be zeroized; keys never enter app heap | Same |
| Clipboard | Best-effort | OS-managed, can block/limit | OS-managed |
| Attestation of storage strength | None possible | StrongBox/TEE guarantees | TPM guarantees |
| Throat to choke (malware) | Whole browser profile is the boundary | App-scoped sandbox + Play Integrity options (future) | App-scoped + code integrity |

A thin WebView wrapper (Electron/Tauri/Capacitor) would **not** close this gap: the same JS engine still derives and holds the key material in its heap, with no TEE binding — only the packaging changes. Reasoning is expanded in ADR-001.

## 7. Recovery and operational limits (confirmed by source)

- Lost passphrase ⇒ data unrecoverable (no recovery key anywhere; `README.md:20`).
- Deleting a record does not revoke it from earlier backups (S4); restore-into-empty-vault is the only import path (`app.js:11`).
- Browser storage can be wiped by the OS at any time; tested encrypted backups are the user's only durability story (UI footer).
- Clipboard auto-clear depends on clipboard-read permission and foreground state (`app.js:19`).

## 8. Residual risk summary

Accepted **for a synthetic-data prototype**: Adv1 in-page compromise (XSS-class sinks absent but memory scraping undetectable), S4 rollback, S2 quota failures, S6 embedding, clipboard best-effort, device-clock-only time (`app.js:20` health line), unverified jsQR provenance (distribution blocker, not a runtime exploit).

**Not claimable:** resistance to local malware, any production deployment posture, any native-platform guarantee — none of these have been implemented or tested. Production readiness remains unclaimed in all Phase 2 documents.
