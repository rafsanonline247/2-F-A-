const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
globalThis.crypto=require('node:crypto').webcrypto;
const vault=require('../app/js/vault.js');
const ctx={window:{crypto:globalThis.crypto},TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,Date,btoa,atob};vm.createContext(ctx);vm.runInContext(fs.readFileSync('app/js/totp.js','utf8')+';this.otp=LekhokTOTP',ctx);const otp=ctx.otp;
const empty={schema:2,revision:1,records:[]};
test('RFC 4226 all ten HOTP vectors use actual app engine',async()=>{const expected=['755224','287082','359152','969429','338314','254676','287922','162583','399871','520489'];for(let i=0;i<10;i++)assert.equal(await otp.generateHOTP('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',i),expected[i])});
test('RFC 6238 appendix B: 18 SHA1/256/512 vectors',async()=>{const times=[59,1111111109,1111111111,1234567890,2000000000,20000000000],expected=[['94287082','07081804','14050471','89005924','69279037','65353130'],['46119246','68084774','67062674','91819424','90698825','77737706'],['90693936','25091201','99943326','93441116','38618901','47863826']];for(const [a,len]of [[0,20],[1,32],[2,64]]){const raw=Buffer.from('1234567890'.repeat(7).slice(0,len));const secret=otp.bytesToBase32(raw);for(let t=0;t<6;t++)assert.equal(await otp.generateHOTP(secret,Math.floor(times[t]/30),8,['SHA-1','SHA-256','SHA-512'][a]),expected[a][t])}});
test('encryption roundtrip, wrong password and tampering rejection',async()=>{const s=await vault.create('test-only-long-passphrase'),e=await vault.seal(empty,s);assert.deepEqual((await vault.open(JSON.stringify(e),'test-only-long-passphrase')).data,empty);await assert.rejects(vault.open(JSON.stringify(e),'incorrect-passphrase'));const ct=Buffer.from(e.ct,'base64');ct[0]^=1;await assert.rejects(vault.open(JSON.stringify({...e,ct:ct.toString('base64')}),'test-only-long-passphrase'));await assert.rejects(vault.open(JSON.stringify({...e,iterations:1}),'test-only-long-passphrase'))});
test('fresh random IV per write; no plaintext record in envelope',async()=>{const s=await vault.create('test-only-long-passphrase'),d={...empty,records:[{id:'test',kind:'password',title:'fictional',username:'demo',password:'ONLY-SYNTHETIC-PASSWORD',secret:'',url:'',notes:''}]};const a=await vault.seal(d,s),b=await vault.seal(d,s);assert.notEqual(a.iv,b.iv);assert.ok(!JSON.stringify(a).includes('ONLY-SYNTHETIC-PASSWORD'))});
test('schema and password length constraints',async()=>{await assert.rejects(vault.create('short'));assert.throws(()=>vault.validate({schema:2,records:[{}]}));assert.equal(vault.generatePassword().length,24)});
test('backend rejects malformed codes rather than throwing',()=>{const forum=require('../forum');for(const input of ['','1','1234567','abcdef',null])assert.equal(forum.verifyCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',input),false)});
test('parseOtpAuthUri: valid URI, defaults and invalid inputs',()=>{
 const r=otp.parseOtpAuthUri('otpauth://totp/Example:alice@example.com?secret=gezd gnbv GY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Example&digits=8&period=60&algorithm=sha256');
 assert.equal(r.issuer,'Example');assert.equal(r.account,'alice@example.com');assert.equal(r.secret,'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');assert.equal(r.digits,8);assert.equal(r.period,60);assert.equal(r.algorithm,'SHA256');
 const d=otp.parseOtpAuthUri('otpauth://totp/Svc?secret=GEZDGNBVGY3TQOJQ');assert.equal(d.digits,6);assert.equal(d.period,30);assert.equal(d.algorithm,'SHA1');
 for(const bad of ['https://example.com','otpauth://totp/Svc','not a uri',''])assert.throws(()=>otp.parseOtpAuthUri(bad));
});
test('generateOtpAuthUri round-trips through parseOtpAuthUri',()=>{
 const item={type:'totp',issuer:'Example',account:'bob',secret:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',algorithm:'SHA512',digits:8,period:45};
 const r=otp.parseOtpAuthUri(otp.generateOtpAuthUri(item));
 assert.equal(r.secret,item.secret);assert.equal(r.algorithm,'SHA512');assert.equal(r.digits,8);assert.equal(r.period,45);assert.equal(r.issuer,'Example');
});
test('forum.verifyCode accepts the correct current code and rejects a wrong one (RFC 6238 SHA-1 vector)',()=>{
 const forum=require('../forum'),secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
 const good=forum.getCode(secret);assert.equal(forum.verifyCode(secret,good),true);assert.equal(forum.verifyCode(secret,good.slice(0,3)+' '+good.slice(3)),true);
 assert.equal(forum.getCode(secret,59,30,8),'94287082');
 const wrong=String((Number(good)+1)%1000000).padStart(6,'0');assert.equal(forum.verifyCode(secret,wrong,0),false);
 assert.equal(forum.verifyCode(secret,good,3),false);assert.equal(forum.verifyCode(secret,good,1,5),false);
});
test('formatCode groups 6 and 8 digit codes',()=>{assert.equal(otp.formatCode('123456'),'123 456');assert.equal(otp.formatCode('12345678'),'1234 5678');assert.equal(otp.formatCode(''),'')});
test('password generator: length, alphabet and no obvious bias',()=>{
 const seen=new Set();let all='';for(let i=0;i<200;i++){const p=vault.generatePassword(32);assert.equal(p.length,32);assert.match(p,/^[A-Za-z0-9!@#$%*_-]+$/);seen.add(p);all+=p}
 assert.equal(seen.size,200);const counts={};for(const ch of all)counts[ch]=(counts[ch]||0)+1;const exp=all.length/Object.keys(counts).length;
 for(const v of Object.values(counts))assert.ok(v>exp*0.6&&v<exp*1.4);
 assert.throws(()=>vault.generatePassword(8));assert.throws(()=>vault.generatePassword(200));
});
test('legacy v1 crypto path is gone from the app engine',()=>{assert.equal(otp.encryptData,undefined);assert.equal(otp.decryptData,undefined)});
test('local server sends hardened headers and blocks path traversal',async()=>{
 const {spawn}=require('node:child_process');const port=3950+Math.floor(Math.random()*40);
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
 try{let r;for(let i=0;i<30;i++){try{r=await fetch(`http://127.0.0.1:${port}/`);break}catch{await new Promise(x=>setTimeout(x,150))}}
  assert.ok(r,'server did not start');assert.equal(r.status,200);const csp=r.headers.get('content-security-policy');
  assert.match(csp,/frame-ancestors 'none'/);assert.match(csp,/connect-src 'none'/);assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  const t=await fetch(`http://127.0.0.1:${port}/..%2f..%2fetc%2fpasswd`);assert.notEqual(t.status,200);
  const m=await fetch(`http://127.0.0.1:${port}/`,{method:'POST'});assert.equal(m.status,405);
 }finally{child.kill()}
});
