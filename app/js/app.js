'use strict';
const $=id=>document.getElementById(id), storageKey='lekhok.secure.v2';
let data=null,session=null,lastActivity=Date.now(),generation=0,busy=false,view='codes',sortAsc=true,statusTimer=0;
const status=msg=>{const el=$('status');el.textContent=msg;el.hidden=false;clearTimeout(statusTimer);statusTimer=setTimeout(()=>{el.hidden=true},3200)};
async function persist(next){const g=generation,s=session;if(!s)throw Error('Locked');const encrypted=await SecureVault.seal(next,s);if(g!==generation||session!==s)throw Error('Session changed');localStorage.setItem(storageKey,JSON.stringify(encrypted));data=next;}
function clearEditor(){$('record-form').reset();$('uri').value='';$('editor').hidden=true;}
function lock(){generation++;data=null;session=null;$('workspace').hidden=true;$('gate').hidden=false;$('lock').hidden=true;$('cards').replaceChildren();$('cards-pw').replaceChildren();$('passphrase').value='';clearEditor();showScreen(null);status('Vault লক হয়েছে / Vault locked.');}
function activate(result){data=result.data;session=result.session;lastActivity=Date.now();$('passphrase').value='';$('gate').hidden=true;$('workspace').hidden=false;setView(view);render();status('লোকালি আনলক হয়েছে / Unlocked locally.');}
async function action(fn){if(busy)return;busy=true;try{await fn()}catch(e){status('অপারেশন ব্যর্থ। পাসফ্রেজ, ইনপুট বা স্টোরেজ দেখুন। পুরনো ব্যাকআপ অক্ষত। / Operation failed. Existing backup retained.')}finally{busy=false}}
/* ---------- navigation ---------- */
const titles={codes:'2FA Codes',passwords:'Passwords',settings:'Settings'};
function setView(v){view=v;for(const t of ['codes','passwords','settings']){$('tab-'+t).classList.toggle('on',t===v)}$('view-title').textContent=titles[v];showScreen(null);$('fab').hidden=(v==='settings');render();}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));if(!id){const map={codes:'screen-codes',passwords:'screen-passwords',settings:'screen-settings'};$(map[view]).classList.add('on');}$('fab').hidden=(view==='settings')||(id&&id!=='screen-codes'&&id!=='screen-passwords');}
function openAdd(){$('editor').hidden=true;$('uri-box').hidden=true;showScreen('screen-add');}
/* ---------- unlock / restore ---------- */
$('unlock-form').onsubmit=e=>{e.preventDefault();action(async()=>{const raw=localStorage.getItem(storageKey);if(raw)activate(await SecureVault.open(raw,$('passphrase').value));else{const s=await SecureVault.create($('passphrase').value),d={schema:2,revision:1,records:[]};const envelope=await SecureVault.seal(d,s);localStorage.setItem(storageKey,JSON.stringify(envelope));activate({data:d,session:s});}})};
$('restore').onclick=()=>action(async()=>{if(localStorage.getItem(storageKey))throw Error('Restore requires empty vault');const file=$('restore-file').files[0];if(!file||file.size>8*1024*1024)throw Error('Invalid file');const raw=await file.text();const result=await SecureVault.open(raw,$('passphrase').value);localStorage.setItem(storageKey,raw);$('restore-file').value='';activate(result);status('ব্যাকআপ যাচাই হয়ে রিস্টোর হয়েছে / Backup authenticated and restored.');});
$('lock').onclick=lock;
/* ---------- tabs & screens ---------- */
$('tab-codes').onclick=()=>setView('codes');
$('tab-passwords').onclick=()=>setView('passwords');
$('tab-settings').onclick=()=>setView('settings');
$('help-btn').onclick=()=>showScreen('screen-help');
$('row-help').onclick=()=>showScreen('screen-help');
$('row-sync').onclick=()=>showScreen('screen-sync');
$('row-backup').onclick=()=>showScreen('screen-sync');
$('back-add').onclick=()=>showScreen(null);
$('back-sync').onclick=()=>showScreen(null);
$('back-help').onclick=()=>showScreen(null);
$('fab').onclick=openAdd;
$('import-uri').onclick=()=>{openAdd();$('uri-box').hidden=false;$('uri').focus();};
$('add-pw').onclick=()=>{openAdd();$('kind').value='password';$('editor').hidden=false;$('title').focus();};
$('btn-scan').onclick=()=>action(async()=>{$('qr').click()});
$('btn-uri').onclick=()=>{$('uri-box').hidden=!$('uri-box').hidden;};
$('btn-manual').onclick=()=>{clearEditor();$('editor').hidden=false;$('title').focus();};
$('cancel').onclick=()=>{clearEditor();showScreen(null);};
/* ---------- editor ---------- */
$('generate').onclick=()=>{$('password').value=SecureVault.generatePassword();status('র‍্যান্ডম পাসওয়ার্ড তৈরি; সেভ করলে সংরক্ষিত হবে / Random password generated; save the record to retain it.')};
function fillURI(uri){const p=LekhokTOTP.parseOtpAuthUri(uri);if(p.type!=='totp'||!['SHA1','SHA256','SHA512'].includes(p.algorithm)||![6,8].includes(p.digits)||!Number.isInteger(p.period)||p.period<15||p.period>120||!/^[A-Z2-7]{16,200}$/.test(p.secret))throw Error('Unsupported URI');$('title').value=p.issuer;$('username').value=p.account;$('secret').value=p.secret;$('algorithm').value={'SHA1':'SHA-1','SHA256':'SHA-256','SHA512':'SHA-512'}[p.algorithm];$('digits').value=p.digits;$('period').value=p.period;$('uri').value='';}
$('parse').onclick=()=>action(async()=>{fillURI($('uri').value);$('uri-box').hidden=true;$('editor').hidden=false;$('title').focus();status('URI যাচাই হয়েছে — সেভ করুন / URI parsed — now save.')});
$('qr').onchange=()=>action(async()=>{const f=$('qr').files[0];if(!f||f.size>8*1024*1024)throw Error('Invalid image');const img=await createImageBitmap(f);try{if(img.width*img.height>16000000)throw Error('Image too large');const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,img.width,img.height);const found=jsQR(pixels.data,img.width,img.height);if(!found)throw Error('No QR');fillURI(found.data);canvas.width=canvas.height=0;$('editor').hidden=false;status('QR পড়া হয়েছে — সেভ করুন / QR decoded — now save.');}finally{img.close();$('qr').value=''}});
$('record-form').onsubmit=e=>{e.preventDefault();action(async()=>{if(!session)throw Error('Locked');const record={id:crypto.randomUUID(),kind:$('kind').value,title:$('title').value.trim(),username:$('username').value,secret:$('secret').value.replace(/[\s-]/g,'').toUpperCase(),algorithm:$('algorithm').value,digits:Number($('digits').value),period:Number($('period').value),password:$('password').value,url:$('url').value,notes:$('notes').value};if(record.kind==='password'){record.secret='';if(!record.password)throw Error('Empty password')}else{record.password='';await LekhokTOTP.generateTOTP(record.secret,record)}const next={...data,revision:data.revision+1,records:[...data.records,record]};await persist(next);clearEditor();render();showScreen(null);status('এনক্রিপ্ট করে সেভ হয়েছে / Encrypted record saved.');})};
/* ---------- clipboard ---------- */
async function copy(text){try{await navigator.clipboard.writeText(text);status('কপি হয়েছে · ৩০ সেকেন্ড পর মুছে যেতে পারে / Copied. Best-effort clear after 30 seconds.');setTimeout(async()=>{try{if(await navigator.clipboard.readText()===text)await navigator.clipboard.writeText('')}catch{}},30000)}catch{status('ক্লিপবোর্ড অনুমতি নেই / Clipboard permission denied.')}}
/* ---------- rendering ---------- */
function filtered(kind){const q=($('search').value||$('search-pw').value).toLowerCase();let rs=data.records.filter(r=>r.kind===kind&&((r.title+' '+r.username).toLowerCase().includes(q)));if(sortAsc)rs=[...rs].sort((a,b)=>a.title.localeCompare(b.title));return rs}
function buildCard(r){const art=document.createElement('article');art.className='rec';const h=document.createElement('h3');h.textContent=r.title;const u=document.createElement('p');u.className='user';u.textContent=r.username||' ';const row=document.createElement('div');row.className='row';const logo=document.createElement('div');logo.className='logo';logo.textContent=(r.title||'?').trim().charAt(0).toUpperCase();const val=document.createElement('p');val.className='otp';val.textContent=r.kind==='totp'?'••• •••':'••••••••';val.id='otp-'+r.id;row.append(logo,val);art.append(h,u,row);if(r.kind==='totp'){const bar=document.createElement('progress');bar.id='bar-'+r.id;bar.max=r.period;bar.value=0;bar.className='bar';art.append(bar)}const del=document.createElement('button');del.className='del';del.textContent='✕';del.setAttribute('aria-label','Delete '+r.title);del.onclick=ev=>{ev.stopPropagation();action(async()=>{if(confirm('রেকর্ড মুছবেন? আগে এনক্রিপ্টেড ব্যাকআপ রাখুন। / Delete this record? Keep an encrypted backup first.')){await persist({...data,revision:data.revision+1,records:data.records.filter(x=>x.id!==r.id)});render();status('মুছে ফেলা হয়েছে / Deleted.')}})};art.append(del);art.onclick=()=>action(async()=>{if(!session)return;await copy(r.kind==='password'?r.password:(await LekhokTOTP.generateTOTP(r.secret,r)).code)});return art}
function fillGrid(grid,kind){grid.replaceChildren();const rs=filtered(kind);if(!rs.length){const d=document.createElement('div');d.className='empty';d.textContent=kind==='totp'?'কোনো 2FA রেকর্ড নেই — নিচে + চেপে যোগ করুন':'কোনো পাসওয়ার্ড রেকর্ড নেই — নিচে + চেপে যোগ করুন';grid.append(d);return}for(const r of rs)grid.append(buildCard(r))}
function render(){if(!data)return;fillGrid($('cards'),'totp');fillGrid($('cards-pw'),'password');const totp=data.records.filter(r=>r.kind==='totp').length,pw=data.records.filter(r=>r.kind==='password').length;$('stat-totp').textContent=totp;$('stat-pw').textContent=pw;$('stat-total').textContent=data.records.length;}
async function tick(){if(!session||!data)return;const g=generation;for(const r of data.records.filter(r=>r.kind==='totp')){const result=await LekhokTOTP.generateTOTP(r.secret,r);if(g!==generation||!session)return;const el=$('otp-'+r.id),bar=$('bar-'+r.id);if(el)el.textContent=LekhokTOTP.formatCode(result.code);if(bar)bar.value=result.remainingSeconds}}
$('search').oninput=render;$('search-pw').oninput=render;
$('sort-btn').onclick=()=>{sortAsc=!sortAsc;render();status(sortAsc?'A–Z সাজানো হলো':'নাম অনুযায়ী সাজানো বন্ধ')};
/* ---------- export ---------- */
$('export').onclick=()=>action(async()=>{if(!session)return;const envelope=await SecureVault.seal(data,session),blob=new Blob([JSON.stringify(envelope)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lekhok-'+new Date().toISOString().slice(0,10)+'.lekhokvault';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('এনক্রিপ্টেড ব্যাকআপ নামলো। আলাদা প্রোফাইলে রিস্টোর পরীক্ষা করুন / Encrypted backup downloaded. Test restoration in a separate browser profile.');});
/* ---------- lifecycle ---------- */
for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>lastActivity=Date.now());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&session)lock()});
window.addEventListener('storage',e=>{if(e.key===storageKey&&session){lock();status('অন্য ট্যাবে vault বদলেছে — আবার আনলক করুন / Vault changed in another tab. Unlock again.')}});
setInterval(()=>{if(session&&Date.now()-lastActivity>120000)lock();else if(session)tick().catch(()=>status('কোড তৈরি করা যায়নি / Unable to generate code.'));},1000);
if(!crypto.subtle){$('unlock').disabled=true;status('HTTPS বা localhost দরকার / HTTPS or localhost required.');}
setView('codes');
