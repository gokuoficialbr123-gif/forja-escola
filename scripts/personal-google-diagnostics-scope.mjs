import assert from 'node:assert/strict';
export function withoutPersonalGoogleDiagnostics(html){
 const script=/<script id="forja-google-personal-diagnostics-script">[\s\S]*?<\/script>\n\n/;
 assert.equal((html.match(/<script id="forja-google-personal-diagnostics-script">/g)||[]).length,1,'Personal Google diagnostic script missing');
 html=html.replace(script,'');
 assert.equal(html.split('e.googleDiagnosis=data.googleDiagnosis;').length,2);
 html=html.replace('e.googleDiagnosis=data.googleDiagnosis;','');
 const changed='if(action==="connect"){const session=forjaCaptureSession();const r=await api("/google/calendar/connect",{method:"POST",body:{},session});forjaAssertSession(session);if(!r.authUrl)throw new Error("URL de conexão não recebida");location.assign(r.authUrl);return}';
 const original='if(action==="connect"){const r=await api("/google/calendar/connect",{method:"POST",body:{}});if(!r.authUrl)throw new Error("URL de conexão não recebida");location.assign(r.authUrl);return}';
 assert.equal(html.split(changed).length,2);return html.replace(changed,original);
}
