/* Local-first prototype. No network access or persistent plaintext keys. */
const SecureVault = (() => {
 const c=globalThis.crypto, enc=new TextEncoder(), dec=new TextDecoder();
 const iterations=600000, maxSize=8*1024*1024;
 const b64=a=>{let s='';for(const b of a)s+=String.fromCharCode(b);return btoa(s)};
 const bytes=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
 const aad=enc.encode('LekhokVault:2:PBKDF2-SHA256:600000:AES-256-GCM');
 async function key(password,salt){return c.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},await c.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']),{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
 function validate(data){
  if(!data||data.schema!==2||!Array.isArray(data.records)||data.records.length>10000)throw Error('Invalid vault schema');
  const ids=new Set();
  for(const r of data.records){
   if(!r||typeof r.id!=='string'||ids.has(r.id)||!['totp','password'].includes(r.kind))throw Error('Invalid record');ids.add(r.id);
   for(const k of ['title','username','secret','password','url','notes'])if(typeof r[k]!=='string'||r[k].length>100000)throw Error('Invalid field');
   if(r.kind==='totp'&&(!/^[A-Z2-7]{16,200}$/.test(r.secret)||![6,8].includes(r.digits)||!Number.isInteger(r.period)||r.period<15||r.period>120||!['SHA-1','SHA-256','SHA-512'].includes(r.algorithm)))throw Error('Invalid TOTP parameters');
  }return data;
 }
 async function create(password){if(typeof password!=='string'||password.length<14)throw Error('Use at least 14 characters; prefer a long unique passphrase');const salt=c.getRandomValues(new Uint8Array(16));return {salt:b64(salt),key:await key(password,salt)}}
 async function seal(data,session){validate(data);const iv=c.getRandomValues(new Uint8Array(12));const ct=await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},session.key,enc.encode(JSON.stringify(data)));return {format:'LekhokVault',version:2,kdf:'PBKDF2-SHA256',iterations,salt:session.salt,iv:b64(iv),ct:b64(new Uint8Array(ct))}}
 async function open(raw,password){
  if(typeof raw!=='string'||raw.length>maxSize)throw Error('Backup too large');const e=JSON.parse(raw);
  if(e.format!=='LekhokVault'||e.version!==2||e.kdf!=='PBKDF2-SHA256'||e.iterations!==iterations||typeof e.ct!=='string')throw Error('Unsupported envelope');
  const salt=bytes(e.salt),iv=bytes(e.iv),ct=bytes(e.ct);if(salt.length!==16||iv.length!==12||ct.length<16)throw Error('Invalid envelope');
  const session={salt:e.salt,key:await key(password,salt)};
  const data=validate(JSON.parse(dec.decode(await c.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},session.key,ct))));return {data,session};
 }
 function generatePassword(length=24){if(!Number.isInteger(length)||length<16||length>128)throw Error('Invalid length');const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%*-_';let out='';const limit=256-256%alphabet.length;while(out.length<length){for(const x of c.getRandomValues(new Uint8Array(128))){if(x<limit)out+=alphabet[x%alphabet.length];if(out.length===length)break}}return out}
 return {create,seal,open,validate,generatePassword};
})();
if(typeof module!=='undefined')module.exports=SecureVault;
