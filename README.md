# Lekhok Secure 0.3.0 — local web security prototype

**Not a production release, native app, or complete implementation of the requested roadmap.**

## Run
Install Node.js 20 or later, extract this package, then run:

```sh
node server.js
```
Open http://localhost:3000. The default server binds only to loopback. HTTPS is required on non-localhost origins. The server needs no npm dependencies. No database or existing app is modified. This prototype intentionally does not register a service worker; start the local server for each session. It can operate without internet while that server is running.

## Use
1. Create a vault with a unique, long passphrase (minimum 14 characters).
2. Add a TOTP or password record. Only fictional/test accounts should be used until independent security review.
3. Export an encrypted `.lekhokvault` backup. It uses the vault passphrase, not a separate recovery key.
4. Test restore in a separate, empty browser profile. Do not create a blank vault before restoring.
5. Lock now, reload, or background the page to clear the active UI session.

A forgotten passphrase cannot be reset to recover data. Browser storage deletion destroys the local vault. Backups remain usable with their original passphrase; deleting a record does not revoke old backups.

## Implemented
- TOTP SHA-1/256/512, 6/8 digits, 15–120 second period; countdown, copy, manual enrollment.
- TOTP URI ingestion and local image QR decoding. No camera capture.
- Mandatory AES-256-GCM encrypted storage and encrypted backup. PBKDF2-SHA256 600,000 iterations, random salt, 96-bit IV per encryption; fixed format identifier authenticated as AAD.
- Non-extractable in-memory CryptoKey; no passphrase or raw vault key persisted.
- Password generator with unbiased CSPRNG sampling; repeated-password count.
- Explicit lock, 120-second inactivity lock, background lock, reload locked.
- Search, record deletion, constrained import schema and file limits.
- No telemetry, fake cloud login, external time request, plaintext export, or default personal accounts.

PBKDF2 is a deliberate browser-prototype choice, **not Argon2id or OS-backed key storage**. Device biometrics, Android Keystore and Windows CNG are not implemented. The browser can retain memory copies; non-extractable keys do not defeat XSS or malware.

## Tests
`npm test` — six suites including all 28 published HOTP/TOTP vectors; results in docs/test-results.txt.
Browser test: install Playwright and Chromium in a separate test environment. `tests/browser-check.cjs` is the exact executed script, with paths pointing to this session's evidence directory; adjust paths to rerun elsewhere. Browser evidence uses only synthetic accounts.

## Forum kit
`forum.js` is a patched copy of the supplied Node helper. Malformed OTP inputs now reject rather than crash. It is **not a login system**: callers must implement authenticated enrollment, server-side secret lookup, encryption at rest, rate limits, transactional last-used-counter replay prevention, single-use hashed recovery codes, CSRF protection, session rotation and audit redaction. Do not accept a client-supplied secret as proof of login. PHP kit was inspected but is not bundled as verified production code.

## Distribution / licenses
Original personal screenshots, profile photo, copied branded art, `.env`, Git history and database are not included. `jsQR.js` is inherited third-party code from the supplied archive; distribution requires verifying upstream license and retaining its notices. Core TOTP logic is adapted from the supplied project. Ownership/license of supplied project code has not been independently established. Do not publish this bundle until provenance and license obligations are verified.
