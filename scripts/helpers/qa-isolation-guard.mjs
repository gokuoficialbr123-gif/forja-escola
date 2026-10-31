// QA only. Import before suites: never read credential contents or contact a provider.
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
export function assertQaEnvironment(env=process.env){
 for(const [key,value] of Object.entries(env)){
  if(!value)continue;
  if(key==='FIREBASE_CONFIG'){
   const config=JSON.parse(value);assert.equal(config.projectId,'demo-forja','QA Firebase config must use demo-forja');
   assert.ok(Object.keys(config).every(k=>['projectId','databaseURL','storageBucket'].includes(k)),'QA refuses non-emulator Firebase config fields');
   if(config.databaseURL)assert.match(config.databaseURL,/^https:\/\/demo-forja(?:-default-rtdb)?\.firebaseio\.com\/?$/);
   if(config.storageBucket)assert.match(config.storageBucket,/^demo-forja\.(?:appspot\.com|firebasestorage\.app)$/);continue;
  }
  assert.ok(!/^(GOOGLE_APPLICATION_CREDENTIALS|FIREBASE_TOKEN|GOOGLE_(?:OAUTH|SECRETARIA|CALENDAR)_.*(?:SECRET|TOKEN|CLIENT_ID)|FIREBASE_(?:SERVICE_ACCOUNT.*|PRIVATE_KEY|CLIENT_EMAIL)|GCLOUD_ACCESS_TOKEN|CLOUDSDK_CONFIG|CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE)$/.test(key),'QA refuses credential variable: '+key);
  if(/^(FIREBASE_PROJECT_ID|GCLOUD_PROJECT|GOOGLE_CLOUD_PROJECT|GCP_PROJECT)$/.test(key))assert.equal(value,'demo-forja','QA project must be demo-forja: '+key);
  if(/^(FIRESTORE_EMULATOR_HOST|FIREBASE_AUTH_EMULATOR_HOST)$/.test(key))assert.match(value,/^127\.0\.0\.1:\d+$/,'QA emulator must be loopback: '+key);
  if(/^(FORJA_API_URL|FIREBASE_AUTH_URL|FIRESTORE_URL|FORJA_TEST_ENDPOINT)$/.test(key))assert.ok(loopback(value),'QA endpoint must be loopback: '+key);
 }
}
function loopback(input){try{const u=new URL(input);return ['http:','https:'].includes(u.protocol)&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&!u.username&&!u.password;}catch{return false;}}
assertQaEnvironment();
const safe=input=>assert.ok(loopback(input),'QA blocked non-loopback network request');
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,...args)=>{safe(input instanceof Request?input.url:input);return nativeFetch(input,...args);};
for(const module of [http,https])for(const name of ['request','get']){
 const native=module[name];module[name]=function(input,...args){
  const url=typeof input==='string'||input instanceof URL?input:(input.protocol|| (module===https?'https:':'http:'))+'//'+(input.hostname||input.host||'localhost')+(input.port?':'+input.port:'');
  safe(url);return native.call(this,input,...args);
 };
}
syncBuiltinESMExports();
