#!/usr/bin/env bash
# LEGACY local-sandbox script (absolute paths). Use build-apk-ci.sh / release.yml instead.
# Usage: bash /home/z/work/2fa/build-apk.sh
set -euo pipefail

ROOT=/home/z/work/2fa
APK=$ROOT/apk
JDK=$ROOT/jdk
SDK=$ROOT/sdk
BT=$SDK/build-tools/34.0.0
PLATFORM=$SDK/platforms/android-34/android.jar
OUT=$APK
KEYSTORE=$APK/lekhok-preview.keystore

export PATH=$JDK/bin:$PATH

cd "$OUT"
echo "== 1. aapt2 compile/link resources+manifest =="
rm -rf gen res.zip classes dexout aligned.apk base.apk "$OUT"/*.apk.idsig
mkdir -p gen classes dexout
$BT/aapt2 compile --dir res -o res.zip
$BT/aapt2 link -o base.apk \
  -I "$PLATFORM" \
  --manifest AndroidManifest.xml \
  -R res.zip \
  -A assets \
  --java gen \
  --auto-add-overlay

echo "== 2. javac =="
javac -source 17 -target 17 \
  -classpath "$PLATFORM" \
  -d classes \
  gen/com/lekhok/secure/preview/R.java \
  java/com/lekhok/secure/preview/MainActivity.java

echo "== 3. d8 dex =="
$BT/d8 --release --min-api 24 --lib "$PLATFORM" \
  --output dexout $(find classes -name '*.class')

echo "== 4. add dex to apk =="
cd dexout && zip -qj ../base.apk classes.dex && cd ..

echo "== 5. zipalign =="
$BT/zipalign -f -p 4 base.apk aligned.apk

echo "== 6. apksigner sign =="
# Keystore password is NOT stored in this repository (it is public).
# Pass it at build time:  LEKHOK_KS_PASS=<preview pass> bash build-apk.sh
# (Preview password lives in KEYS-README.txt, delivered offline with the keystore.)
$BT/apksigner sign \
  --ks "$KEYSTORE" \
  --ks-pass "pass:${LEKHOK_KS_PASS:?Set LEKHOK_KS_PASS (see KEYS-README.txt)}" \
  --key-pass "pass:${LEKHOK_KS_PASS:?Set LEKHOK_KS_PASS (see KEYS-README.txt)}" \
  --out "$OUT/LekhokSecure-Preview-v0.5.0.apk" \
  aligned.apk

echo "== 7. verify =="
$BT/apksigner verify --print-certs "$OUT/LekhokSecure-Preview-v0.5.0.apk" | head -6
unzip -l "$OUT/LekhokSecure-Preview-v0.5.0.apk" | grep -E "classes.dex|assets/index.html|assets/js/app.js|assets/fonts/kalpurush.ttf|res/"
echo "BUILD OK: $OUT/LekhokSecure-Preview-v0.5.0.apk"
