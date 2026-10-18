import assert from 'node:assert/strict';import test from 'node:test';import{readFileSync}from'node:fs';import{createServer}from'node:http';
import{buildHostingArtifact,productionApiUrl}from'./prepare-hosting.mjs';import{expandStaticResources}from'./static-resources.mjs';import{verifyHostingResources}from'./verify-hosting.mjs';import{sha256}from'./validate.mjs';
const source=readFileSync(new URL('../index.html',import.meta.url));
test('image extraction is reversible and leaves every CSS/script byte and ordering intact',()=>{
 const f=buildHostingArtifact();assert.equal(f.resources.length,2);assert.ok(expandStaticResources(f.bytes,f.resources).equals(source));assert.ok(f.bytes.length<source.length*.82);
 const scripts=x=>[...x.toString().matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[0]);
 const styles=x=>[...x.toString().matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[0]);
 assert.deepEqual(scripts(f.bytes),scripts(source));assert.deepEqual(styles(f.bytes),styles(source));
 const images=[...new Set(source.toString().match(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g))];
 for(const r of f.resources){assert.equal(sha256(r.bytes),r.sha256);assert.ok(r.file.includes(r.sha256));assert.ok(images.some(x=>Buffer.from(x.split(',')[1],'base64').equals(r.bytes)));}
});
test('production and Preview preserve their API and share only unchanged public brand images',()=>{
 const a=buildHostingArtifact(),b=buildHostingArtifact(undefined,{previewApiUrl:'https://forja-api-pr-6.onrender.com'});
 assert.ok(a.bytes.includes(productionApiUrl));assert.ok(!a.bytes.includes('forja-api-pr-6'));
 assert.ok(b.bytes.includes('https://forja-api-pr-6.onrender.com'));assert.notEqual(sha256(a.bytes),sha256(b.bytes));assert.deepEqual(a.resources.map(r=>r.file),b.resources.map(r=>r.file));assert.ok(readFileSync(new URL('../index.html',import.meta.url)).equals(source));
});
test('served resource verification rejects missing assets, tampering and HTTP200 SPA fallback',async t=>{
 const f=buildHostingArtifact();let mode='success';const assets=new Map(f.resources.map(r=>['/'+r.file,r.bytes]));
 const server=createServer((req,res)=>{if(mode==='missing'){res.writeHead(404);return res.end()}res.end(mode==='spa'?f.bytes:mode==='tampered'?Buffer.concat([assets.get(req.url),Buffer.from('tampered')]):assets.get(req.url))});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const url='http://127.0.0.1:'+server.address().port;
 assert.equal((await verifyHostingResources(url,{resources:f.resources})).length,2);
 for(const x of ['missing','tampered','spa']){mode=x;await assert.rejects(verifyHostingResources(url,{resources:f.resources}));}
 await assert.rejects(verifyHostingResources(url,{resources:[{file:'../.env'}]}));
});
