import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export function isolatedDemoArtifact(source,fixture,id){
 let html=source.toString('utf8');
 const sdk=/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/10\.14\.1\/firebase-(?:app|auth)-compat\.js"><\/script>/g;
 assert.equal([...html.matchAll(sdk)].length,2,'As duas dependências reais do Firebase devem ser removidas do demo.');
 html=html.replace(sdk,'');
 const declaration='let firebaseReady = false;';assert.equal(html.split(declaration).length,2);
 const appStart=html.lastIndexOf('<script',html.indexOf(declaration));
 assert.ok(appStart>=0);
 html=html.slice(0,appStart)+'<script id="'+id+'">\n'+fixture+'\n</script>\n'+html.slice(appStart);
 return Buffer.from(html);
}

export function invitationDemoArtifact(source){return isolatedDemoArtifact(source,readFileSync(new URL('./invitation-demo.js',import.meta.url),'utf8'),'forja-invitation-demo');}
