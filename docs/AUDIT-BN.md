# অডিট, পরিবর্তন ও release gate
তারিখ: 2026-10-19

## প্রাপ্ত উপকরণ ও সীমা
পাবলিক Drive ফোল্ডার থেকে তিনটি ZIP সফলভাবে ডাউনলোড হয়েছে: 2FA prototype.zip, 2FA.zip, Build 2FA.zip। শেষ ZIP-এর embedded Next.js prototype ও আলাদা prototype directory-এর recursive diff-এ পার্থক্য পাওয়া যায়নি। 2FA.zip-এ ২৫টি screenshot আছে।

এই সেশনে নিজে দৃশ্যত দেখা ছবি: 193239 (প্রচার/ডাউনলোড), 193037 (codes dashboard)। সব ২৫টি ছবি নতুন করে visually যাচাই করা হয়নি। পুরোনো ANALYSIS_REPORT.md ও worklog অন্য লেখকের পূর্ববর্তী দাবি; এগুলোর test pass-কে বর্তমান test result হিসাবে ব্যবহার করা হয়নি।

নিশ্চিত: ছবিতে generic “Authenticator App” নাম, service cards, ৬ সংখ্যার প্রদর্শন, search ও bottom tabs। প্রকাশক, version, installation source, encryption ও RFC compliance ছবি থেকে নিশ্চিত নয়। QR payload decode করা হয়নি, দৃশ্যমান OTP বা ব্যক্তিগত পরিচয় এখানে পুনরুৎপাদন করা হয়নি।

এই পরিবেশ Debian sandbox, ব্যবহারকারীর laptop নয়। Laptop OS, installed package বা app directories সরাসরি পরীক্ষা করা হয়নি।

## সরবরাহকৃত standalone PWA-তে গুরুত্বপূর্ণ findings
| Severity | প্রমাণ | ফল ও remediation |
|---|---|---|
| Critical | app/js/app.js: saveAccounts/saveBackupCodes সরাসরি JSON localStorage | নতুন prototype-এ mandatory encrypted envelope; পুরোনো data স্বয়ংক্রিয় পড়া/মাইগ্রেট করা হয়নি |
| High | exportVaultFile plaintext JSON blob | নতুন format encrypted-only, authenticated restore |
| High | Google sign-in prompt; cloud sync শুধু timestamp বদলায় | নতুন UI-তে সম্পূর্ণ বাদ; বাস্তব OAuth/Drive বাকি |
| High | Phone flow যেকোনো ৬ character গ্রহণ করে | fake authentication বাদ |
| High | changeAutoLock শুধু setting; lock enforcement নেই | বাস্তব session/UI clearing ও inactivity/background lock |
| High | recovery-code inline onclick-এ unescaped value | নতুন renderer textContent/event handlers ব্যবহার করে; original backup-code feature এখনও port করা হয়নি |
| Medium | default personal profile, prefilled demonstration accounts | নতুন সংস্করণ empty; personal art/data অন্তর্ভুক্ত নয় |
| Medium | Node timingSafeEqual unequal-length input-এ exception | input format check যোগ; regression passed |
| Medium | countdown সব account-এ fixed 30 seconds | নতুন UI-তে result.remainingSeconds ও record.period |
| Medium | SW global cache deletion, generic HTML fallback | নতুন prototype-এ SW port করা হয়নি; offline installability দাবি নেই |
| Release blocker | third-party assets/provenance/license অসম্পূর্ণ | original branded assets বাদ; jsQR ও supplied code license যাচাই বাকি |

qrcode.min.js-এর ০ newline মানে empty নয়: বাস্তবে 19,927 bytes। প্রাথমিক empty সন্দেহ বাতিল।

Next.js crypto, URI parser ও API routes পড়া হয়েছে; তার dependency install/build বা পূর্ণ file-by-file audit হয়নি। উদাহরণস্বরূপ verify API client-supplied secret নেয়—demo-only; production authentication-এর বিকল্প নয়। তার পুরোনো passing screenshots নতুন security certification নয়।

## নতুন বাস্তবায়ন ও প্রমাণ
বিস্তারিত README.md। npm test: ৬ suite PASS, মোট RFC vector ২৮। Browser: create → add synthetic TOTP → live code → encrypted local storage → export → lock → wrong passphrase rejection → unlock → reload locked → পৃথক context-এ restore PASS। 390px mobile viewport-এ horizontal overflow নেই। Evidence screenshots কেবল synthetic data।

Browser প্রথমে missing libnspr4-এর কারণে চালু হয়নি; sandbox dependencies install করার পর PASS। tests/browser-check.cjs ও docs/browser-results.txt সংরক্ষিত। QR file scan, clipboard clearing, 120s idle boundary, real Android/Windows, accessibility ও multi-device conflict এখনো browser-tested নয়।

## Known limitations / production blockers
- এটি standalone web prototype; APK/EXE বা installable PWA নয়।
- OS-backed unlock, biometric enrollment, envelope DEK/device wrapping, Argon2id benchmarking ও recovery-key lifecycle বাকি।
- Cloud/Drive OAuth, appDataFolder scope, encrypted upload/download, ETag concurrency, device revocation, rollback protection ও conflict resolution বাকি।
- revision field রয়েছে, কিন্তু distributed merge বা atomic multi-tab writes নেই। storage event অন্য tab লক করে; simultaneous write race পুরোপুরি মেটে না। এক সময় এক tab ব্যবহার করুন।
- Browser/extension malware, unlocked memory scraping, malicious app updates প্রতিরোধের নিশ্চয়তা নেই।
- Passphrase entropy enforcement সীমিত; ১৪ character length নিরাপত্তার নিশ্চয়তা নয়।
- Restore integrity আছে কিন্তু trusted latest-version pinning নেই; পুরোনো valid backup replay ধরা যাবে না।
- Clipboard auto-clear best effort, browser permission ও foreground availability নির্ভর।
- Edit, categories/favorites, trash/history, password reveal/strength scoring, dedicated recovery-code records ও native camera UX বাকি।
- Original unencrypted exports/imports intentionally unsupported; silent unsafe migration করা হয়নি।

## Laptop-এ পরের read-only পরীক্ষা
১. Settings → Installed apps থেকে exact publisher/version/install source।
২. অনুমোদিত executable-এর Properties এবং Get-AuthenticodeSignature।
৩. অনুমোদিত package manifest ও installation directory-এর file names; app.asar/WebView2 থাকাই framework-এর চূড়ান্ত প্রমাণ নয়।
৪. License/EULA ও vendor privacy/security documentation যাচাই।
৫. Data directory-তে নাম/ধরন পর্যবেক্ষণ; vault, token, database contents পাঠাবেন না।

## Delivery / Drive
Source ও report workspace-এ প্রস্তুত। Google Drive connector disconnected পাওয়া গেছে; public folder পড়া সম্ভব হলেও লিখে upload করার অনুমতি মেলেনি। Drive upload সম্পন্ন হয়নি। প্যাকেজটি নিজে upload করুন বা connector সংযোগ দিন।

প্রস্তাবিত Drive structure:
releases/0.3.0/Lekhok-Secure-0.3.0.zip
releases/0.3.0/SHA256SUMS.txt
Package-এর docs/ এ audit, test logs, screenshots এবং roadmap রয়েছে।

Production gate এখন CLOSED। Native platform tests, complete audit, dependency/license validation, tested key recovery ও বাস্তব cloud restore verification ছাড়া প্রকৃত secrets দিয়ে ব্যবহার বা release নয়।
