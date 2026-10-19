# ADR-001: Target platform and stack for the 2FA app

- **Date:** 2026-10-20 (Asia/Dhaka) · **Status:** **Proposed** (pending repository-owner review — no external review has occurred)
- **Decides:** the native Android/Windows stack, and the future role of the current web prototype.
- **Does not decide:** implementation scheduling (see `docs/ROADMAP.md`), cloud/sync design, distribution channels.

## 1. Context

`rafsanonline247/2-F-A-` currently contains **Lekhok Secure 0.3.0**, a zero-dependency browser prototype: a TOTP authenticator + password vault with an encrypted envelope (PBKDF2-SHA256 600k + AES-256-GCM, BASELINE V3), an RFC-vector-tested OTP engine (V4), and a loopback static server (V1). The audit (`docs/audit/BASELINE.md`) and threat model (`docs/security/THREAT-MODEL.md`) establish the two facts that drive this decision:

1. **The browser is the security ceiling.** Key material is derived and held inside the page; JS cannot guarantee memory erasure; there is no hardware-backed key storage, no biometric gate, and no OS-managed clipboard (THREAT-MODEL §6). These are exactly the capabilities the product exists to provide, and they cannot be added from inside the browser.
2. **The verified core is small and portable.** The RFC 4226/6238 engine is ~270 lines including legacy code, and its correctness is already pinned by 28 published vectors (tests pass 6/6 on Node 22 and 24). Reimplementing it natively is low-risk **if the same vector suite gates every port**.

Team/tooling constraints observed in the repository: a Windows host is in use (`start_app.bat`), the existing code is vanilla JavaScript with zero npm dependencies (no framework lock-in to preserve), and all UI text targets a Bengali-speaking end user. No Dart/Kotlin/C# experience is evidenced in-repo; the ramp-up cost must be stated honestly as a consequence.

## 2. Options considered

| # | Option | Key protection | Verdict |
|---|---|---|---|
| 1 | Stay web-only (harden PWA) | Keys still derived in-page; no Keystore/CNG/TPM access | **Rejected** — cannot meet the core requirement |
| 2 | Thin WebView wrapper (Electron / Tauri / Capacitor) around current JS | Packaging only; key material remains in the webview's JS heap; no TEE binding | **Rejected** as the end state — a wrapper changes distribution, not protection (THREAT-MODEL §6) |
| 3 | React Native / Expo (JS reuse) | SecureStore is per-key small-value storage; deep crypto needs native modules; Windows story (react-native-windows) is comparatively immature | **Rejected** — desktop half is the weak link for a Windows-required product |
| 4 | Flutter (Dart, single codebase) | Good biometric/local_auth plugins; keystore access via platform channels; Windows desktop support newer than mobile | **Viable runner-up**, but assumes a Dart rewrite of UI *and* crypto and adds one framework's release cadence on top of two OSes |
| 5 | **Native per-platform: Android = Kotlin + Jetpack Compose + Android Keystore/StrongBox + BiometricPrompt; Windows = C# / .NET 8 + WinUI 3 + DPAPI/CNG (TPM) + Windows Hello** | First-class hardware-backed storage on each OS; direct camera enrollment; OS clipboard/lifecycle control | **Selected (proposed)** |

The Phase 2 instruction was to reason rather than assume Flutter; the decisive factors against option 4 were (a) the security-critical surface is exactly where platform-channel indirection is thinnest, (b) the in-repo evidence shows willingness to maintain small hand-rolled engines (the current zero-dependency design) rather than large cross-framework estates, and (c) per-platform native keeps each OS's key-attestation story front-and-center instead of behind a plugin. If owner bandwidth later proves insufficient, option 4 remains the documented fallback with the same RFC-vector gate.

## 3. Decision (proposed)

**Build native clients on both platforms with per-platform UI and a shared, vector-pinned crypto core:**

- **Android:** Kotlin, Jetpack Compose, `androidx.security`/Keystore (StrongBox where available), BiometricPrompt, CameraX for QR enrollment. MSRP: single-Activity, local-first, no network permission in v1.
- **Windows:** C#/.NET 8, WinUI 3 (MSIX), DPAPI + CNG/TPM via `System.Security` APIs, Windows Hello for unlock.
- **Shared correctness gate:** the existing 28 published RFC vectors (RFC 4226 App. D, RFC 6238 App. B) become language-neutral fixtures; every native engine must pass them in CI before any other work merges. Only synthetic secrets ever enter tests (`THREAT-MODEL` §1).
- **Vault envelope:** keep the authenticated-envelope concept (AAD-bound format string, per-write IV, KDF-parameter pinning — as verified in BASELINE V3) but replace in-page PBKDF2 with OS-wrapped storage; the passphrase-encrypted export format (`LekhokVault` v2) is retained for portability so browser backups remain restorable.

### Why the web prototype is retained — and what it becomes

The prototype is **retained as a reference, not replaced and not shipped**: it is the executable specification of the envelope format, enrollment UX, lock behavior, and the RFC test harness; it is already evidence-backed (BASELINE V1–V12). It is **frozen feature-wise**: no new web features except documentation/test alignment (ROADMAP P2), and it is explicitly **not** the codebase a wrapper (option 2) would package. New UX work happens in the native clients; the web app remains the onboarding/demo artifact and the specification of record for backup-format interoperability.

## 4. Consequences

**Positive**
- Keys move under hardware protection on each OS; biometric gating and OS clipboard/lifecycle policies become available (closes THREAT-MODEL §6 gaps that are unreachable in-browser).
- Each platform gets first-class camera enrollment (the current `Permissions-Policy: camera=()` limitation disappears).
- Two small, boring, reviewable codebases; no third-party framework release train between us and the keystore.
- The vector fixture suite keeps engine divergence detectable from day one.

**Negative / costs (stated honestly)**
- Two UI codebases to build and maintain; Kotlin and C#/.NET are new toolchains for this repository — ramp-up time is real and unbudgeted by any evidence in-repo.
- Slower feature delivery than any cross-platform option.
- Envelope v2 design must be finalized early so browser backups and native restores interoperate; until then the web export is the only interchange format.

**Risks & mitigations**
- *Skill ramp stalls delivery* → documented Flutter fallback (option 4) with unchanged crypto gates.
- *Engine divergence across three languages* → single fixtures directory consumed by all test suites; CI fails on any vector mismatch.
- *Scope creep into cloud sync* → explicitly out of ADR-001; real OAuth/Drive stays behind roadmap gates (P6, blocked).

## 5. Compliance with Phase 2 limits

No native implementation is started in this phase — this ADR is a decision record only. Nothing here claims device testing, Drive integration, signing, or external review; those remain gated in `docs/ROADMAP.md` and unclaimed in `docs/audit/BASELINE.md` §7.
