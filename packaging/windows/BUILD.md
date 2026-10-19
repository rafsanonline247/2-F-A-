# Windows packaging (Lekhok Secure Preview)

ভিত্তি: অফিসিয়াল Neutralino CLI (`@neutralinojs/neu`) — `.neu` বান্ডেল ফরম্যাট
প্লেইন ZIP নয়; নিজে তৈরি করলে বাইনারি পড়তে পারে না (v0.4.0-এর বাগ)।

## ধাপসমূহ

```bash
npm i -g @neutralinojs/neu        # বা: bunx @neutralinojs/neu
neu create build-tmp               # টেমপ্লেট প্রজেক্ট
cd build-tmp
# neutralino.config.json সেট করুন:
#   documentRoot: "/app/", enableNativeAPI: false, nativeAllowList: [],
#   version: "<অ্যাপ ভার্সন>", cli.resourcesPath: "/app/", cli.binaryVersion: "6.10.0"
rm -rf resources && mkdir app
cp -r <repo>/app/* app/            # অ্যাপ সোর্স (index.html, js/, fonts/)
neu update && neu build
# dist/LekhokSecure-Preview/ তে সব প্ল্যাটফর্মের বাইনারি + resources.neu পাওয়া যায়
```

## চূড়ান্ত প্যাকেজ (Windows x64)

dist থেকে শুধু এই ৩টি ফাইল নিন:
- `LekhokSecure-Preview-win_x64.exe` → নাম বদলে `LekhokSecure-Preview.exe`
- `resources.neu`
- `README.txt` (অবশ্যই exe-এর পাশে থাকতে হবে)

**সাবধানতা:** আলাদা করে ZIP-এ `neutralino.config.json` রাখার দরকার নেই —
কনফিগ CLI নিজেই resources.neu-এর ভেতরে বসিয়ে দেয় এবং বাইনারি bundle থেকেই
পড়ে। পুরনো (v0.4.0) বান্ডেল প্লেইন ZIP ছিল বলেই অ্যাপ খুলতে ব্যর্থ হয়েছিল।

## যাচাই (হেডলেস)

লিনাক্সে: `./LekhokSecure-Preview-linux_x64 --mode=cloud --port=3946` চালিয়ে
`curl http://127.0.0.1:3946/` → 200 + text/html দিলে বান্ডেল ঠিক আছে।
