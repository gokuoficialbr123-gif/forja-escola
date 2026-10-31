import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import {assertQaEnvironment} from './helpers/qa-isolation-guard.mjs';
test('QA fails closed on production projects, credentials and non-loopback endpoints',()=>{
 for(const env of [{FIREBASE_PROJECT_ID:'forja-escola'},{GCLOUD_PROJECT:'forja-escola'},{GOOGLE_APPLICATION_CREDENTIALS:'forbidden'},{GOOGLE_SECRETARIA_OAUTH_CLIENT_SECRET:'forbidden'},{FIREBASE_SERVICE_ACCOUNT:'forbidden'},{FIREBASE_PRIVATE_KEY:'forbidden'},{FIREBASE_CLIENT_EMAIL:'forbidden'},{CLOUDSDK_CONFIG:'forbidden'},{FIREBASE_CONFIG:'forbidden'},{FIRESTORE_EMULATOR_HOST:'remote:8080'},{FORJA_API_URL:'https://forja-api-m1kq.onrender.com'}])assert.throws(()=>assertQaEnvironment(env));
 assert.doesNotThrow(()=>assertQaEnvironment({FIREBASE_PROJECT_ID:'demo-forja',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8081',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FORJA_API_URL:'http://127.0.0.1:1234'}));
 assert.doesNotThrow(()=>assertQaEnvironment({FIREBASE_CONFIG:JSON.stringify({projectId:'demo-forja',databaseURL:'https://demo-forja.firebaseio.com',storageBucket:'demo-forja.appspot.com'})}));
 for(const config of [{projectId:'forja-escola'},{projectId:'demo-forja',private_key:'forbidden'},{projectId:'demo-forja',databaseURL:'https://forja-escola.firebaseio.com'}])assert.throws(()=>assertQaEnvironment({FIREBASE_CONFIG:JSON.stringify(config)}));
});
test('QA refuses real network before any Google or production request is sent',()=>{
 assert.throws(()=>fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events'),/blocked non-loopback/);
 assert.throws(()=>https.request('https://forja-escola.web.app'),/blocked non-loopback/);
 assert.throws(()=>http.get({hostname:'example.com',path:'/'}),/blocked non-loopback/);
});
