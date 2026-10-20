#!/usr/bin/env bash
# Reproducible, repo-relative APK build (used by .github/workflows/release.yml).
# Env: ANDROID_HOME (SDK), optional KEYSTORE_FILE + KS_PASS (else an EPHEMERAL preview key is generated).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/packaging/android"
W="$ROOT/build/android"; rm -rf "$W"; mkdir -p "$W/assets" "$W/gen" "$W/classes" "$W/dexout"
VER="$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' "$SRC/AndroidManifest.xml")"
SDK="${ANDROID_HOME:?ANDROID_HOME not set}"; BT="$(ls -d "$SDK"/build-tools/34.* | sort -V | tail -1)"
PLATFORM="$SDK/platforms/android-34/android.jar"; OUT="$ROOT/build/LekhokSecure-Preview-v$VER.apk"
cp -r "$ROOT/app/." "$W/assets/"; cp "$ROOT/THIRD_PARTY_NOTICES.md" "$W/assets/"; cp -r "$ROOT/licenses" "$W/assets/"
"$BT/aapt2" compile --dir "$SRC/res" -o "$W/res.zip"
"$BT/aapt2" link -o "$W/base.apk" -I "$PLATFORM" --manifest "$SRC/AndroidManifest.xml" -R "$W/res.zip" -A "$W/assets" --java "$W/gen" --auto-add-overlay
javac -source 17 -target 17 -Xlint:-options -classpath "$PLATFORM" -d "$W/classes" \
  "$W/gen/com/lekhok/secure/preview/R.java" "$SRC/MainActivity.java"
"$BT/d8" --release --min-api 24 --lib "$PLATFORM" --output "$W/dexout" $(find "$W/classes" -name '*.class')
( cd "$W/dexout" && zip -qj ../base.apk classes.dex )
"$BT/zipalign" -f -p 4 "$W/base.apk" "$W/aligned.apk"
if [ -n "${KEYSTORE_FILE:-}" ] && [ -n "${KS_PASS:-}" ]; then KS="$KEYSTORE_FILE"; PASS="$KS_PASS"; SIGN="provided key"
else KS="$W/preview-ephemeral.jks"; PASS="$(openssl rand -hex 16)"; SIGN="EPHEMERAL preview key (changes every build)"
  keytool -genkeypair -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -alias preview -keyalg RSA -keysize 3072 -validity 3650 -dname "CN=Lekhok Secure Preview" >/dev/null 2>&1; fi
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" --out "$OUT" "$W/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT" | head -3
echo "Signed with: $SIGN"
# Guard: no INTERNET permission and FLAG_SECURE present
if "$BT/aapt2" dump permissions "$OUT" | grep -q INTERNET; then echo "FAIL: INTERNET permission present"; exit 1; fi
grep -q FLAG_SECURE "$SRC/MainActivity.java" || { echo "FAIL: FLAG_SECURE missing"; exit 1; }
unzip -l "$OUT" | grep -E "classes.dex|assets/index.html|assets/fonts/" | head
( cd "$ROOT/build" && sha256sum "$(basename "$OUT")" | tee "$(basename "$OUT").sha256" )
