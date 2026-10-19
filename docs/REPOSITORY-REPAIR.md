# Repository repair evidence

Date: 2026-10-19

## Initial state

- The requested repository was at `313e434` (`Add files via upload`) on `main`.
- The tracked tree contained only root files and `GitHub-upload-ready.zip`.
- GitHub reported no registered workflows and no prior Actions runs.
- All root files duplicated in the ZIP were byte-for-byte identical to the checked-out files. They were not replaced.

## Archive recovery

The ZIP contained 28 entries and 472,037 uncompressed bytes. Before extraction, every member path was checked for absolute paths, traversal, symlinks, duplicate paths, containment under the repository root, and configured per-file (100 MiB) and total (500 MiB) size limits. The archive CRC check passed. Fifteen files under `app/`, `tests/`, `docs/`, and `.github/workflows/` were recovered without overwriting existing files. Root files were left untouched. The two browser evidence images were retained with the archived documentation; their image content was not opened during recovery.

## Local verification

Environment: Node.js v22.15.0, npm 9.8.1, Linux.

After source recovery, `npm test` passed all 6 tests. The suite exercises the production `app/js/totp.js` engine against all 10 RFC 4226 HOTP vectors and 18 RFC 6238 SHA-1/256/512 vectors, and covers encrypted-envelope round trips, rejection of incorrect passphrases and tampering, randomized IVs, schema/password constraints, and malformed forum OTP input.

The test script now names `tests/security.test.js` explicitly rather than relying on shell wildcard expansion. JavaScript syntax checks likewise use explicit paths in CI.

## CI status and limits

The initial workflow runs the syntax checks and test suite on Linux and Windows with Node.js 22 and 24. `actions/checkout` and `actions/setup-node` are pinned to full commit SHAs. The workflow has read-only repository permissions and does not use secrets.

No Actions run exists before this repair branch is pushed. CI results are therefore pending and are not represented as passed here. Android and Windows native builds, device authentication, Google Drive, signing, and independent security review are outside this repository-repair phase and remain unverified.